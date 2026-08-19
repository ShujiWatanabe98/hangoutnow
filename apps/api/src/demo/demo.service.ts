import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, HangoutStatus, JoinRequestStatus, Prisma, ServiceArea } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

const HOST_EMAIL = 'demo-host@hangoutnow.example';
const GUEST_EMAIL = 'demo-guest@hangoutnow.example';
const APPROVED_MEMBER_EMAIL = 'demo-masaya@hangoutnow.example';

@Injectable()
export class DemoService {
  constructor(private readonly db: PrismaService) {}

  async seedWeekHistory(requesterId: string) {
    if (process.env.DEMO_MODE !== 'true') throw new ForbiddenException('Demo history seed is unavailable');
    const users = await this.db.user.findMany({ where: { email: { in: [HOST_EMAIL, GUEST_EMAIL] } }, select: { id: true, email: true } });
    const host = users.find((user) => user.email === HOST_EMAIL);
    const guest = users.find((user) => user.email === GUEST_EMAIL);
    if (!host || !guest) throw new NotFoundException('Demo accounts are not ready');
    if (![host.id, guest.id].includes(requesterId)) throw new ForbiddenException('Only public demo accounts can seed demo history');

    const activities = [
      ['新宿でカフェ巡り', 'CAFE', ServiceArea.SHINJUKU, '新宿駅周辺'],
      ['代々木公園を朝散歩', 'WALKING', ServiceArea.SHINJUKU, '代々木公園周辺'],
      ['渋谷で気軽にランチ', 'FOOD', ServiceArea.SHIBUYA, '渋谷駅周辺'],
      ['仕事帰りに一杯', 'DRINKING', ServiceArea.SHINJUKU, '新宿三丁目周辺'],
      ['お気に入り映画を語ろう', 'MOVIE', ServiceArea.SHIBUYA, '渋谷駅周辺'],
      ['ゆっくり5kmランニング', 'RUNNING', ServiceArea.SHINJUKU, '代々木公園周辺'],
      ['週末のモーニング', 'CAFE', ServiceArea.SHIBUYA, '渋谷駅周辺'],
    ] as const;

    const ids = await this.db.$transaction(async (transaction: Prisma.TransactionClient) => {
      await transaction.hangout.deleteMany({ where: { hostUserId: { in: [host.id, guest.id] }, title: { startsWith: '[1週間デモ]' } } });
      const createdIds: string[] = [];
      for (const [index, activity] of activities.entries()) {
        const [title, category, serviceArea, publicLocationName] = activity;
        const organizer = index % 2 === 0 ? host : guest;
        const participant = organizer.id === host.id ? guest : host;
        const hangoutId = uuidv7();
        const startAt = new Date();
        startAt.setDate(startAt.getDate() - (7 - index));
        startAt.setHours(19, 0, 0, 0);
        await transaction.hangout.create({ data: {
          id: hangoutId, hostUserId: organizer.id, title: `[1週間デモ] ${title}`,
          isDemo: true,
          description: 'サヤカとマドカが参加した架空の過去Hangoutです。', category, serviceArea, startAt,
          publicLocationName, locationName: `${publicLocationName}のデモ店舗`, maxParticipants: 4,
          hostMaleCount: 0, hostFemaleCount: 1, status: HangoutStatus.FINISHED,
          joinRequests: { create: { id: uuidv7(), userId: participant.id, message: '参加しました', status: JoinRequestStatus.ACCEPTED, attendanceStatus: AttendanceStatus.CONFIRMED, attendanceUpdatedAt: startAt } },
          chatRoom: { create: { id: uuidv7(), messages: { create: [
            { id: uuidv7(), senderUserId: participant.id, body: '参加できるのを楽しみにしています。よろしくお願いします！' },
            { id: uuidv7(), senderUserId: organizer.id, body: 'ありがとうございます。当日は気をつけてお越しください。' },
          ] } } },
          ratings: { create: [
            { id: uuidv7(), raterUserId: organizer.id, ratedUserId: participant.id, score: 5 },
            { id: uuidv7(), raterUserId: participant.id, ratedUserId: organizer.id, score: 5 },
          ] },
        } });
        createdIds.push(hangoutId);
      }
      return createdIds;
    });
    return { ok: true, days: ids.length, hangoutIds: ids, mutualRating: 5 };
  }

