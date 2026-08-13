import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { FunnelEventType } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { TrackFunnelEventDto } from './analytics.dto';

const HANGOUT_REQUIRED = new Set<FunnelEventType>([
  FunnelEventType.HANGOUT_VIEWED,
  FunnelEventType.JOIN_REQUESTED,
  FunnelEventType.JOIN_ACCEPTED,
  FunnelEventType.HANGOUT_CREATED,
  FunnelEventType.HANGOUT_COMPLETED,
]);

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async track(userId: string, input: TrackFunnelEventDto) {
    if (HANGOUT_REQUIRED.has(input.eventType) && !input.hangoutId) {
      throw new BadRequestException('hangoutId is required for this event type');
    }
    if (input.hangoutId) {
      const exists = await this.db.hangout.findUnique({ where: { id: input.hangoutId }, select: { id: true } });
      if (!exists) throw new BadRequestException('Unknown hangoutId');
    }
    return this.db.funnelEvent.create({
      data: { id: uuidv7(), userId, hangoutId: input.hangoutId, eventType: input.eventType },
      select: { id: true, eventType: true, createdAt: true },
    });
  }
}
