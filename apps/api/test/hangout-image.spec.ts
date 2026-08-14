import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { HangoutService } from '../src/hangouts/hangout.service';
import type { HostStatusService } from '../src/host-status/host-status.service';
import type { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function serviceWith(db: object) {
  return new HangoutService(db as PrismaService, {} as NotificationService, {} as HostStatusService);
}

describe('Hangout image normalization', () => {
  it('converts an uploaded image to a 1200 x 675 JPEG before saving', async () => {
    const source = await sharp({
      create: { width: 400, height: 800, channels: 3, background: '#4f8f67' },
    }).png().toBuffer();
    const update = vi.fn().mockImplementation(({ data }: { data: { imageUrl?: string } }) => Promise.resolve(data));
    const service = serviceWith({
      hangout: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'hangout', hostUserId: 'host', hostMaleCount: 1, hostFemaleCount: 0, maxParticipants: 4,
        }),
        update,
      },
    });

    const result = await service.update('host', 'hangout', {
      imageUrl: `data:image/png;base64,${source.toString('base64')}`,
    });
    const imageUrl = (result as { imageUrl: string }).imageUrl;
    expect(imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    const metadata = await sharp(Buffer.from(imageUrl.split(',')[1]!, 'base64')).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1200, height: 675 });
  });

  it('rejects image data that cannot be decoded', async () => {
    const service = serviceWith({
      hangout: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'hangout', hostUserId: 'host', hostMaleCount: 1, hostFemaleCount: 0, maxParticipants: 4,
        }),
        update: vi.fn(),
      },
    });

    await expect(service.update('host', 'hangout', {
      imageUrl: 'data:image/png;base64,aW52YWxpZA==',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
