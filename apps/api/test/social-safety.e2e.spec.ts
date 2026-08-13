import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { ChatController } from '../src/chat/chat.controller';
import { ChatService } from '../src/chat/chat.service';
import { HangoutController, JoinRequestController } from '../src/hangouts/hangout.controller';
import { CreateHangoutDto } from '../src/hangouts/hangout.dto';
import { HangoutService } from '../src/hangouts/hangout.service';
import { HostStatusService } from '../src/host-status/host-status.service';
import { NotificationController } from '../src/notifications/notification.controller';
import { NotificationSettingsDto } from '../src/notifications/notification.dto';
import { NotificationService } from '../src/notifications/notification.service';
import { RealtimeGateway } from '../src/notifications/realtime.gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { SafetyController } from '../src/safety/safety.controller';
import { SafetyService } from '../src/safety/safety.service';
import { StampService } from '../src/stamps/stamp.service';

type Verification = 'UNVERIFIED' | 'PHONE_VERIFIED';
type HangoutStatus = 'OPEN' | 'FULL' | 'STARTED' | 'FINISHED' | 'CANCELLED';
type JoinStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

interface TestUser {
  id: string;
  email: string;
  displayName: string;
  verification: Verification;
  profilePhoto: string | null;
  notificationsEnabled: boolean;
  birthDate: Date;
  gender: 'MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED';
}

