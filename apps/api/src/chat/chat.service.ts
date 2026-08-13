import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HangoutStatus, JoinRequestStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StampService } from '../stamps/stamp.service';

const publicUser = { id: true, displayName: true, profilePhoto: true, verification: true } as const;

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(StampService) private readonly stamps: StampService,
  ) {}

  async rooms(uid: string) {
    const rows = await this.db.chatRoom.findMany({
      where: { OR: [{ hangout: { hostUserId: uid } }, { hangout: { joinRequests: { some: { userId: uid, status: JoinRequestStatus.ACCEPTED } } } }] },
      include: {
        hangout: {
          include: {
            host: { select: publicUser },
            joinRequests: { where: { status: JoinRequestStatus.ACCEPTED }, include: { user: { select: publicUser } } },
            ratings: { select: { raterUserId: true, ratedUserId: true, score: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((room) => {
      const members = [room.hangout.host, ...room.hangout.joinRequests.map((request) => request.user)].map((member) => ({
        ...member,
        myRatingScore: room.hangout.ratings.find((rating) => rating.raterUserId === uid && rating.ratedUserId === member.id)?.score ?? null,
        ratedFiveByMe: room.hangout.ratings.some((rating) => rating.raterUserId === uid && rating.ratedUserId === member.id && rating.score === 5),
        directChatEligible: room.hangout.status === HangoutStatus.FINISHED
          && room.hangout.ratings.some((rating) => rating.raterUserId === uid && rating.ratedUserId === member.id && rating.score === 5)
          && room.hangout.ratings.some((rating) => rating.raterUserId === member.id && rating.ratedUserId === uid && rating.score === 5),
      }));
      return { ...room, type: 'GROUP' as const, members, lastMessage: room.messages[0] ?? null };
    });
  }

  async messages(uid: string, roomId: string) {
    await this.groupAccess(uid, roomId);
    return this.db.message.findMany({ where: { roomId }, include: { sender: { select: publicUser } }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async send(uid: string, roomId: string, body?: string, stampId?: string) {
    const room = await this.groupAccess(uid, roomId);
    const content=stampId?await this.stamps.payload(uid,stampId):(body?.trim()??'');
    const message = await this.db.message.create({ data: { id: uuidv7(), roomId, senderUserId: uid, body: content }, include: { sender: { select: publicUser } } });
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
    const visible = await Promise.all(rows.map(async (room) => {
      const otherUser = room.userOneId === uid ? room.userTwo : room.userOne;
      if (blockedUserIds.has(otherUser.id) || !(await this.hasMutualFiveStarMeeting(uid, otherUser.id))) return null;
      return { ...room, type: 'DIRECT' as const, otherUser, lastMessage: room.messages[0] ?? null };
    }));
    return visible.filter((room) => room !== null);
  }

  async createDirect(uid: string, targetUserId: string) {
    if (uid === targetUserId) throw new BadRequestException('自分自身とは1対1チャットを開始できません');
    await this.assertNotBlocked(uid, targetUserId);
    if (!(await this.hasMutualFiveStarMeeting(uid, targetUserId))) throw new ForbiddenException('Hangout終了後、お互いに★5を付けた相手とのみ1対1チャットできます');
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

  async sendDirect(uid: string, roomId: string, body?: string, stampId?: string) {
    const room = await this.directAccess(uid, roomId);
    const recipient = room.userOneId === uid ? room.userTwoId : room.userOneId;
    const message = await this.db.$transaction(async (tx) => {
      const content=stampId?await this.stamps.payload(uid,stampId):(body?.trim()??'');
      const created = await tx.directMessage.create({ data: { id: uuidv7(), directChatId: roomId, senderUserId: uid, body: content }, include: { sender: { select: publicUser } } });
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
    if (!(await this.hasMutualFiveStarMeeting(uid, otherUserId))) throw new ForbiddenException('Mutual five-star rating required');
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

  private async hasMutualFiveStarMeeting(uid: string, targetUserId: string) {
    const sharedHangout = await this.db.hangout.findFirst({
      where: {
        status: HangoutStatus.FINISHED,
        AND: [
          { OR: [{ hostUserId: uid }, { joinRequests: { some: { userId: uid, status: JoinRequestStatus.ACCEPTED } } }] },
          { OR: [{ hostUserId: targetUserId }, { joinRequests: { some: { userId: targetUserId, status: JoinRequestStatus.ACCEPTED } } }] },
          { ratings: { some: { raterUserId: uid, ratedUserId: targetUserId, score: 5 } } },
          { ratings: { some: { raterUserId: targetUserId, ratedUserId: uid, score: 5 } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(sharedHangout);
  }
}
