import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HangoutStatus, Prisma, ServiceArea } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

const HOST_EMAIL = 'demo-host@hangoutnow.example';
const GUEST_EMAIL = 'demo-guest@hangoutnow.example';

@Injectable()
export class DemoService {
  constructor(private readonly db: PrismaService) {}

  async reset(requesterId: string) {
    if (process.env.DEMO_MODE !== 'true') throw new ForbiddenException('Demo reset is unavailable');
    const users = await this.db.user.findMany({ where: { email: { in: [HOST_EMAIL, GUEST_EMAIL] } }, select: { id: true, email: true } });
    const requester = users.find((user) => user.id === requesterId);
    if (!requester) throw new ForbiddenException('Only public demo accounts can reset demo data');
    const host = users.find((user) => user.email === HOST_EMAIL);
    const guest = users.find((user) => user.email === GUEST_EMAIL);
    if (!host || !guest) throw new NotFoundException('Demo accounts are not ready');

    const result = await this.db.$transaction(async (transaction: Prisma.TransactionClient) => {
      await transaction.directChat.deleteMany({ where: { OR: [{ userOneId: { in: [host.id, guest.id] } }, { userTwoId: { in: [host.id, guest.id] } }] } });
      await transaction.hangout.deleteMany({ where: { hostUserId: host.id } });
      await transaction.notification.deleteMany({ where: { userId: { in: [host.id, guest.id] } } });
      const hangoutId = uuidv7();
      const hangout = await transaction.hangout.create({ data: {
        id: hangoutId, hostUserId: host.id, title: '【デモ手順】新宿カフェ交流会',
        description: '参加申請から終了、評価、1対1チャットまで順番に体験する架空のHangoutです。',
        category: 'CAFE', startAt: new Date(Date.now() + 30 * 60_000), locationName: '新宿駅周辺（デモ）',
        serviceArea: ServiceArea.SHINJUKU,
        latitude: 35.6901, longitude: 139.7005, publicLatitude: 35.69, publicLongitude: 139.7,
        maxParticipants: 4, maxAge: 39, status: HangoutStatus.OPEN,
      } });
      return hangout;
    });
    return { ok: true, hangoutId: result.id, status: 'READY', next: requester.email === HOST_EMAIL ? 'CREATE_OR_WAIT_FOR_REQUEST' : 'SEND_JOIN_REQUEST' };
  }
}
