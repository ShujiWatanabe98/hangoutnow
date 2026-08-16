import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { AuthController, UsersController } from '../src/auth/auth.controller';
import { HostStatusService } from '../src/host-status/host-status.service';
import { AuthService } from '../src/auth/auth.service';
import { AuthRepository, StoredOAuthLoginTicket, StoredPhoneVerification, StoredRefreshToken, StoredUser } from '../src/auth/auth.types';
import { SmsVerificationProvider } from '../src/auth/sms-verification.provider';
import { ImageStorageService } from '../src/storage/image-storage.service';

class MemoryAuthRepository extends AuthRepository {
  private users: StoredUser[] = [];
  private tokens: StoredRefreshToken[] = [];
  private phoneCodes: StoredPhoneVerification[] = [];
  private oauthTickets: StoredOAuthLoginTicket[] = [];
  private oauthIdentities: Array<{provider:string;subject:string;userId:string}> = [];
  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date; gender?: string }) {
    const user: StoredUser = { id: `user-${this.users.length + 1}`, ...input, birthDate: input.birthDate.toISOString().slice(0, 10), gender: input.gender??null, bio: null, homeArea: null, interests: [], verificationStatus: 'UNVERIFIED', profilePhoto: null, phoneNumber: null };
    this.users.push(user); return user;
  }
  async updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; gender?: string }) {
    const user = await this.findUserById(userId); if (!user) throw new Error('missing user'); Object.assign(user, input); return user;
  }
  async saveRefreshToken(token: StoredRefreshToken) { this.tokens.push(token); }
  async findRefreshToken(tokenHash: string) { return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null; }
  async revokeRefreshToken(id: string) { const token = this.tokens.find((item) => item.id === id); if (token) token.revokedAt = new Date(); }
  async createPhoneVerification(input: StoredPhoneVerification) { this.phoneCodes.push(input); }
  async findPhoneVerification(userId: string, phone: string) { return [...this.phoneCodes].reverse().find((item) => item.userId === userId && item.phone === phone && !item.usedAt) ?? null; }
  async failPhoneVerification(id: string) { const item=this.phoneCodes.find((row)=>row.id===id); if(item)item.attempts+=1; }
  async verifyPhone(userId: string, phone: string, verificationId: string) { const user=await this.findUserById(userId); if(!user)throw new Error(); const row=this.phoneCodes.find((item)=>item.id===verificationId); if(row)row.usedAt=new Date(); user.phoneNumber=phone;user.verificationStatus='PHONE_VERIFIED';return user; }
  async phoneVerificationCounts(userId:string,phone:string,requestIp:string,since:Date){const rows=this.phoneCodes.filter(x=>(x.createdAt??new Date())>=since);return{user:rows.filter(x=>x.userId===userId).length,phone:rows.filter(x=>x.phone===phone).length,ip:rows.filter(x=>x.requestIp===requestIp).length}}
  async deleteUser(userId:string){this.users=this.users.filter((user)=>user.id!==userId);this.tokens=this.tokens.filter((token)=>token.userId!==userId);this.phoneCodes=this.phoneCodes.filter((row)=>row.userId!==userId)}
  async findOAuthIdentity(provider:string,subject:string){const identity=this.oauthIdentities.find((item)=>item.provider===provider&&item.subject===subject);return identity?this.findUserById(identity.userId):null}
  async createOAuthIdentity(provider:string,subject:string,userId:string){this.oauthIdentities.push({provider,subject,userId})}
  async saveOAuthLoginTicket(input:StoredOAuthLoginTicket){this.oauthTickets.push(input)}
  async findOAuthLoginTicket(tokenHash:string){return this.oauthTickets.find((item)=>item.tokenHash===tokenHash)??null}
  async consumeOAuthLoginTicket(id:string){const item=this.oauthTickets.find((row)=>row.id===id);if(item)item.usedAt=new Date()}
}

