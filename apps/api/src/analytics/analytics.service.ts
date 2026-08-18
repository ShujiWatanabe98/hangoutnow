import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { FunnelEventType, MatchOutcome } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SaveMatchFeedbackDto, TrackFunnelEventDto } from './analytics.dto';
import { MATCHING_ALGORITHM_VERSION } from '../matching/matching-version';
import { MatchingAdminService } from '../matching/matching-admin.service';

const HANGOUT_REQUIRED = new Set<FunnelEventType>([
  FunnelEventType.HANGOUT_VIEWED,
  FunnelEventType.JOIN_REQUESTED,
  FunnelEventType.JOIN_ACCEPTED,
  FunnelEventType.HANGOUT_CREATED,
  FunnelEventType.HANGOUT_COMPLETED,
]);

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Optional() @Inject(MatchingAdminService) private readonly matchingAdmin?: MatchingAdminService) {}

  async track(userId: string, input: TrackFunnelEventDto) {
    if (HANGOUT_REQUIRED.has(input.eventType) && !input.hangoutId) {
      throw new BadRequestException('hangoutId is required for this event type');
    }
    const consent = await this.db.user.findUnique({ where: { id: userId }, select: { matchingDataConsent: true, behaviorLearningEnabled: true } });
    if (!consent?.matchingDataConsent || !consent.behaviorLearningEnabled) return { tracked: false };
    if (input.hangoutId) {
      const exists = await this.db.hangout.findUnique({ where: { id: input.hangoutId }, select: { id: true } });
      if (!exists) throw new BadRequestException('Unknown hangoutId');
    }
    return this.db.funnelEvent.create({
      data: { id: uuidv7(), userId, hangoutId: input.hangoutId, eventType: input.eventType },
      select: { id: true, eventType: true, createdAt: true },
    });
  }

  async saveMatchFeedback(userId: string, input: SaveMatchFeedbackDto) {
    if (input.outcome === MatchOutcome.NOT_MATCHED && !input.reason) throw new BadRequestException('不成立理由を選択してください');
    if (input.outcome === MatchOutcome.MATCHED && input.reason) throw new BadRequestException('成立時に不成立理由は指定できません');
    const consent = await this.db.user.findUnique({ where: { id: userId }, select: { matchingDataConsent: true } });
    if (!consent?.matchingDataConsent) throw new BadRequestException('マッチング改善への利用同意が必要です');
    const exists = await this.db.hangout.findUnique({ where: { id: input.hangoutId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Unknown hangoutId');
    const algorithmVersion = this.matchingAdmin ? await this.matchingAdmin.activeVersion() : MATCHING_ALGORITHM_VERSION;
    return this.db.matchFeedback.upsert({
      where: { userId_hangoutId: { userId, hangoutId: input.hangoutId } },
      create: { id: uuidv7(), userId, hangoutId: input.hangoutId, outcome: input.outcome, reason: input.reason, algorithmVersion },
      update: { outcome: input.outcome, reason: input.reason ?? null, algorithmVersion },
      select: { hangoutId: true, outcome: true, reason: true, updatedAt: true },
    });
  }
}
