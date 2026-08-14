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

  async reset(requesterId: string) {
    if (process.env.DEMO_MODE !== 'true') throw new ForbiddenException('Demo reset is unavailable');
    const users = await this.db.user.findMany({ where: { email: { in: [HOST_EMAIL, GUEST_EMAIL, APPROVED_MEMBER_EMAIL] } }, select: { id: true, email: true } });
    const requester = users.find((user) => user.id === requesterId);
    if (!requester) throw new ForbiddenException('Only public demo accounts can reset demo data');
    const host = users.find((user) => user.email === HOST_EMAIL);
    const guest = users.find((user) => user.email === GUEST_EMAIL);
    const approvedMember = users.find((user) => user.email === APPROVED_MEMBER_EMAIL);
    if (!host || !guest || !approvedMember) throw new NotFoundException('Demo accounts are not ready');

    const result = await this.db.$transaction(async (transaction: Prisma.TransactionClient) => {
      const demoUserIds = [host.id, guest.id, approvedMember.id];
      await transaction.directChat.deleteMany({ where: { OR: [{ userOneId: { in: demoUserIds } }, { userTwoId: { in: demoUserIds } }] } });
      await transaction.hangout.deleteMany({ where: { hostUserId: host.id } });
      await transaction.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
      const hangoutId = uuidv7();
      const hangout = await transaction.hangout.create({ data: {
        id: hangoutId, hostUserId: host.id, title: 'マミと新宿で気軽に飲もう',
        imageUrl: 'https://hangoutnow-demo.onrender.com/assets/demo-drinking-hangout.jpg',
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
