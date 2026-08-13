import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JoinRequestStatus, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

const publicUser = { id: true, displayName: true, profilePhoto: true, verification: true } as const;

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  async rooms(uid: string) {
    const rows = await this.db.chatRoom.findMany({
      where: { OR: [{ hangout: { hostUserId: uid } }, { hangout: { joinRequests: { some: { userId: uid, status: JoinRequestStatus.ACCEPTED } } } }] },
      include: {
        hangout: {
          include: {
            host: { select: publicUser },
            joinRequests: { where: { status: JoinRequestStatus.ACCEPTED }, include: { user: { select: publicUser } } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((room) => ({
      ...room,
      type: 'GROUP' as const,
      members: [room.hangout.host, ...room.hangout.joinRequests.map((request) => request.user)],
      lastMessage: room.messages[0] ?? null,
    }));
  }

  async messages(uid: string, roomId: string) {
    await this.groupAccess(uid, roomId);
    return this.db.message.findMany({ where: { roomId }, include: { sender: { select: publicUser } }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async send(uid: string, roomId: string, body: string) {
    const room = await this.groupAccess(uid, roomId);
    const message = await this.db.message.create({ data: { id: uuidv7(), roomId, senderUserId: uid, body: body.trim() }, include: { sender: { select: publicUser } } });
    const recipients = new Set([room.hangout.hostUserId, ...room.hangout.joinRequests.map((request) => request.userId)]);
    recipients.delete(uid);
    for (const recipient of recipients) {
      await this.notifications.notify(recipient, 'CHAT_MESSAGE', `${message.sender.displayName}さんからグループメッセージ`, message.body, `group-chat:${roomId}`, `message:${message.id}:${recipient}`);
    }
    return message;
  }

  async directRooms(uid: string) {
    const blockedUserIds = await this.blockedUserIds(uid);
    const rows = await this.db.directChat.findMany({
      where: { OR: [{ userOneId: uid }, { userTwoId: uid }] },
      include: { userOne: { select: publicUser }, userTwo: { select: publicUser }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows
      .map((room) => ({ ...room, type: 'DIRECT' as const, otherUser: room.userOneId === uid ? room.userTwo : room.userOne, lastMessage: room.messages[0] ?? null }))
      .filter((room) => !blockedUserIds.has(room.otherUser.id));
  }

  async createDirect(uid: string, targetUserId: string) {
    if (uid === targetUserId) throw new BadRequestException('自分自身とは1対1チャットを開始できません');
    await this.assertNotBlocked(uid, targetUserId);
    if (!(await this.areMatched(uid, targetUserId))) throw new ForbiddenException('同じHangoutで承認された相手とのみチャットできます');
    const orderedUserIds = [uid, targetUserId].sort();
    const userOneId = orderedUserIds[0]!;
    const userTwoId = orderedUserIds[1]!;
    const room = await this.db.directChat.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      create: { id: uuidv7(), userOneId, userTwoId },
      update: {},
      include: { userOne: { select: publicUser }, userTwo: { select: publicUser }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { ...room, type: 'DIRECT' as const, otherUser: room.userOneId === uid ? room.userTwo : room.userOne, lastMessage: room.messages[0] ?? null };
  }

  async directMessages(uid: string, roomId: string) {
    await this.directAccess(uid, roomId);
    return this.db.directMessage.findMany({ where: { directChatId: roomId }, include: { sender: { select: publicUser } }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async sendDirect(uid: string, roomId: string, body: string) {
    const room = await this.directAccess(uid, roomId);
    const recipient = room.userOneId === uid ? room.userTwoId : room.userOneId;
    const message = await this.db.$transaction(async (tx) => {
      const created = await tx.directMessage.create({ data: { id: uuidv7(), directChatId: roomId, senderUserId: uid, body: body.trim() }, include: { sender: { select: publicUser } } });
      await tx.directChat.update({ where: { id: roomId }, data: { updatedAt: new Date() } });
      return created;
    });
    await this.notifications.notify(recipient, 'DIRECT_MESSAGE', `${message.sender.displayName}さんからメッセージ`, message.body, `direct-chat:${roomId}`, `direct-message:${message.id}:${recipient}`);
    return message;
  }

  private async groupAccess(uid: string, roomId: string) {
    const room = await this.db.chatRoom.findUnique({ where: { id: roomId }, include: { hangout: { include: { joinRequests: { where: { status: JoinRequestStatus.ACCEPTED } } } } } });
    if (!room) throw new NotFoundException();
    if (room.hangout.hostUserId !== uid && !room.hangout.joinRequests.some((request) => request.userId === uid)) throw new ForbiddenException();
    if (room.hangout.hostUserId !== uid) await this.assertNotBlocked(uid, room.hangout.hostUserId);
    return room;
  }

  private async directAccess(uid: string, roomId: string) {
    const room = await this.db.directChat.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException();
    if (room.userOneId !== uid && room.userTwoId !== uid) throw new ForbiddenException();
    const otherUserId = room.userOneId === uid ? room.userTwoId : room.userOneId;
    await this.assertNotBlocked(uid, otherUserId);
    return room;
  }

  private async assertNotBlocked(uid: string, targetUserId: string) {
    const blocked = await this.db.block.findFirst({ where: { OR: [{ blockerId: uid, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: uid }] } });
    if (blocked) throw new ForbiddenException('Blocked relationship');
  }

  private async blockedUserIds(uid: string) {
    const blocks = await this.db.block.findMany({ where: { OR: [{ blockerId: uid }, { blockedId: uid }] }, select: { blockerId: true, blockedId: true } });
    return new Set(blocks.map((block) => block.blockerId === uid ? block.blockedId : block.blockerId));
  }

  private async areMatched(uid: string, targetUserId: string) {
    const sharedHangout = await this.db.hangout.findFirst({
      where: {
        OR: [
          { hostUserId: uid, joinRequests: { some: { userId: targetUserId, status: JoinRequestStatus.ACCEPTED } } },
          { hostUserId: targetUserId, joinRequests: { some: { userId: uid, status: JoinRequestStatus.ACCEPTED } } },
          { AND: [
            { joinRequests: { some: { userId: uid, status: JoinRequestStatus.ACCEPTED } } },
            { joinRequests: { some: { userId: targetUserId, status: JoinRequestStatus.ACCEPTED } } },
          ] },
        ],
      } satisfies Prisma.HangoutWhereInput,
      select: { id: true },
    });
    return Boolean(sharedHangout);
  }
}
