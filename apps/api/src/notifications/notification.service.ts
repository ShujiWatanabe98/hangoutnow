import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

interface ExpoTicket { status: 'ok' | 'error'; details?: { error?: string } }

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway) {}

  onModuleInit() { this.timer = setInterval(() => void this.createReminders(), 60_000); void this.createReminders(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async list(userId: string) {
    const [items, unreadCount, user] = await Promise.all([
      this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.notification.count({ where: { userId, readAt: null } }),
      this.db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } }),
    ]);
    return { items, unreadCount, enabled: user?.notificationsEnabled ?? true };
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android') {
    await this.db.pushToken.upsert({
      where: { token },
      create: { id: uuidv7(), userId, token, platform },
      update: { userId, platform },
    });
    return { registered: true };
  }

  async removePushToken(userId: string, token: string) {
    await this.db.pushToken.deleteMany({ where: { userId, token } });
  }

  async markRead(userId: string, id: string) { await this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async markAllRead(userId: string) { await this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async deleteAll(userId: string) { await this.db.notification.deleteMany({ where: { userId } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async settings(userId: string, enabled: boolean) { await this.db.user.update({ where: { id: userId }, data: { notificationsEnabled: enabled } }); return { enabled }; }

  async notify(userId: string, type: string, title: string, body: string, link?: string, eventKey?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } });
    if (!user?.notificationsEnabled) return null;
    try {
      const item = await this.db.notification.create({ data: { id: uuidv7(), userId, type, title, body, link, eventKey } });
      this.realtime.send(userId, 'notification', item);
      void this.sendPush(userId, title, body, link);
      return item;
    } catch { return null; }
  }

  private async sendPush(userId: string, title: string, body: string, link?: string) {
    try {
      const tokens = await this.db.pushToken.findMany({ where: { userId }, select: { token: true }, take: 10 });
      if (!tokens.length) return;
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'accept-encoding': 'gzip, deflate' },
        body: JSON.stringify(tokens.map(({ token }) => ({ to: token, sound: 'default', title, body, data: link ? { link } : {} }))),
      });
      if (!response.ok) return;
      const payload = await response.json() as { data?: ExpoTicket[] };
      const invalid = tokens.filter((_, index) => payload.data?.[index]?.details?.error === 'DeviceNotRegistered').map(({ token }) => token);
      if (invalid.length) await this.db.pushToken.deleteMany({ where: { token: { in: invalid } } });
    } catch { /* Push delivery is best-effort; the in-app notification remains authoritative. */ }
  }

  private async createReminders() {
    const now = new Date(); const until = new Date(now.getTime() + 16 * 60_000);
    const rows = await this.db.hangout.findMany({ where: { startAt: { gt: now, lte: until }, status: { in: ['OPEN', 'FULL'] } }, include: { joinRequests: { where: { status: 'ACCEPTED' }, select: { userId: true } } } });
    for (const hangout of rows) for (const userId of [hangout.hostUserId, ...hangout.joinRequests.map((join) => join.userId)]) await this.notify(userId, 'REMINDER', '開始15分前です', `${hangout.title}の集合時間が近づいています。`, `hangout:${hangout.id}`, `reminder:${hangout.id}:${userId}`);
  }
}
