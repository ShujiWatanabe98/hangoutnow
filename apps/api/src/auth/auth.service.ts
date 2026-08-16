import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { AuthRepository, PublicUser, StoredUser } from './auth.types';
import { ConfirmPhoneVerificationDto, GoogleRedeemDto, LineRedeemDto, LoginDto, RegisterDto, RequestPhoneVerificationDto, UpdateProfileDto } from './auth.dto';
import { SmsVerificationProvider } from './sms-verification.provider';
import { ImageStorageService } from '../storage/image-storage.service';

interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; }
export interface AuthResponse extends TokenPair { user: PublicUser; }

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds = 15 * 60;
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(@Inject(AuthRepository) private readonly repository: AuthRepository, @Inject(JwtService) private readonly jwt: JwtService, @Inject(SmsVerificationProvider) private readonly sms: SmsVerificationProvider, @Inject(ImageStorageService) private readonly images: ImageStorageService) {}

  async register(input: RegisterDto): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    if (!this.isAdult(input.birthDate)) throw new BadRequestException('You must be at least 18 years old');
    if (await this.repository.findUserByEmail(email)) throw new ConflictException('Email is already registered');
    const user = await this.repository.createUser({
      email, passwordHash: await hash(input.password, 10), displayName: input.displayName.trim(), birthDate: new Date(`${input.birthDate}T00:00:00.000Z`), gender: input.gender,
    });
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async login(input: LoginDto): Promise<AuthResponse> {
    const user = await this.repository.findUserByEmail(input.email.trim().toLowerCase());
    if (!user || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async lineAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
    if (!clientId) throw new ServiceUnavailableException('LINE login is not configured');
    if (!this.isAllowedLineReturnTo(returnTo)) throw new UnauthorizedException('Invalid LINE login return URL');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.jwt.signAsync({ kind: 'line_state', returnTo, nonce }, { expiresIn: 10 * 60 });
    const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: this.lineCallbackUrl(), state, scope: 'openid profile', nonce });
    return `https://access.line.me/oauth2/v2.1/authorize?${query.toString()}`;
  }

  async lineCallback(code: string, state: string): Promise<string> {
    const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
    const clientSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('LINE login is not configured');
    let statePayload: { kind?: string; returnTo?: string; nonce?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; returnTo?: string; nonce?: string }>(state); }
    catch { throw new UnauthorizedException('Invalid LINE login state'); }
    if (statePayload.kind !== 'line_state' || !statePayload.returnTo || !this.isAllowedLineReturnTo(statePayload.returnTo) || !statePayload.nonce) throw new UnauthorizedException('Invalid LINE login state');
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.lineCallbackUrl(), client_id: clientId, client_secret: clientSecret }) });
    const tokens = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.id_token) throw new UnauthorizedException(tokens.error_description || 'LINE login failed');
    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id_token: tokens.id_token, client_id: clientId }) });
    const profile = await verifyResponse.json() as { sub?: string; name?: string; picture?: string; nonce?: string; error_description?: string };
    if (!verifyResponse.ok || !profile.sub || profile.nonce !== statePayload.nonce) throw new UnauthorizedException(profile.error_description || 'Invalid LINE identity');
    const existing = await this.repository.findOAuthIdentity('LINE', profile.sub);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'LINE', subject: profile.sub, displayName: profile.name?.slice(0, 40) || null, profilePhoto: profile.picture || null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${statePayload.returnTo}${statePayload.returnTo.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemLineLogin(input: LineRedeemDto): Promise<AuthResponse | { registrationRequired: true; displayName: string | null }> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'LINE' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('LINE login ticket is invalid');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('LINE', row.subject);
    if (!user) {
      if (!input.birthDate) return { registrationRequired: true, displayName: row.displayName };
      if (!this.isAdult(input.birthDate)) throw new BadRequestException('You must be at least 18 years old');
      const displayName = (input.displayName || row.displayName || '').trim();
      if (!displayName) throw new BadRequestException('Display name is required');
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `line.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: new Date(`${input.birthDate}T00:00:00.000Z`), gender: input.gender });
      await this.repository.createOAuthIdentity('LINE', row.subject, user.id);
      if (row.profilePhoto) user = await this.repository.updateProfile(user.id, { profilePhoto: row.profilePhoto });
    }
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async googleAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Google login is not configured');
    if (!this.isAllowedGoogleReturnTo(returnTo)) throw new UnauthorizedException('Invalid Google login return URL');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.jwt.signAsync({ kind: 'google_state', returnTo, nonce }, { expiresIn: 10 * 60 });
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: this.googleCallbackUrl(), response_type: 'code', scope: 'openid profile email', state, nonce, prompt: 'select_account' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
  }

  async googleCallback(code: string, state: string): Promise<string> {
    const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('Google login is not configured');
    let statePayload: { kind?: string; returnTo?: string; nonce?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; returnTo?: string; nonce?: string }>(state); }
    catch { throw new UnauthorizedException('Invalid Google login state'); }
    if (statePayload.kind !== 'google_state' || !statePayload.returnTo || !this.isAllowedGoogleReturnTo(statePayload.returnTo) || !statePayload.nonce) throw new UnauthorizedException('Invalid Google login state');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.googleCallbackUrl(), client_id: clientId, client_secret: clientSecret }) });
    const tokens = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.id_token) throw new UnauthorizedException(tokens.error_description || 'Google login failed');
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
    const profile = await verifyResponse.json() as { sub?: string; name?: string; picture?: string; nonce?: string; aud?: string; iss?: string; error_description?: string };
    const trustedIssuer = profile.iss === 'accounts.google.com' || profile.iss === 'https://accounts.google.com';
    if (!verifyResponse.ok || !profile.sub || profile.aud !== clientId || profile.nonce !== statePayload.nonce || !trustedIssuer) throw new UnauthorizedException(profile.error_description || 'Invalid Google identity');
    const existing = await this.repository.findOAuthIdentity('GOOGLE', profile.sub);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'GOOGLE', subject: profile.sub, displayName: profile.name?.slice(0, 40) || null, profilePhoto: profile.picture || null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${statePayload.returnTo}${statePayload.returnTo.includes('?') ? '&' : '?'}provider=google&ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemGoogleLogin(input: GoogleRedeemDto): Promise<AuthResponse | { registrationRequired: true; displayName: string | null }> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'GOOGLE' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('Google login ticket is invalid');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('GOOGLE', row.subject);
    if (!user) {
      if (!input.birthDate) return { registrationRequired: true, displayName: row.displayName };
      if (!this.isAdult(input.birthDate)) throw new BadRequestException('You must be at least 18 years old');
      const displayName = (input.displayName || row.displayName || '').trim();
      if (!displayName) throw new BadRequestException('Display name is required');
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `google.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: new Date(`${input.birthDate}T00:00:00.000Z`), gender: input.gender });
      await this.repository.createOAuthIdentity('GOOGLE', row.subject, user.id);
      if (row.profilePhoto) user = await this.repository.updateProfile(user.id, { profilePhoto: row.profilePhoto });
    }
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async refresh(rawToken: string): Promise<AuthResponse> {
    const stored = await this.repository.findRefreshToken(this.tokenHash(rawToken));
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');
    await this.repository.revokeRefreshToken(stored.id);
    const user = await this.requireUser(stored.userId);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async logout(rawToken: string): Promise<void> {
    const stored = await this.repository.findRefreshToken(this.tokenHash(rawToken));
    if (stored && !stored.revokedAt) await this.repository.revokeRefreshToken(stored.id);
  }

  async getProfile(userId: string): Promise<PublicUser> { return this.publicUser(await this.requireUser(userId)); }
  async deleteAccount(userId:string):Promise<void>{const user=await this.requireUser(userId);if(user.email.endsWith('@hangoutnow.example'))throw new ForbiddenException('Shared demo accounts cannot be deleted');await this.images.deleteProfilePhoto(userId,user.profilePhoto);await this.repository.deleteUser(userId)}
  async updateProfile(userId: string, input: UpdateProfileDto): Promise<PublicUser> {
    const normalized = input.interests ? [...new Set(input.interests.map((value) => value.trim()).filter(Boolean))] : undefined;
    const profilePhoto=await this.images.storeProfilePhoto(userId,input.profilePhoto);
    return this.publicUser(await this.repository.updateProfile(userId, { ...input, interests: normalized, profilePhoto }));
  }
  async requestPhoneVerification(userId: string, input: RequestPhoneVerificationDto, requestIp='unknown') {
    const counts=await this.repository.phoneVerificationCounts(userId,input.phone,requestIp,new Date(Date.now()-24*60*60_000));
    if(counts.user>=5||counts.phone>=5||counts.ip>=20)throw new BadRequestException('Daily verification limit reached');
    const latest=await this.repository.findPhoneVerification(userId,input.phone);
    if(latest?.createdAt&&latest.createdAt.getTime()>Date.now()-60_000)throw new BadRequestException('Wait 60 seconds before requesting another code');
    const code = randomInt(100000, 1000000).toString();
    if(this.sms.enabled)await this.sms.request(input.phone);
    await this.repository.createPhoneVerification({ id: uuidv7(), userId, phone: input.phone, codeHash: this.sms.enabled?'twilio':this.phoneCodeHash(input.phone, code), expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null, attempts: 0, requestIp });
    // An SMS provider should send the code in production. It is returned only for the local demo.
    const exposeDemoCode = !this.sms.enabled && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true');
    return { expiresIn: 600, resendAfter:60, ...(exposeDemoCode ? { demoCode: code } : {}) };
  }
  async confirmPhoneVerification(userId: string, input: ConfirmPhoneVerificationDto): Promise<PublicUser> {
    const row = await this.repository.findPhoneVerification(userId, input.phone);
    if (!row || row.expiresAt <= new Date() || row.attempts >= 5) throw new BadRequestException('Verification code is expired');
    const valid=this.sms.enabled?await this.sms.check(input.phone,input.code):(()=>{const expected=Buffer.from(row.codeHash,'hex');const actual=Buffer.from(this.phoneCodeHash(input.phone,input.code),'hex');return expected.length===actual.length&&timingSafeEqual(expected,actual)})();
    if (!valid) { await this.repository.failPhoneVerification(row.id); throw new BadRequestException('Verification code is invalid'); }
    try { return this.publicUser(await this.repository.verifyPhone(userId, input.phone, row.id)); }
    catch { throw new ConflictException('Phone number is already registered'); }
  }
  verifyAccessToken(token: string): { sub: string } { return this.jwt.verify<{ sub: string }>(token); }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.repository.saveRefreshToken({
      id: uuidv7(), userId, tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + this.refreshTtlMs), revokedAt: null,
    });
    return { accessToken: await this.jwt.signAsync({ sub: userId }, { expiresIn: this.accessTtlSeconds }), refreshToken, expiresIn: this.accessTtlSeconds };
  }
  private tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private isAdult(value: string): boolean {
    const birth = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(birth.getTime())) return false;
    const today = new Date();
    const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
    return birth <= cutoff;
  }
  private async requireUser(id: string): Promise<StoredUser> {
    const user = await this.repository.findUserById(id);
    if (!user) throw new UnauthorizedException();
    return user;
  }
  private publicUser(user: StoredUser): PublicUser {
    return {
      id: user.id, email: user.email, displayName: user.displayName, birthDate: user.birthDate, gender: user.gender,
      bio: user.bio, homeArea: user.homeArea, interests: user.interests, verificationStatus: user.verificationStatus,
      profilePhoto: user.profilePhoto, phoneNumber: user.phoneNumber,
    };
  }
  private phoneCodeHash(phone: string, code: string): string { return createHash('sha256').update(`${phone}:${code}:${process.env.PHONE_CODE_SECRET || 'local-demo-secret'}`).digest('hex'); }
  private lineCallbackUrl(): string { return process.env.LINE_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/line/callback'; }
  private googleCallbackUrl(): string { return process.env.GOOGLE_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/google/callback'; }
  private isAllowedGoogleReturnTo(value: string): boolean { return value === 'hangoutnow://auth/google' || this.isAllowedLineReturnTo(value); }
  private isAllowedLineReturnTo(value: string): boolean {
    return new Set([
      'hangoutnow://auth/line',
      'https://method-more.com/demo.html',
      'https://www.method-more.com/demo.html',
      'https://hangoutnow-demo.onrender.com/demo.html',
      'http://localhost:4173/demo.html',
      'http://127.0.0.1:4173/demo.html',
      'https://method-more.com/app.html',
      'https://www.method-more.com/app.html',
      'https://hangoutnow-demo.onrender.com/app.html',
      'http://localhost:4173/app.html',
      'http://127.0.0.1:4173/app.html',
    ]).has(value);
  }
}
