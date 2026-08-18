import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MatchingAlgorithmStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchingConfigDto, MatchingWeightsDto } from './matching-admin.dto';
import { DEFAULT_MATCHING_WEIGHTS, MATCHING_ALGORITHM_VERSION, MatchingWeights } from './matching-version';

@Injectable()
export class MatchingAdminService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async activeWeights(): Promise<MatchingWeights> {
    const active = await this.db.matchingAlgorithmConfig.findFirst({ where: { status: MatchingAlgorithmStatus.ACTIVE }, orderBy: { activatedAt: 'desc' }, select: { weights: true } });
    return active ? this.parseWeights(active.weights) : DEFAULT_MATCHING_WEIGHTS;
  }

  async activeVersion() {
    const active = await this.db.matchingAlgorithmConfig.findFirst({ where: { status: MatchingAlgorithmStatus.ACTIVE }, orderBy: { activatedAt: 'desc' }, select: { version: true } });
    return active?.version ?? MATCHING_ALGORITHM_VERSION;
  }

  async dashboard() {
    const [configs, users, hangouts, completed, feedback, ratings, reports] = await Promise.all([
      this.db.matchingAlgorithmConfig.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      this.db.user.count(), this.db.hangout.count(), this.db.hangout.count({ where: { status: 'FINISHED' } }),
      this.db.matchFeedback.groupBy({ by: ['algorithmVersion', 'outcome'], _count: { _all: true } }),
      this.db.hangoutRating.aggregate({ _avg: { score: true }, _count: { score: true } }),
      this.db.report.count(),
    ]);
    return { activeVersion: configs.find(item => item.status === MatchingAlgorithmStatus.ACTIVE)?.version ?? MATCHING_ALGORITHM_VERSION, defaults: DEFAULT_MATCHING_WEIGHTS, metrics: { users, hangouts, completed, averageRating: ratings._avg.score, ratingCount: ratings._count.score, reports }, feedback, configs };
  }

  create(adminId: string, input: CreateMatchingConfigDto) {
    return this.db.matchingAlgorithmConfig.create({ data: { id: uuidv7(), version: input.version, note: input.note.trim(), createdBy: adminId, weights: { ...input.weights } } });
  }

  async activate(id: string, adminId: string) {
    const target = await this.db.matchingAlgorithmConfig.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    if (target.status !== MatchingAlgorithmStatus.DRAFT) throw new ConflictException('Only a draft can be activated');
    this.parseWeights(target.weights);
    return this.db.$transaction(async tx => {
      await tx.matchingAlgorithmConfig.updateMany({ where: { status: MatchingAlgorithmStatus.ACTIVE }, data: { status: MatchingAlgorithmStatus.ARCHIVED } });
      return tx.matchingAlgorithmConfig.update({ where: { id }, data: { status: MatchingAlgorithmStatus.ACTIVE, activatedBy: adminId, activatedAt: new Date() } });
    });
  }

  private parseWeights(value: unknown): MatchingWeights {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid matching weights');
    const record = value as Record<string, unknown>;
    const keys = Object.keys(DEFAULT_MATCHING_WEIGHTS) as Array<keyof MatchingWeightsDto>;
    if (!keys.every(key => typeof record[key] === 'number' && Number.isFinite(record[key]))) throw new BadRequestException('Invalid matching weights');
    return Object.fromEntries(keys.map(key => [key, record[key]])) as unknown as MatchingWeights;
  }
}
