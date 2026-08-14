import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HangoutService } from '../src/hangouts/hangout.service';
import type { HostStatusService } from '../src/host-status/host-status.service';
import type { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function serviceWith(db: object) {
  return new HangoutService(db as PrismaService, {} as NotificationService, {} as HostStatusService);
}

describe('Hangout hearts', () => {
  it('adds one heart per user and returns the current count', async () => {
    const create = vi.fn().mockResolvedValue({ hangoutId: 'hangout', userId: 'user' });
    const service = serviceWith({
      hangout: { findUnique: vi.fn().mockResolvedValue({ id: 'hangout' }) },
      hangoutHeart: { findUnique: vi.fn().mockResolvedValue(null), create, delete: vi.fn(), count: vi.fn().mockResolvedValue(4) },
    });

    await expect(service.toggleHeart('user', 'hangout')).resolves.toEqual({ hearted: true, heartCount: 4 });
    expect(create).toHaveBeenCalledWith({ data: { hangoutId: 'hangout', userId: 'user' } });
  });

  it('removes an existing heart and rejects an unknown Hangout', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const service = serviceWith({
      hangout: { findUnique: vi.fn().mockResolvedValueOnce({ id: 'hangout' }).mockResolvedValueOnce(null) },
      hangoutHeart: { findUnique: vi.fn().mockResolvedValue({}), create: vi.fn(), delete: remove, count: vi.fn().mockResolvedValue(2) },
    });

    await expect(service.toggleHeart('user', 'hangout')).resolves.toEqual({ hearted: false, heartCount: 2 });
    expect(remove).toHaveBeenCalledWith({ where: { hangoutId_userId: { hangoutId: 'hangout', userId: 'user' } } });
    await expect(service.toggleHeart('user', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
