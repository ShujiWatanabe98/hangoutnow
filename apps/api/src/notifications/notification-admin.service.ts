import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationAdminService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(NotificationService) private readonly notifications: NotificationService) {}
  async overview() {
    const [control, tokens, platforms, deliveries] = await Promise.all([
      this.db.notificationControl.findUnique({ where: { id: 'global' } }), this.db.pushToken.count(),
      this.db.pushToken.groupBy({ by: ['platform'], _count: { _all: true } }),
      this.db.pushDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { paused: control?.paused ?? false, updatedAt: control?.updatedAt ?? null, registeredTokens: tokens, platforms, deliveries };
  }
  pause(adminId: string, paused: boolean) { return this.db.notificationControl.upsert({ where: { id: 'global' }, create: { id: 'global', paused, updatedBy: adminId }, update: { paused, updatedBy: adminId }, select: { paused: true, updatedAt: true, updatedBy: true } }); }
  async cleanup() { const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); return this.db.pushToken.deleteMany({ where: { updatedAt: { lt: cutoff } } }); }
  test(userId: string, title: string, body: string) { return this.notifications.notify(userId, 'ADMIN_TEST', title.trim(), body.trim()); }
}
