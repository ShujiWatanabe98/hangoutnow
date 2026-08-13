import { ValidationPipe } from '@nestjs/common';
import { FunnelEventType, ServiceArea } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { TrackFunnelEventDto } from '../src/analytics/analytics.dto';
import { CreateHangoutDto } from '../src/hangouts/hangout.dto';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('Shinjuku/Shibuya launch constraints and funnel events', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  it('accepts only the two launch service areas', async () => {
    const base = { title: '30分後にラーメン', category: 'RAMEN', startInMinutes: 30, publicLocationName: '新宿駅周辺', locationName: '新宿駅東口の店舗', maxParticipants: 4 };
    await expect(pipe.transform({ ...base, serviceArea: ServiceArea.SHINJUKU }, { type: 'body', metatype: CreateHangoutDto })).resolves.toMatchObject({ serviceArea: 'SHINJUKU' });
    await expect(pipe.transform({ ...base, serviceArea: ServiceArea.SHIBUYA }, { type: 'body', metatype: CreateHangoutDto })).resolves.toMatchObject({ serviceArea: 'SHIBUYA' });
    await expect(pipe.transform({ ...base, serviceArea: 'IKEBUKURO' }, { type: 'body', metatype: CreateHangoutDto })).rejects.toMatchObject({ status: 400 });
  });

  it('allows a total size from one to eight people', async () => {
    const base = { title: '少人数カフェ', category: 'CAFE', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 30, publicLocationName: '新宿駅周辺', locationName: '新宿の店舗' };
    await expect(pipe.transform({ ...base, maxParticipants: 1 }, { type: 'body', metatype: CreateHangoutDto })).resolves.toMatchObject({ maxParticipants: 1 });
    await expect(pipe.transform({ ...base, maxParticipants: 8 }, { type: 'body', metatype: CreateHangoutDto })).resolves.toMatchObject({ maxParticipants: 8 });
    await expect(pipe.transform({ ...base, maxParticipants: 9 }, { type: 'body', metatype: CreateHangoutDto })).rejects.toMatchObject({ status: 400 });
  });

  it('requires a Hangout id for downstream funnel events and persists valid events', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'event-id', eventType: FunnelEventType.HANGOUT_VIEWED, createdAt: new Date() });
    const db = { hangout: { findUnique: vi.fn().mockResolvedValue({ id: '01900000-0000-7000-8000-000000000001' }) }, funnelEvent: { create } } as unknown as PrismaService;
    const analytics = new AnalyticsService(db);
    await expect(analytics.track('user-id', { eventType: FunnelEventType.HANGOUT_VIEWED })).rejects.toMatchObject({ status: 400 });
    await analytics.track('user-id', { eventType: FunnelEventType.HANGOUT_VIEWED, hangoutId: '01900000-0000-7000-8000-000000000001' });
    expect(create).toHaveBeenCalledOnce();
  });

  it('validates event names and UUIDs at the API boundary', async () => {
    await expect(pipe.transform({ eventType: 'PASSWORD_EXPOSED' }, { type: 'body', metatype: TrackFunnelEventDto })).rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ eventType: FunnelEventType.HANGOUT_VIEWED, hangoutId: 'not-a-uuid' }, { type: 'body', metatype: TrackFunnelEventDto })).rejects.toMatchObject({ status: 400 });
  });
});