interface TestHangout {
  id: string;
  hostUserId: string;
  title: string;
  description?: string;
  category: string;
  serviceArea: 'SHINJUKU'|'SHIBUYA';
  startAt: Date;
  locationName: string;
  publicLocationName: string;
  latitude: number | null;
  longitude: number | null;
  publicLatitude: number | null;
  publicLongitude: number | null;
  maxParticipants: number;
  genderRestriction: 'ANY'|'MALE_ONLY'|'FEMALE_ONLY';
  maxAge: number | null;
  status: HangoutStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface TestJoinRequest {
  id: string;
  hangoutId: string;
  userId: string;
  message?: string;
  status: JoinStatus;
  attendanceStatus?: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | null;
  attendanceUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestBlock { id: string; blockerId: string; blockedId: string; createdAt: Date }
interface TestRoom { id: string; hangoutId: string; createdAt: Date }
interface TestMessage { id: string; roomId: string; senderUserId: string; body: string; createdAt: Date }
interface TestNotification { id: string; userId: string; type: string; title: string; body: string; link?: string; eventKey?: string; readAt: Date | null; createdAt: Date }
interface TestReport { id: string; reporterId: string; targetUserId: string; hangoutId?: string; reason: string; details?: string; status: 'OPEN'; createdAt: Date }

interface WhereId { where: { id: string }; select?: Record<string, boolean>; include?: unknown }
interface BlockWhere { OR?: Array<{ blockerId?: string; blockedId?: string }>; blockerId?: string; blockedId?: string }

class MemorySocialDb {
  readonly users: TestUser[] = [
    { id: 'host', email: 'host@example.com', displayName: 'Host', verification: 'PHONE_VERIFIED', profilePhoto: 'host-photo', notificationsEnabled: true, birthDate:new Date('1990-01-01'), gender:'MALE' },
    { id: 'guest', email: 'guest@example.com', displayName: 'Guest', verification: 'PHONE_VERIFIED', profilePhoto: 'guest-photo', notificationsEnabled: true, birthDate:new Date('2000-01-01'), gender:'FEMALE' },
    { id: 'outsider', email: 'outsider@example.com', displayName: 'Outsider', verification: 'PHONE_VERIFIED', profilePhoto: 'outsider-photo', notificationsEnabled: true, birthDate:new Date('1980-01-01'), gender:'OTHER' },
    { id: 'waiter', email: 'waiter@example.com', displayName: 'Waiter', verification: 'PHONE_VERIFIED', profilePhoto: 'waiter-photo', notificationsEnabled: true, birthDate:new Date('1995-01-01'), gender:'OTHER' },
  ];
  readonly hangouts: TestHangout[] = [];
  readonly joinRequests: TestJoinRequest[] = [];
  readonly blocks: TestBlock[] = [];
  readonly rooms: TestRoom[] = [];
  readonly messages: TestMessage[] = [];
  readonly notifications: TestNotification[] = [];
  readonly reports: TestReport[] = [];

  readonly user: {
    findUnique: (query: WhereId) => Promise<TestUser | null>;
    update: (query: { where: { id: string }; data: { notificationsEnabled?: boolean } }) => Promise<TestUser>;
  };

  constructor() {
    this.user = {
      findUnique: async (query) => this.users.find((item) => item.id === query.where.id) ?? null,
      update: async (query) => {
        const user = this.users.find((item) => item.id === query.where.id);
        if (!user) throw new Error('User not found');
        if (query.data.notificationsEnabled !== undefined) user.notificationsEnabled = query.data.notificationsEnabled;
        return user;
      },
    };
  }

  readonly block = {
    findMany: async (query: { where: BlockWhere }) => this.blocks.filter((item) => this.matchesBlock(item, query.where)),
    findFirst: async (query: { where: BlockWhere }) => this.blocks.find((item) => this.matchesBlock(item, query.where)) ?? null,
    upsert: async (query: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } }; create: TestBlock }) => {
      const key = query.where.blockerId_blockedId;
      const existing = this.blocks.find((item) => item.blockerId === key.blockerId && item.blockedId === key.blockedId);
      if (existing) return existing;
      this.blocks.push(query.create);
      return query.create;
    },
    deleteMany: async (query: { where: { blockerId: string; blockedId: string } }) => {
      const before = this.blocks.length;
      this.removeWhere(this.blocks, (item) => item.blockerId === query.where.blockerId && item.blockedId === query.where.blockedId);
      return { count: before - this.blocks.length };
    },
  };

  readonly hangout = {
    create: async (query: { data: Omit<TestHangout, 'status' | 'createdAt' | 'updatedAt'> }) => {
      const now = new Date();
      const row: TestHangout = { ...query.data, status: 'OPEN', createdAt: now, updatedAt: now };
      this.hangouts.push(row);
      return this.hangoutView(row, query.data.hostUserId);
    },
    findUnique: async (query: WhereId) => {
      const row = this.hangouts.find((item) => item.id === query.where.id);
      if (!row) return null;
      if (!query.include) return row;
      return this.hangoutView(row);
    },
    findMany: async (query: { where?: { hostUserId?: { notIn: string[] }; status?: { in: HangoutStatus[] }; startAt?: { gt?: Date; lte?: Date } }; include?: unknown }) => {
      const rows = this.hangouts.filter((item) => {
        if (query.where?.hostUserId?.notIn.includes(item.hostUserId)) return false;
        if (query.where?.status && !query.where.status.in.includes(item.status)) return false;
        if (query.where?.startAt?.gt && item.startAt <= query.where.startAt.gt) return false;
        if (query.where?.startAt?.lte && item.startAt > query.where.startAt.lte) return false;
        return true;
      });
      return rows.map((row) => this.hangoutView(row));
    },
    update: async (query: { where: { id: string }; data: Partial<TestHangout> }) => {
      const row = this.requireHangout(query.where.id);
      Object.assign(row, query.data, { updatedAt: new Date() });
      return row;
    },
  };

  readonly joinRequest = {
    create: async (query: { data: Omit<TestJoinRequest, 'createdAt' | 'updatedAt'> & { status?: JoinStatus } }) => {
      if (this.joinRequests.some((item) => item.hangoutId === query.data.hangoutId && item.userId === query.data.userId)) throw new Error('duplicate');
      const now = new Date();
      const row: TestJoinRequest = { ...query.data, status: query.data.status ?? 'PENDING', createdAt: now, updatedAt: now };
      this.joinRequests.push(row);
      return { ...row, user: this.publicUser(query.data.userId) };
    },
    findUnique: async (query: WhereId) => {
      const row = this.joinRequests.find((item) => item.id === query.where.id);
      if (!row) return null;
      const hangout = this.hangoutView(this.requireHangout(row.hangoutId), row.userId);
      return { ...row, hangout: { ...hangout, joinRequests: this.joinRequests.filter((item) => item.hangoutId === row.hangoutId && item.status === 'ACCEPTED') } };
    },
    findMany: async (query: { where: { hangoutId: string } }) => this.joinRequests
      .filter((item) => item.hangoutId === query.where.hangoutId)
      .map((item) => ({ ...item, user: this.publicUser(item.userId) })),
    findFirst: async (query: { where: { hangoutId: string; status: JoinStatus }; orderBy: { createdAt: 'asc' } }) => this.joinRequests
      .filter((item) => item.hangoutId === query.where.hangoutId && item.status === query.where.status)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null,
    update: async (query: { where: { id: string }; data: Partial<TestJoinRequest> }) => {
      const row = this.joinRequests.find((item) => item.id === query.where.id);
      if (!row) throw new Error('Join request not found');
      Object.assign(row, query.data);
      row.updatedAt = new Date();
      return row;
    },
  };

  readonly chatRoom = {
    upsert: async (query: { where: { hangoutId: string }; create: TestRoom }) => {
      const existing = this.rooms.find((item) => item.hangoutId === query.where.hangoutId);
      if (existing) return existing;
      this.rooms.push(query.create);
      return query.create;
    },
    findUnique: async (query: WhereId) => {
      const room = this.rooms.find((item) => item.id === query.where.id);
      if (!room) return null;
      return { ...room, hangout: this.hangoutView(this.requireHangout(room.hangoutId)) };
    },
    findMany: async (query: { where: { OR: Array<{ hangout: { hostUserId?: string; joinRequests?: { some: { userId: string; status: JoinStatus } } } }> } }) => {
      const userId = query.where.OR[0]?.hangout.hostUserId ?? query.where.OR[1]?.hangout.joinRequests?.some.userId;
      return this.rooms.filter((room) => {
        const hangout = this.requireHangout(room.hangoutId);
        return hangout.hostUserId === userId || this.joinRequests.some((item) => item.hangoutId === hangout.id && item.userId === userId && item.status === 'ACCEPTED');
      }).map((room) => ({ ...room, hangout: { ...this.hangoutView(this.requireHangout(room.hangoutId)), host: this.publicUser(this.requireHangout(room.hangoutId).hostUserId) }, messages: [] }));
    },
  };

  readonly message = {
    create: async (query: { data: Omit<TestMessage, 'createdAt'> }) => {
      const row: TestMessage = { ...query.data, createdAt: new Date() };
      this.messages.push(row);
      return { ...row, sender: this.publicUser(row.senderUserId) };
    },
    findMany: async (query: { where: { roomId: string } }) => this.messages
      .filter((item) => item.roomId === query.where.roomId)
      .map((item) => ({ ...item, sender: this.publicUser(item.senderUserId) })),
  };

  readonly notification = {
    create: async (query: { data: Omit<TestNotification, 'readAt' | 'createdAt'> }) => {
      if (query.data.eventKey && this.notifications.some((item) => item.eventKey === query.data.eventKey)) throw new Error('duplicate');
      const row: TestNotification = { ...query.data, readAt: null, createdAt: new Date() };
      this.notifications.push(row);
      return row;
    },
    findMany: async (query: { where: { userId: string } }) => this.notifications.filter((item) => item.userId === query.where.userId),
    count: async (query: { where: { userId: string; readAt: null } }) => this.notifications.filter((item) => item.userId === query.where.userId && item.readAt === null).length,
    updateMany: async (query: { where: { id?: string; userId: string; readAt?: null }; data: { readAt: Date } }) => {
      let count = 0;
      for (const item of this.notifications) {
        if (item.userId === query.where.userId && (!query.where.id || item.id === query.where.id) && (query.where.readAt !== null || item.readAt === null)) {
          item.readAt = query.data.readAt;
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly report = {
    create: async (query: { data: Omit<TestReport, 'status' | 'createdAt'> }) => {
      if (this.reports.some((item) => item.reporterId === query.data.reporterId && item.targetUserId === query.data.targetUserId && item.hangoutId === query.data.hangoutId)) throw new Error('duplicate');
      const row: TestReport = { ...query.data, status: 'OPEN', createdAt: new Date() };
      this.reports.push(row);
      return row;
    },
  };

  async $transaction<T>(operation: (transaction: MemorySocialDb) => Promise<T>): Promise<T> { return operation(this); }

  private publicUser(id: string) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new Error('User not found');
    return { id: user.id, displayName: user.displayName, verification: user.verification, profilePhoto: user.profilePhoto };
  }

  private requireHangout(id: string): TestHangout {
    const row = this.hangouts.find((item) => item.id === id);
    if (!row) throw new Error('Hangout not found');
    return row;
  }

  private hangoutView(row: TestHangout, requestingUserId?: string) {
    const requests = this.joinRequests
      .filter((item) => item.hangoutId === row.id && (item.status === 'ACCEPTED' || item.userId === requestingUserId || requestingUserId === undefined))
      .map((item) => ({ userId: item.userId, status: item.status }));
    return { ...row, host: this.publicUser(row.hostUserId), joinRequests: requests };
  }

  private matchesBlock(item: TestBlock, where: BlockWhere): boolean {
    if (where.blockerId && item.blockerId !== where.blockerId) return false;
    if (where.blockedId && item.blockedId !== where.blockedId) return false;
    if (!where.OR) return true;
    return where.OR.some((part) => (!part.blockerId || part.blockerId === item.blockerId) && (!part.blockedId || part.blockedId === item.blockedId));
  }

  private removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item !== undefined && predicate(item)) items.splice(index, 1);
    }
  }
}