  async reset(requesterId: string) {
    if (process.env.DEMO_MODE !== 'true') throw new ForbiddenException('Demo reset is unavailable');
    const users = await this.db.user.findMany({ where: { email: { endsWith: '@hangoutnow.example' } }, select: { id: true, email: true } });
    const requester = users.find((user) => user.id === requesterId);
    if (!requester) throw new ForbiddenException('Only public demo accounts can reset demo data');
    const host = users.find((user) => user.email === HOST_EMAIL);
    const guest = users.find((user) => user.email === GUEST_EMAIL);
    const approvedMember = users.find((user) => user.email === APPROVED_MEMBER_EMAIL);
    if (!host || !guest || !approvedMember) throw new NotFoundException('Demo accounts are not ready');

    const result = await this.db.$transaction(async (transaction: Prisma.TransactionClient) => {
      const demoUserIds = users.map((user) => user.id);
      await transaction.message.deleteMany({ where: { OR: [
        { senderUserId: { in: demoUserIds } },
        { room: { hangout: { OR: [{ isDemo: true }, { hostUserId: { in: demoUserIds } }] } } },
      ] } });
      await transaction.directMessage.deleteMany({ where: { directChat: { OR: [{ userOneId: { in: demoUserIds } }, { userTwoId: { in: demoUserIds } }] } } });
      await transaction.directChat.deleteMany({ where: { OR: [{ userOneId: { in: demoUserIds } }, { userTwoId: { in: demoUserIds } }] } });
      await transaction.hangoutRating.deleteMany({ where: { OR: [{ raterUserId: { in: demoUserIds } }, { ratedUserId: { in: demoUserIds } }] } });
      await transaction.matchFeedback.deleteMany({ where: { userId: { in: demoUserIds } } });
      await transaction.hangoutHeart.deleteMany({ where: { userId: { in: demoUserIds } } });
      await transaction.funnelEvent.deleteMany({ where: { userId: { in: demoUserIds } } });
      await transaction.joinRequest.deleteMany({ where: { userId: { in: demoUserIds } } });
      await transaction.hangout.deleteMany({ where: { OR: [{ isDemo: true }, { hostUserId: { in: demoUserIds } }] } });
      await transaction.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
      const hangoutId = uuidv7();
      const hangout = await transaction.hangout.create({ data: {
        id: hangoutId, hostUserId: host.id, title: 'サヤカと新宿で気軽に飲もう',
        isDemo: true,
        imageUrl: 'https://hangoutnow-demo.onrender.com/assets/demo-drinking-hangout-v2.jpg',
        description: '仕事帰りに気軽に乾杯する、公開デモ用の架空の飲み会です。初参加も歓迎します。',
        category: 'DRINKING', startAt: new Date(Date.now() + 60 * 60_000), publicLocationName: '新宿駅東口周辺（デモ）', locationName: 'デモ居酒屋 新宿店 東京都新宿区新宿3-1-1',
        serviceArea: ServiceArea.SHINJUKU,
        latitude: 35.6901, longitude: 139.7005, publicLatitude: 35.69, publicLongitude: 139.7,
        maxParticipants: 4, hostMaleCount: 0, hostFemaleCount: 1, maxAge: 39, status: HangoutStatus.OPEN,
      } });
      await transaction.joinRequest.create({ data: { id: uuidv7(), hangoutId, userId: approvedMember.id, message: '仕事帰りに参加します。よろしくお願いします！', status: JoinRequestStatus.ACCEPTED, attendanceStatus: AttendanceStatus.CONFIRMED, attendanceUpdatedAt: new Date() } });
      await transaction.chatRoom.create({ data: { id: uuidv7(), hangoutId } });
      return hangout;
    });
    return { ok: true, hangoutId: result.id, status: 'READY', next: requester.email === HOST_EMAIL ? 'CREATE_OR_WAIT_FOR_REQUEST' : 'SEND_JOIN_REQUEST' };
  }
}
