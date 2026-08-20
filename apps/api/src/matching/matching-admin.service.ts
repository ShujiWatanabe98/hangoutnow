import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, HangoutStatus, JoinRequestStatus, MatchingAlgorithmStatus } from '@prisma/client';
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

  async acquisitionDashboard() {
    const campaign = 'shinjuku-launch-202609';
    const limit = 5_000;
    const [total, recentRows] = await Promise.all([
      this.db.acquisitionAttribution.count({ where: { campaign } }),
      this.db.acquisitionAttribution.findMany({
        where: { campaign }, orderBy: { createdAt: 'desc' }, take: limit,
        select: {
          source: true, medium: true, campaign: true, content: true,
          user: {
            select: {
              joinRequests: { select: { status: true, attendanceStatus: true, hangout: { select: { status: true } } } },
              hostedHangouts: { select: { status: true } },
            },
          },
        },
      }),
    ]);
    const groups = new Map<string, { source:string;medium:string;campaign:string;content:string;registered:number;joinRequested:number;accepted:number;hosted:number;activated:number;completed:number }>();
    let joinRequestedUsers = 0; let acceptedUsers = 0; let hostedUsers = 0; let activatedUsers = 0; let completedUsers = 0;
    for (const row of recentRows) {
      const joined = row.user.joinRequests.length > 0;
      const accepted = row.user.joinRequests.some(request => request.status === JoinRequestStatus.ACCEPTED);
      const hosted = row.user.hostedHangouts.length > 0;
      const activated = joined || hosted;
      const completed = row.user.joinRequests.some(request => request.status === JoinRequestStatus.ACCEPTED && request.attendanceStatus === AttendanceStatus.CONFIRMED && request.hangout.status === HangoutStatus.FINISHED)
        || row.user.hostedHangouts.some(hangout => hangout.status === HangoutStatus.FINISHED);
      if (joined) joinRequestedUsers += 1; if (accepted) acceptedUsers += 1; if (hosted) hostedUsers += 1; if (activated) activatedUsers += 1; if (completed) completedUsers += 1;
      const key = [row.source, row.medium, row.campaign, row.content].join('\u0000');
      const group = groups.get(key) ?? { source:row.source,medium:row.medium,campaign:row.campaign,content:row.content,registered:0,joinRequested:0,accepted:0,hosted:0,activated:0,completed:0 };
      group.registered += 1; group.joinRequested += Number(joined); group.accepted += Number(accepted); group.hosted += Number(hosted); group.activated += Number(activated); group.completed += Number(completed);
      groups.set(key, group);
    }
    return {
      campaign, consentRequired: true, trackedRegistrations: total, sampledRegistrations: recentRows.length, truncated: total > limit,
      joinRequestedUsers, acceptedUsers, hostedUsers, activatedUsers, completedUsers,
      groups: [...groups.values()].sort((left, right) => right.registered - left.registered || left.source.localeCompare(right.source)).slice(0, 100),
    };
  }

  async dashboard() {
    const now = Date.now();
    const [configs, users, hangouts, completed, feedback, ratings, reports, funnel, ratingDistribution, declineReasons, active1d, active7d, active30d, acquisition] = await Promise.all([
      this.db.matchingAlgorithmConfig.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      this.db.user.count(), this.db.hangout.count(), this.db.hangout.count({ where: { status: 'FINISHED' } }),
      this.db.matchFeedback.groupBy({ by: ['algorithmVersion', 'outcome'], _count: { _all: true } }),
      this.db.hangoutRating.aggregate({ _avg: { score: true }, _count: { score: true } }),
      this.db.report.count(),
      this.db.funnelEvent.groupBy({ by: ['eventType'], _count: { _all: true } }),
      this.db.hangoutRating.groupBy({ by: ['score'], _count: { _all: true }, orderBy: { score: 'asc' } }),
      this.db.matchFeedback.groupBy({ by: ['reason'], where: { outcome: 'NOT_MATCHED', reason: { not: null } }, _count: { _all: true } }),
      this.db.refreshToken.findMany({ where: { createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } }, distinct: ['userId'], select: { userId: true } }),
      this.db.refreshToken.findMany({ where: { createdAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } }, distinct: ['userId'], select: { userId: true } }),
      this.db.refreshToken.findMany({ where: { createdAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } }, distinct: ['userId'], select: { userId: true } }),
      this.acquisitionDashboard(),
    ]);
    return { activeVersion: configs.find(item => item.status === MatchingAlgorithmStatus.ACTIVE)?.version ?? MATCHING_ALGORITHM_VERSION, defaults: DEFAULT_MATCHING_WEIGHTS, metrics: { users, registeredUsers: users, activeUsers: { day: active1d.length, week: active7d.length, month: active30d.length }, hangouts, completed, averageRating: ratings._avg.score, ratingCount: ratings._count.score, reports }, acquisition, feedback, funnel, ratingDistribution, declineReasons, configs };
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