class TestAuthService {
  verifyAccessToken(token: string): { sub: string } {
    if (!['host', 'guest', 'outsider', 'waiter'].includes(token)) throw new Error('invalid token');
    return { sub: token };
  }
}

class TestRealtimeGateway { send(): void {} }

describe('social journey safety boundaries', () => {
  let app: INestApplication;
  let db: MemorySocialDb;
  const auth = (userId: string) => ({ Authorization: `Bearer ${userId}` });

  beforeEach(async () => {
    db = new MemorySocialDb();
    const moduleRef = await Test.createTestingModule({
      controllers: [HangoutController, JoinRequestController, ChatController, SafetyController, NotificationController],
      providers: [
        HangoutService,
        { provide: HostStatusService, useValue: { forUser: async () => ({ tier: 'BRONZE', label: 'ブロンズ' }), forUsers: async (ids: string[]) => new Map(ids.map((id) => [id, { tier: 'BRONZE', label: 'ブロンズ' }])) } },
        ChatService,
        { provide: StampService, useValue: { payload: async ()=>'__STAMP__{}' } },
        SafetyService,
        NotificationService,
        AccessTokenGuard,
        { provide: PrismaService, useValue: db as unknown as PrismaService },
        { provide: AuthService, useClass: TestAuthService },
        { provide: RealtimeGateway, useClass: TestRealtimeGateway },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  async function createHangout(): Promise<string> {
    const response = await request(app.getHttpServer()).post('/hangouts').set(auth('host')).send({
      title: '新宿でコーヒー', category: 'CAFE', serviceArea: 'SHINJUKU', startInMinutes: 60, publicLocationName: '新宿駅周辺', locationName: 'カフェ新宿店 東京都新宿区新宿1-2-3',
      latitude: 35.691234, longitude: 139.704567, maxParticipants: 3,
    }).expect(201);
    return response.body.id as string;
  }

  it('rejects unauthenticated access and invalid Hangout DTO input', async () => {
    await request(app.getHttpServer()).get('/hangouts').expect(401);
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({
      title: 'Invalid', category: 'CAFE', startInMinutes: 15, publicLocationName: '新宿駅周辺', locationName: 'Secret', latitude: 91, longitude: 200, maxParticipants: 1, unexpected: 'field',
    }, { type: 'body', metatype: CreateHangoutDto })).rejects.toMatchObject({ status: 400 });
    await request(app.getHttpServer()).post('/hangouts').set(auth('host')).send({
      title: '人数不正', category: 'CAFE', serviceArea: 'SHINJUKU', startInMinutes: 30,
      publicLocationName: '新宿駅周辺', locationName: '新宿の店舗', maxParticipants: 1, hostMaleCount: 2, hostFemaleCount: 0,
    }).expect(400);
  });

  it('hides the exact venue, address, and coordinates until the host accepts the join request', async () => {
    const hangoutId = await createHangout();
    const before = await request(app.getHttpServer()).get(`/hangouts/${hangoutId}`).set(auth('guest')).expect(200);
    expect(before.body.locationPrecision).toBe('APPROXIMATE');
    expect(before.body.latitude).toBeUndefined();
    expect(before.body.longitude).toBeUndefined();
    expect(before.body.locationName).toBe('新宿駅周辺');
    expect(before.body.publicLatitude).toBe(35.69);
    expect(before.body.publicLongitude).toBe(139.7);

    const joined = await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('guest')).send({ message: '参加したいです' }).expect(201);
    await request(app.getHttpServer()).post(`/join-requests/${joined.body.id as string}/accept`).set(auth('guest')).expect(403);
    await request(app.getHttpServer()).get(`/hangouts/${hangoutId}/requests`).set(auth('outsider')).expect(403);
    await request(app.getHttpServer()).post(`/join-requests/${joined.body.id as string}/accept`).set(auth('host')).expect(201);

    const after = await request(app.getHttpServer()).get(`/hangouts/${hangoutId}`).set(auth('guest')).expect(200);
    expect(after.body.locationPrecision).toBe('EXACT');
    expect(after.body.latitude).toBe(35.691234);
    expect(after.body.longitude).toBe(139.704567);
    expect(after.body.locationName).toBe('カフェ新宿店 東京都新宿区新宿1-2-3');

    const outsider = await request(app.getHttpServer()).get(`/hangouts/${hangoutId}`).set(auth('outsider')).expect(200);
    expect(outsider.body.locationPrecision).toBe('APPROXIMATE');
    expect(outsider.body.latitude).toBeUndefined();
    expect(outsider.body.locationName).toBe('新宿駅周辺');
  });

  it('waitlists a full Hangout and safely reopens a slot after attendance cancellation', async () => {
    const response = await request(app.getHttpServer()).post('/hangouts').set(auth('host')).send({
      title: '新宿ランニング', category: 'RUNNING', serviceArea: 'SHINJUKU', startInMinutes: 60,
      publicLocationName: '新宿駅周辺', locationName: '新宿サンプル店 東京都新宿区新宿2-3-4', maxParticipants: 3,
    }).expect(201);
    const hangoutId = response.body.id as string;
    const joined = await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('guest')).send({ message: '参加したいです' }).expect(201);
    await request(app.getHttpServer()).post(`/join-requests/${joined.body.id as string}/accept`).set(auth('host')).expect(201);
    const second = await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('outsider')).send({ message: 'よろしくお願いします' }).expect(201);
    await request(app.getHttpServer()).post(`/join-requests/${second.body.id as string}/accept`).set(auth('host')).expect(201);
    const waiting = await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('waiter')).send({ message: '空きが出たら参加したいです' }).expect(201);
    expect(waiting.body.status).toBe('WAITLISTED');
    await request(app.getHttpServer()).patch(`/join-requests/${joined.body.id as string}/attendance`).set(auth('guest')).send({ status: 'CONFIRMED' }).expect(200);
    await request(app.getHttpServer()).patch(`/join-requests/${joined.body.id as string}/attendance`).set(auth('outsider')).send({ status: 'CANCELLED' }).expect(403);
    await request(app.getHttpServer()).patch(`/join-requests/${joined.body.id as string}/attendance`).set(auth('guest')).send({ status: 'CANCELLED' }).expect(200);
    expect(db.hangouts[0]?.status).toBe('OPEN');
    expect(db.joinRequests.find((item) => item.id === joined.body.id)?.status).toBe('CANCELLED');
    expect(db.notifications.some((item) => item.userId === 'waiter' && item.type === 'WAITLIST_OPEN')).toBe(true);
  });

  it('enforces gender and age participation conditions on the API', async () => {
    const response = await request(app.getHttpServer()).post('/hangouts').set(auth('host')).send({
      title: '20代女性限定カフェ', category: 'CAFE', serviceArea: 'SHINJUKU', startInMinutes: 60, publicLocationName: '新宿駅周辺', locationName: '新宿カフェ 東京都新宿区新宿3-4-5',
      maxParticipants: 3, genderRestriction: 'FEMALE_ONLY', maxAge: 29,
    }).expect(201);
    const hangoutId = response.body.id as string;
    await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('guest')).send({ message: '参加希望です' }).expect(201);
    await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('outsider')).send({ message: '参加希望です' }).expect(403);
  });

  it('keeps early finish restricted except for an identified public demo account in demo mode', async () => {
    const hangoutId = await createHangout();
    await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/finish`).set(auth('host')).send({}).expect(409);
    const originalDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    db.users[0]!.email = 'demo-host@hangoutnow.example';
    try {
      await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/finish`).set(auth('host')).send({}).expect(201);
      expect(db.hangouts[0]?.status).toBe('FINISHED');
    } finally {
      if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
      else process.env.DEMO_MODE = originalDemoMode;
    }
  });

  it('restricts chat to accepted members and revokes access after blocking the host', async () => {
    const hangoutId = await createHangout();
    const joined = await request(app.getHttpServer()).post(`/hangouts/${hangoutId}/join`).set(auth('guest')).send({}).expect(201);
    await request(app.getHttpServer()).post(`/join-requests/${joined.body.id as string}/accept`).set(auth('host')).expect(201);
    const roomId = db.rooms[0]?.id;
    expect(roomId).toBeTruthy();

    await request(app.getHttpServer()).get(`/chat-rooms/${roomId}/messages`).set(auth('outsider')).expect(403);
    await request(app.getHttpServer()).post(`/chat-rooms/${roomId}/messages`).set(auth('host')).send({ body: '承認しました。よろしくお願いします' }).expect(201);
    await request(app.getHttpServer()).post(`/chat-rooms/${roomId}/messages`).set(auth('guest')).send({ body: '向かっています' }).expect(201);
    await request(app.getHttpServer()).post('/safety/blocks/host').set(auth('guest')).expect(201);
    await request(app.getHttpServer()).get(`/chat-rooms/${roomId}/messages`).set(auth('guest')).expect(403);

    const visible = await request(app.getHttpServer()).get('/hangouts').set(auth('guest')).expect(200);
    expect(visible.body).toEqual([]);
  });

  it('stores one report, optionally blocks, and rejects duplicate reports', async () => {
    const hangoutId = await createHangout();
    const report = { targetUserId: 'host', hangoutId, reason: 'DANGEROUS', details: '公共場所ではない場所を指定された', blockUser: true };
    await request(app.getHttpServer()).post('/safety/reports').set(auth('outsider')).send(report).expect(201);
    await request(app.getHttpServer()).post('/safety/reports').set(auth('outsider')).send(report).expect(409);
    expect(db.reports).toHaveLength(1);
    expect(db.blocks.some((item) => item.blockerId === 'outsider' && item.blockedId === 'host')).toBe(true);
  });

  it('honors notification settings and its DTO rejects unknown fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ enabled: false, leak: 'not allowed' }, { type: 'body', metatype: NotificationSettingsDto })).rejects.toMatchObject({ status: 400 });
    await request(app.getHttpServer()).patch('/notifications/settings').set(auth('guest')).send({ enabled: false }).expect(200);
    const inbox = await request(app.getHttpServer()).get('/notifications').set(auth('guest')).expect(200);
    expect(inbox.body.enabled).toBe(false);
  });
});
