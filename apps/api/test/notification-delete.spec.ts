import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { RealtimeGateway } from '../src/notifications/realtime.gateway';

describe('Notification deletion', () => {
  it('deletes only the signed-in user notifications and refreshes their clients', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const send = vi.fn();
    const service = new NotificationService(
      { notification: { deleteMany } } as unknown as PrismaService,
      { send } as unknown as RealtimeGateway,
    );

    await service.deleteAll('signed-in-user');

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'signed-in-user' } });
    expect(send).toHaveBeenCalledWith('signed-in-user', 'notifications:changed', {});
  });
});
