import { HangoutStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { HangoutService } from '../src/hangouts/hangout.service';
import type { HostStatusService } from '../src/host-status/host-status.service';
import type { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function serviceWith(db: object) {
  return new HangoutService(db as PrismaService, {} as NotificationService, {} as HostStatusService);
}

describe('Hangout deletion', () => {
  it('physically deletes a hosted Hangout so its cascaded chat room and messages are removed', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const update = vi.fn();
    const service = serviceWith({
      hangout: {
        findUnique: vi.fn().mockResolvedValue({ id: 'hangout', hostUserId: 'host', status: HangoutStatus.FINISHED }),
        delete: remove,
        update,
      },
    });

    await expect(service.cancel('host', 'hangout')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ where: { id: 'hangout' } });
    expect(update).not.toHaveBeenCalled();
  });

  it('physically deletes a pre-finish hosted Hangout instead of leaving a cancelled history item', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const update = vi.fn();
    const service = serviceWith({
      hangout: {
        findUnique: vi.fn().mockResolvedValue({ id: 'hangout', hostUserId: 'host', status: HangoutStatus.OPEN }),
        delete: remove,
        update,
      },
    });

    await expect(service.cancel('host', 'hangout')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ where: { id: 'hangout' } });
    expect(update).not.toHaveBeenCalled();
  });
});
