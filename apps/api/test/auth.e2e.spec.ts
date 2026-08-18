import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { exportJWK, exportPKCS8, generateKeyPair, SignJWT } from 'jose';
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
  async findUserByPhone(phone:string){return this.users.find((user)=>user.phoneNumber===phone)??null}
  async createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date | null; gender?: string }) {
    const user: StoredUser = { id: `user-${this.users.length + 1}`, ...input, birthDate: input.birthDate?.toISOString().slice(0, 10) ?? null, gender: input.gender??null, bio: null, homeArea: null, preferredAreas: [], preferredActivities: [], preferredAgeMin: null, preferredAgeMax: null, preferredGenders: [], activityTimeSlots: [], matchingDataConsent: false, participationUrgency: null, maxTravelMinutes: null, preferredGroupSizes: [], budgetMin: null, budgetMax: null, interests: [], verificationStatus: 'UNVERIFIED', profilePhoto: null, profilePhotos: [], phoneNumber: null };
    this.users.push(user); return user;
  }
  async updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; profilePhotos?: string[]; gender?: string; preferredAreas?: string[]; preferredActivities?: string[]; preferredAgeMin?: number | null; preferredAgeMax?: number | null; preferredGenders?: string[]; activityTimeSlots?: string[]; matchingDataConsent?: boolean; participationUrgency?: string | null; maxTravelMinutes?: number | null; preferredGroupSizes?: number[]; budgetMin?: number | null; budgetMax?: number | null }) {
    const user = await this.findUserById(userId); if (!user) throw new Error('missing user'); Object.assign(user, input); return user;
  }
  async saveRefreshToken(token: StoredRefreshToken) { this.tokens.push(token); }
  async findRefreshToken(tokenHash: string) { return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null; }
  async revokeRefreshToken(id: string) { const token = this.tokens.find((item) => item.id === id); if (token) token.revokedAt = new Date(); }
  async createPhoneVerification(input: StoredPhoneVerification) { this.phoneCodes.push(input); }
  async findPhoneVerification(userId: string, phone: string) { return [...this.phoneCodes].reverse().find((item) => item.userId === userId && item.phone === phone && !item.usedAt) ?? null; }
  async failPhoneVerification(id: string) { const item=this.phoneCodes.find((row)=>row.id===id); if(item)item.attempts+=1; }
  async verifyPhone(userId: string, phone: string, verificationId: string) { const user=await this.findUserById(userId); if(!user)throw new Error(); const row=this.phoneCodes.find((item)=>item.id===verificationId); if(row)row.usedAt=new Date(); user.phoneNumber=phone;user.verificationStatus='PHONE_VERIFIED';return user; }
  async setVerifiedPhone(userId:string,phone:string){const user=await this.findUserById(userId);if(!user)throw new Error();user.phoneNumber=phone;user.verificationStatus='PHONE_VERIFIED';return user}
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
  afterEach(async () => { await app?.close(); app = undefined; vi.unstubAllGlobals(); delete process.env.LINE_LOGIN_CHANNEL_ID; delete process.env.LINE_LOGIN_CHANNEL_SECRET; delete process.env.GOOGLE_LOGIN_CLIENT_ID; delete process.env.GOOGLE_LOGIN_CLIENT_SECRET; delete process.env.APPLE_LOGIN_CLIENT_ID; delete process.env.APPLE_TEAM_ID; delete process.env.APPLE_KEY_ID; delete process.env.APPLE_PRIVATE_KEY; delete process.env.X_LOGIN_CLIENT_ID; delete process.env.X_LOGIN_CLIENT_SECRET; });

  it('logs in both public demo roles through the dedicated endpoint', async () => {
    app = await createApp();
    const password = 'HangoutNow-Demo-2026!';
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'demo-host@hangoutnow.example', password, displayName: 'マミ', birthDate: '1990-01-01', gender: 'FEMALE' }).expect(201);
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'demo-guest@hangoutnow.example', password, displayName: 'マドカ', birthDate: '1991-01-01', gender: 'FEMALE' }).expect(201);
    const host = await request(app.getHttpServer()).post('/auth/demo-login').send({ role: 'host' }).expect(200);
    const guest = await request(app.getHttpServer()).post('/auth/demo-login').send({ role: 'guest' }).expect(200);
    expect(host.body.user.displayName).toBe('マミ');
    expect(guest.body.user.displayName).toBe('マドカ');
    await request(app.getHttpServer()).post('/auth/demo-login').send({ role: 'unknown' }).expect(400);
  });

  it('registers with a verified LINE identity and rejects ticket reuse', async()=>{
    process.env.LINE_LOGIN_CHANNEL_ID='2011130010';process.env.LINE_LOGIN_CHANNEL_SECRET='test-secret';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id_token:'line-id-token'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({sub:'line-user-1',name:'LINE User',picture:'https://example.com/photo.jpg',nonce:'line-nonce'}),{status:200})));
    app=await createApp();
    const auth=app.get(AuthService);const jwt=app.get(JwtService);const webReturnTo='https://method-more.com/app.html';
    await expect(auth.lineAuthorizeUrl('https://evil.example/demo.html')).rejects.toThrow('LINEログインの戻り先が正しくありません');
    expect(new URL(await auth.lineAuthorizeUrl(webReturnTo)).searchParams.get('ui_locales')).toBe('ja');
    const state=await jwt.signAsync({kind:'line_state',returnTo:webReturnTo,nonce:'line-nonce'},{expiresIn:600});
    const redirect=await auth.lineCallback('authorization-code',state);expect(redirect.startsWith(`${webReturnTo}?ticket=`)).toBe(true);const ticket=new URL(redirect).searchParams.get('ticket');expect(ticket).toBeTruthy();
    const registered=await request(app.getHttpServer()).post('/auth/line/redeem').send({ticket}).expect(200);expect(registered.body.user.displayName).toBe('LINE User');expect(registered.body.user.birthDate).toBeNull();expect(registered.body.user.profilePhoto).toBeNull();
    await request(app.getHttpServer()).post('/auth/line/redeem').send({ticket,birthDate:'1990-01-01'}).expect(401);
  },15_000);

  it('registers with a verified X identity and rejects ticket reuse', async()=>{
    process.env.X_LOGIN_CLIENT_ID='x-client-id';process.env.X_LOGIN_CLIENT_SECRET='x-client-secret';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'x-access-token'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({data:{id:'x-user-1',name:'X User',username:'xuser',profile_image_url:'https://example.com/x.jpg'}}),{status:200})));
    app=await createApp();const auth=app.get(AuthService);const webReturnTo='https://method-more.com/app.html';
    await expect(auth.xAuthorizeUrl('https://evil.example/app.html')).rejects.toThrow('Xログインの戻り先が正しくありません');
    const authorizeUrl=await auth.xAuthorizeUrl(webReturnTo);const state=new URL(authorizeUrl).searchParams.get('state');expect(state).toBeTruthy();expect(new URL(authorizeUrl).searchParams.get('code_challenge_method')).toBe('S256');expect(new URL(authorizeUrl).searchParams.get('lang')).toBe('ja');
    const redirect=await auth.xCallback('x-authorization-code',state!);expect(redirect.startsWith(`${webReturnTo}?provider=x&ticket=`)).toBe(true);const ticket=new URL(redirect).searchParams.get('ticket');expect(ticket).toBeTruthy();
    const registered=await request(app.getHttpServer()).post('/auth/x/redeem').send({ticket}).expect(200);expect(registered.body.user.displayName).toBe('X User');expect(registered.body.user.birthDate).toBeNull();
    await request(app.getHttpServer()).post('/auth/x/redeem').send({ticket,birthDate:'1990-01-01'}).expect(401);
    await expect(auth.xCallback('x-authorization-code',state!)).rejects.toThrow('Xログイン情報を確認できませんでした');
  },15_000);

  it('registers with a verified Apple identity and rejects ticket reuse', async()=>{
    const {privateKey,publicKey}=await generateKeyPair('ES256',{extractable:true});
    const publicJwk=await exportJWK(publicKey);publicJwk.kid='apple-key-id';publicJwk.alg='ES256';publicJwk.use='sig';
    process.env.APPLE_LOGIN_CLIENT_ID='com.methodmore.hangoutnow.web';process.env.APPLE_TEAM_ID='APPLETEAM1';process.env.APPLE_KEY_ID='apple-key-id';process.env.APPLE_PRIVATE_KEY=await exportPKCS8(privateKey);
    const idToken=await new SignJWT({nonce:'apple-nonce'}).setProtectedHeader({alg:'ES256',kid:'apple-key-id'}).setIssuer('https://appleid.apple.com').setAudience(process.env.APPLE_LOGIN_CLIENT_ID).setSubject('apple-user-1').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id_token:idToken}),{status:200,headers:{'content-type':'application/json'}})).mockResolvedValueOnce(new Response(JSON.stringify({keys:[publicJwk]}),{status:200,headers:{'content-type':'application/json','cache-control':'max-age=60'}})));
    app=await createApp();
    const auth=app.get(AuthService);const jwt=app.get(JwtService);const webReturnTo='https://method-more.com/app.html';
    await expect(auth.appleAuthorizeUrl('https://evil.example/app.html')).rejects.toThrow('Appleログインの戻り先が正しくありません');
    expect(new URL(await auth.appleAuthorizeUrl(webReturnTo)).searchParams.get('locale')).toBe('ja_JP');
    const state=await jwt.signAsync({kind:'apple_state',returnTo:webReturnTo,nonce:'apple-nonce'},{expiresIn:600});
    const redirect=await auth.appleCallback('apple-authorization-code',state,JSON.stringify({name:{firstName:'Apple',lastName:'User'}}));expect(redirect.startsWith(`${webReturnTo}?provider=apple&ticket=`)).toBe(true);const ticket=new URL(redirect).searchParams.get('ticket');expect(ticket).toBeTruthy();
    const registered=await request(app.getHttpServer()).post('/auth/apple/redeem').send({ticket}).expect(200);expect(registered.body.user.displayName).toBe('Apple User');expect(registered.body.user.birthDate).toBeNull();
    await request(app.getHttpServer()).post('/auth/apple/redeem').send({ticket,birthDate:'1990-01-01'}).expect(401);
  },15_000);

  it('registers with a verified Google identity and rejects ticket reuse', async()=>{
    process.env.GOOGLE_LOGIN_CLIENT_ID='google-client-id';process.env.GOOGLE_LOGIN_CLIENT_SECRET='google-client-secret';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id_token:'google-id-token'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({sub:'google-user-1',name:'Google User',picture:'https://example.com/google.jpg',nonce:'google-nonce',aud:'google-client-id',iss:'https://accounts.google.com'}),{status:200})));
    app=await createApp();
    const auth=app.get(AuthService);const jwt=app.get(JwtService);const webReturnTo='https://method-more.com/app.html';
    await expect(auth.googleAuthorizeUrl('https://evil.example/app.html')).rejects.toThrow('Googleログインの戻り先が正しくありません');
    expect(new URL(await auth.googleAuthorizeUrl(webReturnTo)).searchParams.get('hl')).toBe('ja');
    const state=await jwt.signAsync({kind:'google_state',returnTo:webReturnTo,nonce:'google-nonce'},{expiresIn:600});
    const redirect=await auth.googleCallback('authorization-code',state);expect(redirect.startsWith(`${webReturnTo}?provider=google&ticket=`)).toBe(true);const ticket=new URL(redirect).searchParams.get('ticket');expect(ticket).toBeTruthy();
    const registered=await request(app.getHttpServer()).post('/auth/google/redeem').send({ticket}).expect(200);expect(registered.body.user.displayName).toBe('Google User');expect(registered.body.user.birthDate).toBeNull();expect(registered.body.user.profilePhoto).toBeNull();
    await request(app.getHttpServer()).post('/auth/google/redeem').send({ticket,birthDate:'1990-01-01'}).expect(401);
  },15_000);

  it('registers an adult and allows authenticated profile updates', async () => {
    app = await createApp();
    const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: 'USER@example.com', password: 'a-secure-password', displayName: 'Shuji', birthDate: '1990-01-01' }).expect(201);
    expect(registered.body.user.email).toBe('user@example.com');
    expect(registered.body.user.passwordHash).toBeUndefined();
    expect(registered.body.user.profilePhoto).toBeNull();
    const selectedPhoto='data:image/png;base64,iVBORw0KGgo=';
    const registeredWithPhoto=await request(app.getHttpServer()).post('/auth/register').send({ email: 'selected-photo@example.com', password: 'a-secure-password', displayName: 'Photo User', birthDate: '1990-01-01', profilePhoto:selectedPhoto }).expect(201);
    expect(registeredWithPhoto.body.user.profilePhoto).toBe(selectedPhoto);
    const profile = await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ bio: '今から走ろう', interests: ['ランニング', 'ランニング', 'AI'] }).expect(200);
    expect(profile.body.interests).toEqual(['ランニング', 'AI']);
    const matching = await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ preferredAreas: ['新宿', '新宿', '渋谷'], preferredActivities: ['カフェ', 'ランニング'], preferredAgeMin: 25, preferredAgeMax: 40, preferredGenders: ['FEMALE', 'OTHER'], activityTimeSlots: ['平日夜', '土日昼'], matchingDataConsent: true, participationUrgency: 'TODAY', maxTravelMinutes: 30, preferredGroupSizes: [2, 4], budgetMin: 1000, budgetMax: 5000 }).expect(200);
    expect(matching.body).toMatchObject({ preferredAreas: ['新宿', '渋谷'], preferredActivities: ['カフェ', 'ランニング'], preferredAgeMin: 25, preferredAgeMax: 40, preferredGenders: ['FEMALE', 'OTHER'], activityTimeSlots: ['平日夜', '土日昼'], matchingDataConsent: true, participationUrgency: 'TODAY', maxTravelMinutes: 30, preferredGroupSizes: [2, 4], budgetMin: 1000, budgetMax: 5000 });
    await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ preferredAgeMin: 45, preferredAgeMax: 30 }).expect(400);
    await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ preferredAgeMin: 17 }).expect(400);
    await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${registered.body.accessToken as string}`).send({ budgetMin: 6000, budgetMax: 2000 }).expect(400);
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

  it('creates an account and logs in with a verified phone number',async()=>{
    app=await createApp();
    const requested=await request(app.getHttpServer()).post('/auth/phone/request').send({phone:'+819012345679'}).expect(201);
    const registered=await request(app.getHttpServer()).post('/auth/phone/confirm').send({phone:'+819012345679',challengeToken:requested.body.challengeToken,code:requested.body.demoCode}).expect(200);
    expect(registered.body.user).toMatchObject({displayName:'電話番号ユーザー',phoneNumber:'+819012345679',verificationStatus:'PHONE_VERIFIED',birthDate:null});
    const requestedAgain=await request(app.getHttpServer()).post('/auth/phone/request').send({phone:'+819012345679'}).expect(201);
    const loggedIn=await request(app.getHttpServer()).post('/auth/phone/confirm').send({phone:'+819012345679',challengeToken:requestedAgain.body.challengeToken,code:requestedAgain.body.demoCode}).expect(200);
    expect(loggedIn.body.user.id).toBe(registered.body.user.id);
    await request(app.getHttpServer()).post('/auth/phone/confirm').send({phone:'+819012345679',challengeToken:requestedAgain.body.challengeToken,code:requestedAgain.body.demoCode}).expect(401);
  },15_000);

  it('stores up to three profile photos and rejects a fourth', async () => {
    app = await createApp();
    const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: 'three-photos@example.com', password: 'a-secure-password', displayName: 'Three Photos', birthDate: '1990-01-01' }).expect(201);
    const auth = { Authorization: `Bearer ${registered.body.accessToken as string}` };
    const photos=['data:image/png;base64,aQ==','data:image/png;base64,ag==','data:image/png;base64,aw=='];
    const updated=await request(app.getHttpServer()).patch('/users/me').set(auth).send({profilePhotos:photos}).expect(200);
    expect(updated.body.profilePhotos).toEqual(photos);
    expect(updated.body.profilePhoto).toBe(photos[0]);
    await request(app.getHttpServer()).patch('/users/me').set(auth).send({profilePhotos:[...photos,'data:image/png;base64,ZA==']}).expect(400);
  },15_000);

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
