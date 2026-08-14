import { HangoutStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { HangoutService } from '../src/hangouts/hangout.service';
import type { HostStatusService } from '../src/host-status/host-status.service';
import type { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('profile Hangout activity', () => {
  it('separates hosted and accepted-participation histories without private locations', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'hosted', title: '主催したカフェ', status: HangoutStatus.FINISHED, startAt: new Date('2026-08-10'), imageUrl: null, category: 'CAFE', publicLocationName: '新宿駅周辺', hostUserId: 'me' },
      { id: 'joined', title: '参加したランニング', status: HangoutStatus.STARTED, startAt: new Date('2026-08-09'), imageUrl: null, category: 'RUNNING', publicLocationName: '渋谷駅周辺', hostUserId: 'other' },
    ]);
    const service = new HangoutService({ hangout: { findMany } } as unknown as PrismaService, {} as NotificationService, {} as HostStatusService);

    const result = await service.activity('me');

    expect(result.hosted).toEqual([expect.objectContaining({ id: 'hosted', title: '主催したカフェ' })]);
    expect(result.participated).toEqual([expect.objectContaining({ id: 'joined', title: '参加したランニング' })]);
    expect(result.hosted[0]).not.toHaveProperty('hostUserId');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ hostUserId: 'me' }, { joinRequests: { some: { userId: 'me', status: 'ACCEPTED' } } }] } }));
  });
});