describe('authentication and profile', () => {
  let app: INestApplication | undefined;
  async function createApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-that-is-long-enough-for-tests' })],
      controllers: [AuthController, UsersController],
      providers: [AuthService, AccessTokenGuard, SmsVerificationProvider, ImageStorageService, { provide: HostStatusService, useValue: { forUser: async () => ({ tier: 'BRONZE', label: 'ブロンズ' }) } }, { provide: AuthRepository, useClass: MemoryAuthRepository }],
    }).compile();
    const instance = moduleRef.createNestApplication();
    instance.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await instance.init(); return instance;
  }
  afterEach(async () => { await app?.close(); app = undefined; vi.unstubAllGlobals(); delete process.env.LINE_LOGIN_CHANNEL_ID; delete process.env.LINE_LOGIN_CHANNEL_SECRET; });

  it('registers with a verified LINE identity and rejects ticket reuse', async()=>{
    process.env.LINE_LOGIN_CHANNEL_ID='2011130010';process.env.LINE_LOGIN_CHANNEL_SECRET='test-secret';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id_token:'line-id-token'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({sub:'line-user-1',name:'LINE User',picture:'https://example.com/photo.jpg',nonce:'line-nonce'}),{status:200})));
    app=await createApp();
    const auth=app.get(AuthService);const jwt=app.get(JwtService);const state=await jwt.signAsync({kind:'line_state',returnTo:'hangoutnow://auth/line',nonce:'line-nonce'},{expiresIn:600});
    const redirect=await auth.lineCallback('authorization-code',state);const ticket=new URL(redirect).searchParams.get('ticket');expect(ticket).toBeTruthy();
    const needsProfile=await request(app.getHttpServer()).post('/auth/line/redeem').send({ticket}).expect(200);expect(needsProfile.body.registrationRequired).toBe(true);
    const registered=await request(app.getHttpServer()).post('/auth/line/redeem').send({ticket,birthDate:'1990-01-01',displayName:'LINE User',gender:'UNDISCLOSED'}).expect(200);expect(registered.body.user.displayName).toBe('LINE User');
    await request(app.getHttpServer()).post('/auth/line/redeem').send({ticket,birthDate:'1990-01-01'}).expect(401);
  },15_000);

  it('registers an adult and allows authenticated profile updates', async () => {
    app = await createApp();
    const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: 'USER@example.com', password: 'a-secure-password', displayName: 'Shuji', birthDate: '1990-01-01' }).expect(201);
    expect(registered.body.user.email).toBe('user@example.com');
    expect(registered.body.user.passwordHash).toBeUndefined();
    const profile = await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ bio: '今から走ろう', interests: ['ランニング', 'ランニング', 'AI'] }).expect(200);
    expect(profile.body.interests).toEqual(['ランニング', 'AI']);
  }, 15_000);

  it('uploads a profile photo and verifies a phone number', async () => {
    app = await createApp();
    const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: 'photo@example.com', password: 'a-secure-password', displayName: 'Photo', birthDate: '1990-01-01' }).expect(201);
    const auth = { Authorization: `Bearer ${registered.body.accessToken as string}` };
    const photo='data:image/png;base64,iVBORw0KGgo=';
    await request(app.getHttpServer()).patch('/users/me').set(auth).send({ profilePhoto: photo }).expect(200);
    const requested=await request(app.getHttpServer()).post('/users/me/phone/request').set(auth).send({phone:'+819012345678'}).expect(201);
    expect(requested.body.demoCode).toMatch(/^\d{6}$/);
    const verified=await request(app.getHttpServer()).post('/users/me/phone/confirm').set(auth).send({phone:'+819012345678',code:requested.body.demoCode}).expect(201);
    expect(verified.body.verificationStatus).toBe('PHONE_VERIFIED');
    expect(verified.body.profilePhoto).toBe(photo);
  }, 15_000);

  it('rejects minors and rotates refresh tokens', async () => {
    app = await createApp();
    const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - 17);
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'minor@example.com', password: 'a-secure-password', displayName: 'Minor', birthDate: date.toISOString().slice(0, 10) }).expect(400);
    const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: 'adult@example.com', password: 'a-secure-password', displayName: 'Adult', birthDate: '1990-01-01' }).expect(201);
    const rotated = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: registered.body.refreshToken }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(registered.body.refreshToken);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: registered.body.refreshToken }).expect(401);
  }, 15_000);

  it('deletes the authenticated account and invalidates access', async()=>{
    app=await createApp();
    const registered=await request(app.getHttpServer()).post('/auth/register').send({email:'delete@example.com',password:'a-secure-password',displayName:'Delete',birthDate:'1990-01-01'}).expect(201);
    const auth={Authorization:`Bearer ${registered.body.accessToken as string}`};
    await request(app.getHttpServer()).delete('/users/me').set(auth).expect(204);
    await request(app.getHttpServer()).get('/users/me').set(auth).expect(401);
    await request(app.getHttpServer()).post('/auth/login').send({email:'delete@example.com',password:'a-secure-password'}).expect(401);
  },15_000);

  it('protects shared demo accounts from deletion',async()=>{
    app=await createApp();
    const registered=await request(app.getHttpServer()).post('/auth/register').send({email:'shared@hangoutnow.example',password:'a-secure-password',displayName:'Shared Demo',birthDate:'1990-01-01'}).expect(201);
    await request(app.getHttpServer()).delete('/users/me').set('Authorization',`Bearer ${registered.body.accessToken as string}`).expect(403);
  },15_000);
});
