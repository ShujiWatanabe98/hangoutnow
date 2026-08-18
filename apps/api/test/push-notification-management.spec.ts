import { describe, expect, it, vi } from 'vitest';
import { NotificationService, safePushBody } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { RealtimeGateway } from '../src/notifications/realtime.gateway';

describe('push notification management', () => {
  it('never exposes private chat text on the lock screen', () => {
    const privateText = '駅の裏口で待っています';
    expect(safePushBody('CHAT_MESSAGE', privateText)).not.toContain(privateText);
    expect(safePushBody('DIRECT_MESSAGE', privateText)).not.toContain(privateText);
    expect(safePushBody('REMINDER', '開始15分前です')).toBe('開始15分前です');
  });

  it('queues one delivery per registered device without logging token data', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ notificationsEnabled: true, disabledNotificationTypes: [] }) },
      notification: { create: vi.fn().mockResolvedValue({ id: 'notification-1', type: 'CHAT_MESSAGE' }) },
      pushToken: { findMany: vi.fn().mockResolvedValue([{ id: 'token-id', token: 'ExponentPushToken[abc]', platform: 'ios' }]) },
      pushDelivery: { createMany },
    } as unknown as PrismaService;
    const service = new NotificationService(db, { send: vi.fn() } as unknown as RealtimeGateway);
    await service.notify('user-1', 'CHAT_MESSAGE', '新着', '非公開本文');
    expect(createMany).toHaveBeenCalledOnce();
  });
});
