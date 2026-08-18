import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PushDeliveryStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

interface ExpoTicket { status: 'ok' | 'error'; id?: string; details?: { error?: string } }
interface ExpoReceipt { status: 'ok' | 'error'; details?: { error?: string } }
const CONTROL_ID = 'global';
const PRIVATE_MESSAGE_TYPES = new Set(['CHAT_MESSAGE', 'DIRECT_MESSAGE']);
export function safePushBody(type?: string, body?: string) { return type && PRIVATE_MESSAGE_TYPES.has(type) ? '新しいメッセージが届きました。アプリを開いて確認してください。' : (body ?? '新しいお知らせがあります。'); }

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private queueTimer?: NodeJS.Timeout;
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.createReminders(), 60_000);
    this.queueTimer = setInterval(() => void this.processPushQueue(), 10_000);
    void this.createReminders(); void this.processPushQueue();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); if (this.queueTimer) clearInterval(this.queueTimer); }

  async list(userId: string) {
    const [items, unreadCount, user] = await Promise.all([
      this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.notification.count({ where: { userId, readAt: null } }),
      this.db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true, disabledNotificationTypes: true } }),
    ]);
    return { items, unreadCount, enabled: user?.notificationsEnabled ?? true, disabledTypes: user?.disabledNotificationTypes ?? [] };
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android') {
    await this.db.pushToken.upsert({ where: { token }, create: { id: uuidv7(), userId, token, platform }, update: { userId, platform } });
    return { registered: true };
  }
  async removePushToken(userId: string, token: string) { await this.db.pushToken.deleteMany({ where: { userId, token } }); }
  async markRead(userId: string, id: string) { await this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async markAllRead(userId: string) { await this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async deleteAll(userId: string) { await this.db.notification.deleteMany({ where: { userId } }); this.realtime.send(userId, 'notifications:changed', {}); }
  async settings(userId: string, enabled: boolean, disabledTypes?: string[]) {
    const user = await this.db.user.update({ where: { id: userId }, data: { notificationsEnabled: enabled, ...(disabledTypes === undefined ? {} : { disabledNotificationTypes: disabledTypes }) }, select: { notificationsEnabled: true, disabledNotificationTypes: true } });
    return { enabled: user.notificationsEnabled, disabledTypes: user.disabledNotificationTypes ?? [] };
  }

  async notify(userId: string, type: string, title: string, body: string, link?: string, eventKey?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true, disabledNotificationTypes: true } });
    if (!user?.notificationsEnabled || (user.disabledNotificationTypes ?? []).includes(type)) return null;
    try {
      const item = await this.db.notification.create({ data: { id: uuidv7(), userId, type, title, body, link, eventKey } });
      this.realtime.send(userId, 'notification', item);
      await this.enqueuePush(item.id, userId);
      return item;
    } catch { return null; }
  }

  async processPushQueue() {
    // Lightweight test repositories may intentionally omit push delivery delegates.
    if (!this.db.notificationControl || !this.db.pushDelivery) return;
    const control = await this.db.notificationControl.findUnique({ where: { id: CONTROL_ID }, select: { paused: true } });
    if (control?.paused) return;
    await this.checkReceipts();
    const deliveries = await this.db.pushDelivery.findMany({ where: { status: PushDeliveryStatus.QUEUED, nextAttemptAt: { lte: new Date() }, attempts: { lt: 4 } }, include: { notification: { select: { type: true, title: true, body: true, link: true } } }, orderBy: { createdAt: 'asc' }, take: 100 });
    if (!deliveries.length) return;
    const messages = deliveries.map(delivery => ({ to: delivery.token, sound: 'default', title: delivery.notification?.title ?? 'Hangout Now', body: safePushBody(delivery.notification?.type, delivery.notification?.body), data: delivery.notification?.link ? { link: delivery.notification.link } : {} }));
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'accept-encoding': 'gzip, deflate' }, body: JSON.stringify(messages) });
      if (!response.ok) { await this.retry(deliveries.map(item => item.id), `HTTP_${response.status}`); return; }
      const payload = await response.json() as { data?: ExpoTicket[] };
      for (let index = 0; index < deliveries.length; index += 1) {
        const delivery = deliveries[index]!; const ticket = payload.data?.[index];
        if (ticket?.status === 'ok' && ticket.id) await this.db.pushDelivery.update({ where: { id: delivery.id }, data: { status: PushDeliveryStatus.ACCEPTED, ticketId: ticket.id, attempts: { increment: 1 }, errorCode: null } });
        else await this.failDelivery(delivery.id, delivery.token, ticket?.details?.error ?? 'EXPO_TICKET_ERROR');
      }
    } catch { await this.retry(deliveries.map(item => item.id), 'NETWORK_ERROR'); }
  }

  private async enqueuePush(notificationId: string, userId: string) {
    const tokens = await this.db.pushToken.findMany({ where: { userId }, select: { id: true, token: true, platform: true }, take: 10 });
    if (tokens.length) await this.db.pushDelivery.createMany({ data: tokens.map(item => ({ id: uuidv7(), userId, notificationId, pushTokenId: item.id, token: item.token, platform: item.platform })) });
  }
  private async retry(ids: string[], code: string) { await this.db.pushDelivery.updateMany({ where: { id: { in: ids } }, data: { attempts: { increment: 1 }, errorCode: code, nextAttemptAt: new Date(Date.now() + 60_000) } }); }
  private async failDelivery(id: string, token: string, code: string) {
    await this.db.pushDelivery.update({ where: { id }, data: { status: PushDeliveryStatus.ERROR, errorCode: code, attempts: { increment: 1 }, receiptCheckedAt: new Date() } });
    if (code === 'DeviceNotRegistered') await this.db.pushToken.deleteMany({ where: { token } });
  }
  private async checkReceipts() {
    const rows = await this.db.pushDelivery.findMany({ where: { status: PushDeliveryStatus.ACCEPTED, ticketId: { not: null }, receiptCheckedAt: null, updatedAt: { lte: new Date(Date.now() - 15_000) } }, select: { id: true, token: true, ticketId: true }, take: 100 });
    if (!rows.length) return;
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ ids: rows.map(item => item.ticketId) }) });
      if (!response.ok) return;
      const payload = await response.json() as { data?: Record<string, ExpoReceipt> };
      for (const row of rows) {
        const receipt = row.ticketId ? payload.data?.[row.ticketId] : undefined;
        if (!receipt) continue;
        if (receipt.status === 'ok') await this.db.pushDelivery.update({ where: { id: row.id }, data: { status: PushDeliveryStatus.DELIVERED, receiptCheckedAt: new Date(), errorCode: null } });
        else await this.failDelivery(row.id, row.token, receipt.details?.error ?? 'EXPO_RECEIPT_ERROR');
      }
    } catch { /* Receipt polling retries on the next worker cycle. */ }
  }

  private async createReminders() {
    const now = new Date(); const until = new Date(now.getTime() + 16 * 60_000);
    const rows = await this.db.hangout.findMany({ where: { startAt: { gt: now, lte: until }, status: { in: ['OPEN', 'FULL'] } }, include: { joinRequests: { where: { status: 'ACCEPTED' }, select: { userId: true } } } });
    for (const hangout of rows) for (const userId of [hangout.hostUserId, ...hangout.joinRequests.map(join => join.userId)]) await this.notify(userId, 'REMINDER', '開始15分前です', `${hangout.title}の集合時間が近づいています。`, `hangout:${hangout.id}`, `reminder:${hangout.id}:${userId}`);
  }
}
