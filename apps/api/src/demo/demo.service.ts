import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, GenderRestriction, HangoutStatus, JoinRequestStatus, Prisma, ServiceArea } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

const HOST_EMAIL = 'demo-host@hangoutnow.example';
const GUEST_EMAIL = 'demo-guest@hangoutnow.example';
const APPROVED_MEMBER_EMAIL = 'demo-masaya@hangoutnow.example';
const KENTA_EMAIL = 'demo-kenta@hangoutnow.example';
const AOI_EMAIL = 'demo-aoi@hangoutnow.example';
const DEMO_ASSET_BASE = 'https://hangoutnow-demo.onrender.com/assets';
type DemoDiscoveryTemplate = Readonly<{ title: string; category: string; serviceArea: ServiceArea; startInMinutes: number; imageAsset: string; organizerEmail: string }>;
const DEMO_DISCOVERY_TEMPLATES: readonly DemoDiscoveryTemplate[] = [
  { title: 'サヤカと新宿で気軽に飲もう', category: 'DRINKING', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'hangout-nomikai.jpg', organizerEmail: HOST_EMAIL },
  { title: '代々木公園をゆっくりランニング', category: 'RUNNING', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'demo-running-hangout-v2.jpg', organizerEmail: AOI_EMAIL },
  { title: '新宿で話題のラーメンを食べよう', category: 'FOOD', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 30, imageAsset: 'hangout-ramen.jpg', organizerEmail: HOST_EMAIL },
  { title: '夕方のショートツーリング', category: 'MOTORCYCLE', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 180, imageAsset: 'hangout-bike.jpg', organizerEmail: KENTA_EMAIL },
  { title: '渋谷のカフェでまったりしよう', category: 'CAFE', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 60, imageAsset: 'hangout-coffee.jpg', organizerEmail: KENTA_EMAIL },
  { title: '新宿でワインを楽しむ会', category: 'WINE', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'hangout-bar.jpg', organizerEmail: HOST_EMAIL },
  { title: '渋谷の落ち着いたバーへ', category: 'BAR', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 180, imageAsset: 'hangout-bar.jpg', organizerEmail: KENTA_EMAIL },
  { title: '新宿で気軽に居酒屋ごはん', category: 'IZAKAYA', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 30, imageAsset: 'hangout-nomikai.jpg', organizerEmail: AOI_EMAIL },
  { title: '寿司を食べながら交流会', category: 'SUSHI', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 180, imageAsset: 'hangout-gohan.jpg', organizerEmail: HOST_EMAIL },
  { title: '渋谷で焼肉を囲もう', category: 'YAKINIKU', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 60, imageAsset: 'hangout-yakiniku.jpg', organizerEmail: KENTA_EMAIL },
  { title: '話題のスイーツを食べよう', category: 'SWEETS', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 60, imageAsset: 'hangout-sweet.jpg', organizerEmail: AOI_EMAIL },
  { title: '新宿でカラオケ交流会', category: 'KARAOKE', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 180, imageAsset: 'hangout-karaoke.jpg', organizerEmail: HOST_EMAIL },
  { title: '渋谷でゆるくダーツ', category: 'DARTS', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 30, imageAsset: 'hangout-dartu.jpg', organizerEmail: KENTA_EMAIL },
  { title: 'ボードゲームで遊ぼう', category: 'GAME', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'hangout-boardgame.jpg', organizerEmail: AOI_EMAIL },
  { title: '映画の感想を話すカフェ会', category: 'MOVIE', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 180, imageAsset: 'hangout-movie.jpg', organizerEmail: HOST_EMAIL },
  { title: '渋谷でシーシャを楽しもう', category: 'SHISHA', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 60, imageAsset: 'hangout-si-sha.jpg', organizerEmail: KENTA_EMAIL },
  { title: '初心者向け英会話カフェ', category: 'ENGLISH', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 30, imageAsset: 'hangout-english.jpg', organizerEmail: AOI_EMAIL },
  { title: '新宿で夜ごはん仲間募集', category: 'DINNER', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'hangout-gohan.jpg', organizerEmail: HOST_EMAIL },
  { title: '渋谷をのんびり散歩', category: 'WALKING', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 180, imageAsset: 'hangout-sanpo.jpg', organizerEmail: KENTA_EMAIL },
  { title: '朝の新宿まち歩き', category: 'WALKING', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 30, imageAsset: 'hangout-sanpo.jpg', organizerEmail: AOI_EMAIL },
  { title: '朝のカフェでモーニング交流', category: 'CAFE', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'hangout-coffee.jpg', organizerEmail: AOI_EMAIL },
  { title: 'パン屋さん巡りとコーヒー', category: 'CAFE', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 180, imageAsset: 'hangout-coffee.jpg', organizerEmail: KENTA_EMAIL },
  { title: '季節のパフェを食べよう', category: 'SWEETS', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 30, imageAsset: 'hangout-sweet.jpg', organizerEmail: HOST_EMAIL },
  { title: '公園でやさしい朝ヨガ', category: 'YOGA', serviceArea: ServiceArea.SHINJUKU, startInMinutes: 60, imageAsset: 'demo-running-hangout-v2.jpg', organizerEmail: AOI_EMAIL },
  { title: '都内をのんびりサイクリング', category: 'CYCLING', serviceArea: ServiceArea.SHIBUYA, startInMinutes: 180, imageAsset: 'hangout-bike.jpg', organizerEmail: KENTA_EMAIL },
];

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
      const usersByEmail = new Map(users.map((user) => [user.email, user]));
      const createdHangouts = [];
      for (const [index, template] of DEMO_DISCOVERY_TEMPLATES.entries()) {
        const organizer = usersByEmail.get(template.organizerEmail) ?? host;
        const shinjuku = template.serviceArea === ServiceArea.SHINJUKU;
        const latitude = (shinjuku ? 35.6901 : 35.6580) + ((index % 5) - 2) * 0.001;
        const longitude = (shinjuku ? 139.7005 : 139.7016) + ((index % 4) - 1) * 0.001;
        const areaLabel = shinjuku ? '新宿' : '渋谷';
        const hangout = await transaction.hangout.create({ data: {
          id: uuidv7(), hostUserId: organizer.id, title: template.title, isDemo: true,
          imageUrl: `${DEMO_ASSET_BASE}/${template.imageAsset}`,
          description: `${template.title}。初参加歓迎の公開デモ用架空Hangoutです。`,
          category: template.category, startAt: new Date(Date.now() + template.startInMinutes * 60_000),
          publicLocationName: `${areaLabel}駅周辺（デモ）`, locationName: `デモ会場 ${areaLabel}${index + 1} 東京都${shinjuku ? '新宿区新宿3' : '渋谷区渋谷1'}-${(index % 8) + 1}-1`,
          serviceArea: template.serviceArea, latitude, longitude,
          publicLatitude: Math.round(latitude * 100) / 100, publicLongitude: Math.round(longitude * 100) / 100,
          maxParticipants: 4 + (index % 3), hostMaleCount: organizer.email === KENTA_EMAIL ? 1 : 0, hostFemaleCount: organizer.email === KENTA_EMAIL ? 0 : 1,
          genderRestriction: GenderRestriction.ANY, maxAge: index === 0 ? 39 : 59, status: HangoutStatus.OPEN,
        } });
        createdHangouts.push(hangout);
      }
      const primaryHangout = createdHangouts[0]!;
      await transaction.joinRequest.create({ data: { id: uuidv7(), hangoutId: primaryHangout.id, userId: approvedMember.id, message: '仕事帰りに参加します。よろしくお願いします！', status: JoinRequestStatus.ACCEPTED, attendanceStatus: AttendanceStatus.CONFIRMED, attendanceUpdatedAt: new Date() } });
      await transaction.chatRoom.create({ data: { id: uuidv7(), hangoutId: primaryHangout.id } });
      return primaryHangout;
    });
    return { ok: true, hangoutId: result.id, catalogSize: DEMO_DISCOVERY_TEMPLATES.length, status: 'READY', next: requester.email === HOST_EMAIL ? 'CREATE_OR_WAIT_FOR_REQUEST' : 'SEND_JOIN_REQUEST' };
  }
}
