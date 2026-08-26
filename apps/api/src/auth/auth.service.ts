import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { AcquisitionInput, AuthRepository, PublicUser, StoredUser } from './auth.types';
import { AcquisitionDto, AppleRedeemDto, DemoLoginDto, DemoRole, GoogleRedeemDto, LineRedeemDto, LoginDto, RegisterDto, UpdateProfileDto, XRedeemDto } from './auth.dto';
import { ImageStorageService } from '../storage/image-storage.service';
import { ContentModerationService } from '../moderation/content-moderation.service';

interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; }
export interface AuthResponse extends TokenPair { user: PublicUser; }

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds = 15 * 60;
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ImageStorageService) private readonly images: ImageStorageService,
    @Optional() @Inject(ContentModerationService) private readonly contentModeration = new ContentModerationService(),
  ) {}

  async register(input: RegisterDto): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    this.contentModeration.assertAllowed(input.displayName);
    if (!this.isAdult(input.birthDate)) throw new BadRequestException('18歳以上の方のみ登録できます');
    if (await this.repository.findUserByEmail(email)) throw new ConflictException('このメールアドレスはすでに登録されています');
    let user = await this.repository.createUser({
      email, passwordHash: await hash(input.password, 10), displayName: input.displayName.trim(), birthDate: new Date(`${input.birthDate}T00:00:00.000Z`), gender: input.gender, acquisition: this.acquisition(input.acquisition),
    });
    user = await this.applyRegistrationPhotos(user, input.profilePhotos??(input.profilePhoto?[input.profilePhoto]:[]));
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async login(input: LoginDto): Promise<AuthResponse> {
    const user = await this.repository.findUserByEmail(input.email.trim().toLowerCase());
    if (!user || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async demoLogin(input: DemoLoginDto): Promise<AuthResponse> {
    if (input.role !== DemoRole.HOST && input.role !== DemoRole.GUEST) throw new BadRequestException('デモの役割が正しくありません');
    const email = input.role === DemoRole.HOST
      ? process.env.HANGOUTNOW_DEMO_HOST_EMAIL || 'demo-host@hangoutnow.example'
      : process.env.HANGOUTNOW_DEMO_GUEST_EMAIL || 'demo-guest@hangoutnow.example';
    const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';
    return this.login({ email, password });
  }

  async lineAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
    if (!clientId) throw new ServiceUnavailableException('LINEログインは現在利用できません');
    if (!this.isAllowedLineReturnTo(returnTo)) throw new UnauthorizedException('LINEログインの戻り先が正しくありません');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.jwt.signAsync({ kind: 'line_state', returnTo, nonce }, { expiresIn: 10 * 60 });
    const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: this.lineCallbackUrl(), state, scope: 'openid profile', nonce, ui_locales: 'ja' });
    return `https://access.line.me/oauth2/v2.1/authorize?${query.toString()}`;
  }

  async lineCallback(code: string, state: string): Promise<string> {
    const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
    const clientSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('LINEログインは現在利用できません');
    let statePayload: { kind?: string; returnTo?: string; nonce?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; returnTo?: string; nonce?: string }>(state); }
    catch { throw new UnauthorizedException('LINEログイン情報を確認できませんでした'); }
    if (statePayload.kind !== 'line_state' || !statePayload.returnTo || !this.isAllowedLineReturnTo(statePayload.returnTo) || !statePayload.nonce) throw new UnauthorizedException('LINEログイン情報を確認できませんでした');
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.lineCallbackUrl(), client_id: clientId, client_secret: clientSecret }) });
    const tokens = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.id_token) throw new UnauthorizedException('LINEログインに失敗しました。もう一度お試しください');
    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id_token: tokens.id_token, client_id: clientId }) });
    const profile = await verifyResponse.json() as { sub?: string; name?: string; picture?: string; nonce?: string; error_description?: string };
    if (!verifyResponse.ok || !profile.sub || profile.nonce !== statePayload.nonce) throw new UnauthorizedException('LINEアカウントを確認できませんでした');
    const existing = await this.repository.findOAuthIdentity('LINE', profile.sub);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'LINE', subject: profile.sub, displayName: profile.name?.slice(0, 40) || null, profilePhoto: null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${statePayload.returnTo}${statePayload.returnTo.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemLineLogin(input: LineRedeemDto): Promise<AuthResponse> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'LINE' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('LINEログインの有効期限が切れました。もう一度お試しください');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('LINE', row.subject);
    if (!user) {
      if (input.birthDate && !this.isAdult(input.birthDate)) throw new BadRequestException('18歳以上の方のみ登録できます');
      const displayName = (input.displayName || row.displayName || 'LINEユーザー').trim();
      this.contentModeration.assertAllowed(displayName);
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `line.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null, gender: input.gender, acquisition: this.acquisition(input.acquisition) });
      await this.repository.createOAuthIdentity('LINE', row.subject, user.id);
      user = await this.applyRegistrationPhotos(user, input.profilePhotos??(input.profilePhoto?[input.profilePhoto]:[]));
    }
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async googleAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Googleログインは現在利用できません');
    if (!this.isAllowedGoogleReturnTo(returnTo)) throw new UnauthorizedException('Googleログインの戻り先が正しくありません');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.jwt.signAsync({ kind: 'google_state', returnTo, nonce }, { expiresIn: 10 * 60 });
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: this.googleCallbackUrl(), response_type: 'code', scope: 'openid profile email', state, nonce, prompt: 'select_account', hl: 'ja' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
  }

  async googleCallback(code: string, state: string): Promise<string> {
    const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('Googleログインは現在利用できません');
    let statePayload: { kind?: string; returnTo?: string; nonce?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; returnTo?: string; nonce?: string }>(state); }
    catch { throw new UnauthorizedException('Googleログイン情報を確認できませんでした'); }
    if (statePayload.kind !== 'google_state' || !statePayload.returnTo || !this.isAllowedGoogleReturnTo(statePayload.returnTo) || !statePayload.nonce) throw new UnauthorizedException('Googleログイン情報を確認できませんでした');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.googleCallbackUrl(), client_id: clientId, client_secret: clientSecret }) });
    const tokens = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.id_token) throw new UnauthorizedException('Googleログインに失敗しました。もう一度お試しください');
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
    const profile = await verifyResponse.json() as { sub?: string; name?: string; picture?: string; nonce?: string; aud?: string; iss?: string; error_description?: string };
    const trustedIssuer = profile.iss === 'accounts.google.com' || profile.iss === 'https://accounts.google.com';
    if (!verifyResponse.ok || !profile.sub || profile.aud !== clientId || profile.nonce !== statePayload.nonce || !trustedIssuer) throw new UnauthorizedException('Googleアカウントを確認できませんでした');
    const existing = await this.repository.findOAuthIdentity('GOOGLE', profile.sub);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'GOOGLE', subject: profile.sub, displayName: profile.name?.slice(0, 40) || null, profilePhoto: null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${statePayload.returnTo}${statePayload.returnTo.includes('?') ? '&' : '?'}provider=google&ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemGoogleLogin(input: GoogleRedeemDto): Promise<AuthResponse> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'GOOGLE' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('Googleログインの有効期限が切れました。もう一度お試しください');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('GOOGLE', row.subject);
    if (!user) {
      if (input.birthDate && !this.isAdult(input.birthDate)) throw new BadRequestException('18歳以上の方のみ登録できます');
      const displayName = (input.displayName || row.displayName || 'Googleユーザー').trim();
      this.contentModeration.assertAllowed(displayName);
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `google.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null, gender: input.gender, acquisition: this.acquisition(input.acquisition) });
      await this.repository.createOAuthIdentity('GOOGLE', row.subject, user.id);
      user = await this.applyRegistrationPhotos(user, input.profilePhotos??(input.profilePhoto?[input.profilePhoto]:[]));
    }
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async appleAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.APPLE_LOGIN_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Appleログインは現在利用できません');
    if (!this.isAllowedAppleReturnTo(returnTo)) throw new UnauthorizedException('Appleログインの戻り先が正しくありません');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.jwt.signAsync({ kind: 'apple_state', returnTo, nonce }, { expiresIn: 10 * 60 });
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: this.appleCallbackUrl(), response_type: 'code', response_mode: 'form_post', scope: 'name email', state, nonce, locale: 'ja_JP' });
    return `https://appleid.apple.com/auth/authorize?${query.toString()}`;
  }

  async appleCallback(code: string, state: string, rawUser?: string): Promise<string> {
    const clientId = process.env.APPLE_LOGIN_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Appleログインは現在利用できません');
    let statePayload: { kind?: string; returnTo?: string; nonce?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; returnTo?: string; nonce?: string }>(state); }
    catch { throw new UnauthorizedException('Appleログイン情報を確認できませんでした'); }
    if (statePayload.kind !== 'apple_state' || !statePayload.returnTo || !this.isAllowedAppleReturnTo(statePayload.returnTo) || !statePayload.nonce) throw new UnauthorizedException('Appleログイン情報を確認できませんでした');
    const clientSecret = await this.appleClientSecret(clientId);
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.appleCallbackUrl(), client_id: clientId, client_secret: clientSecret }) });
    const tokens = await tokenResponse.json() as { id_token?: string; refresh_token?: string; error?: string };
    if (!tokenResponse.ok || !tokens.id_token) throw new UnauthorizedException('Appleログインに失敗しました。もう一度お試しください');
    const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')), { issuer: 'https://appleid.apple.com', audience: clientId });
    if (typeof verified.payload.sub !== 'string' || verified.payload.nonce !== statePayload.nonce) throw new UnauthorizedException('Appleアカウントを確認できませんでした');
    let displayName: string | null = null;
    if (rawUser) {
      try { const parsed = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } }; displayName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ').slice(0, 40) || null; }
      catch { throw new BadRequestException('Appleのプロフィール情報を確認できませんでした'); }
    }
    const existing = await this.repository.findOAuthIdentity('APPLE', verified.payload.sub);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'APPLE', subject: verified.payload.sub, displayName, profilePhoto: null, providerRefreshTokenEncrypted: tokens.refresh_token ? this.encryptProviderToken(tokens.refresh_token) : null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${statePayload.returnTo}${statePayload.returnTo.includes('?') ? '&' : '?'}provider=apple&ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemAppleLogin(input: AppleRedeemDto): Promise<AuthResponse> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'APPLE' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('Appleログインの有効期限が切れました。もう一度お試しください');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('APPLE', row.subject);
    if (!user) {
      if (input.birthDate && !this.isAdult(input.birthDate)) throw new BadRequestException('18歳以上の方のみ登録できます');
      const displayName = (input.displayName || row.displayName || 'Appleユーザー').trim();
      this.contentModeration.assertAllowed(displayName);
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `apple.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null, gender: input.gender, acquisition: this.acquisition(input.acquisition) });
      await this.repository.createOAuthIdentity('APPLE', row.subject, user.id);
      user = await this.applyRegistrationPhotos(user, input.profilePhotos??(input.profilePhoto?[input.profilePhoto]:[]));
    }
    if (row.providerRefreshTokenEncrypted) await this.repository.upsertOAuthCredential('APPLE', row.subject, user.id, row.providerRefreshTokenEncrypted);
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async xAuthorizeUrl(returnTo: string): Promise<string> {
    const clientId = process.env.X_LOGIN_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Xログインは現在利用できません');
    if (!this.isAllowedXReturnTo(returnTo)) throw new UnauthorizedException('Xログインの戻り先が正しくありません');
    const stateKey = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(stateKey), provider: 'X_STATE', subject: verifier, displayName: returnTo, profilePhoto: null, userId: null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    const state = await this.jwt.signAsync({ kind: 'x_state', key: stateKey }, { expiresIn: 10 * 60 });
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: this.xCallbackUrl(), scope: 'users.read', state, code_challenge: challenge, code_challenge_method: 'S256', lang: 'ja' });
    return `https://x.com/i/oauth2/authorize?${query.toString()}`;
  }

  async xCallback(code: string, state: string): Promise<string> {
    const clientId = process.env.X_LOGIN_CLIENT_ID; const clientSecret = process.env.X_LOGIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('Xログインは現在利用できません');
    let statePayload: { kind?: string; key?: string };
    try { statePayload = this.jwt.verify<{ kind?: string; key?: string }>(state); }
    catch { throw new UnauthorizedException('Xログイン情報を確認できませんでした'); }
    if (statePayload.kind !== 'x_state' || !statePayload.key) throw new UnauthorizedException('Xログイン情報を確認できませんでした');
    const stateRow = await this.repository.findOAuthLoginTicket(this.tokenHash(statePayload.key));
    if (!stateRow || stateRow.provider !== 'X_STATE' || stateRow.usedAt || stateRow.expiresAt <= new Date() || !stateRow.displayName || !this.isAllowedXReturnTo(stateRow.displayName)) throw new UnauthorizedException('Xログイン情報を確認できませんでした');
    await this.repository.consumeOAuthLoginTicket(stateRow.id);
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.xCallbackUrl(), code_verifier: stateRow.subject }) });
    const tokens = await tokenResponse.json() as { access_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.access_token) throw new UnauthorizedException('Xログインに失敗しました。もう一度お試しください');
    const profileResponse = await fetch('https://api.x.com/2/users/me?user.fields=name,profile_image_url,username', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const profileResult = await profileResponse.json() as { data?: { id?: string; name?: string; profile_image_url?: string }; detail?: string };
    if (!profileResponse.ok || !profileResult.data?.id) throw new UnauthorizedException('Xアカウントを確認できませんでした');
    const existing = await this.repository.findOAuthIdentity('X', profileResult.data.id);
    const ticket = randomBytes(40).toString('base64url');
    await this.repository.saveOAuthLoginTicket({ id: uuidv7(), tokenHash: this.tokenHash(ticket), provider: 'X', subject: profileResult.data.id, displayName: profileResult.data.name?.slice(0, 40) || null, profilePhoto: null, userId: existing?.id || null, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: null });
    return `${stateRow.displayName}${stateRow.displayName.includes('?') ? '&' : '?'}provider=x&ticket=${encodeURIComponent(ticket)}`;
  }

  async redeemXLogin(input: XRedeemDto): Promise<AuthResponse> {
    const row = await this.repository.findOAuthLoginTicket(this.tokenHash(input.ticket));
    if (!row || row.provider !== 'X' || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('Xログインの有効期限が切れました。もう一度お試しください');
    let user = row.userId ? await this.repository.findUserById(row.userId) : await this.repository.findOAuthIdentity('X', row.subject);
    if (!user) {
      if (input.birthDate && !this.isAdult(input.birthDate)) throw new BadRequestException('18歳以上の方のみ登録できます');
      const displayName = (input.displayName || row.displayName || 'Xユーザー').trim();
      this.contentModeration.assertAllowed(displayName);
      const subjectKey = createHash('sha256').update(row.subject).digest('hex').slice(0, 32);
      user = await this.repository.createUser({ email: `x.${subjectKey}@oauth.hangoutnow.invalid`, passwordHash: await hash(randomBytes(48).toString('base64url'), 10), displayName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null, gender: input.gender, acquisition: this.acquisition(input.acquisition) });
      await this.repository.createOAuthIdentity('X', row.subject, user.id);
      user = await this.applyRegistrationPhotos(user, input.profilePhotos??(input.profilePhoto?[input.profilePhoto]:[]));
    }
    await this.repository.consumeOAuthLoginTicket(row.id);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async refresh(rawToken: string): Promise<AuthResponse> {
    const stored = await this.repository.findRefreshToken(this.tokenHash(rawToken));
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) throw new UnauthorizedException('ログインの有効期限が切れました。もう一度ログインしてください');
    await this.repository.revokeRefreshToken(stored.id);
    const user = await this.requireUser(stored.userId);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async logout(rawToken: string): Promise<void> {
    const stored = await this.repository.findRefreshToken(this.tokenHash(rawToken));
    if (stored && !stored.revokedAt) await this.repository.revokeRefreshToken(stored.id);
  }

  async getProfile(userId: string): Promise<PublicUser> { return this.publicUser(await this.requireUser(userId)); }
  async deleteAccount(userId:string):Promise<void>{const user=await this.requireUser(userId);if(user.email.endsWith('@hangoutnow.example'))throw new ForbiddenException('共用デモアカウントは削除できません');await this.revokeAppleCredentials(userId);for(const photo of new Set([user.profilePhoto,...user.profilePhotos].filter((value):value is string=>Boolean(value))))await this.images.deleteProfilePhoto(userId,photo);await this.repository.deleteUser(userId)}

  private async applyRegistrationPhotos(user: StoredUser, photos: string[]): Promise<StoredUser> {
    if (!photos.length) return user;
    const profilePhotos=(await Promise.all(photos.slice(0,3).map(photo=>this.images.storeProfilePhoto(user.id,photo)))).filter((photo):photo is string=>Boolean(photo));
    return this.repository.updateProfile(user.id, { profilePhoto: profilePhotos[0]??null, profilePhotos });
  }
  async updateProfile(userId: string, input: UpdateProfileDto): Promise<PublicUser> {
    this.contentModeration.assertAllowed(input.displayName,input.bio,input.homeArea,input.interests,input.preferredAreas,input.preferredActivities,input.socialStyles,input.participationGoals,input.firstTimePreferences,input.avoidPreferences,input.scheduleFlexibility,input.preferredLanguages);
    if(input.profilePhotos&&input.profilePhotos.length>3)throw new BadRequestException('プロフィール画像は3枚まで登録できます');
    if ((input.preferredAgeMin != null && (input.preferredAgeMin < 18 || input.preferredAgeMin > 100)) || (input.preferredAgeMax != null && (input.preferredAgeMax < 18 || input.preferredAgeMax > 100))) throw new BadRequestException('希望年齢は18歳から100歳で入力してください');
    if (input.preferredAgeMin != null && input.preferredAgeMax != null && input.preferredAgeMin > input.preferredAgeMax) throw new BadRequestException('希望年齢の下限は上限以下にしてください');
    if (input.budgetMin != null && input.budgetMax != null && input.budgetMin > input.budgetMax) throw new BadRequestException('予算の下限は上限以下にしてください');
    const normalized = input.interests ? [...new Set(input.interests.map((value) => value.trim()).filter(Boolean))] : undefined;
    const normalizedList = (values: string[] | undefined) => values ? [...new Set(values.map((value) => value.trim()).filter(Boolean))] : undefined;
    const current=await this.requireUser(userId);
    const suppliedPhotos=input.profilePhotos??(input.profilePhoto!==undefined?(input.profilePhoto?[input.profilePhoto]:[]):undefined);
    const profilePhotos=suppliedPhotos===undefined?undefined:await Promise.all(suppliedPhotos.map(photo=>this.images.storeProfilePhoto(userId,photo))).then(items=>items.filter((photo):photo is string=>Boolean(photo)).slice(0,3));
    const updated=await this.repository.updateProfile(userId,{...input,interests:normalized,preferredAreas:normalizedList(input.preferredAreas),preferredActivities:normalizedList(input.preferredActivities),activityTimeSlots:normalizedList(input.activityTimeSlots),socialStyles:normalizedList(input.socialStyles),participationGoals:normalizedList(input.participationGoals),firstTimePreferences:normalizedList(input.firstTimePreferences),avoidPreferences:normalizedList(input.avoidPreferences),scheduleFlexibility:normalizedList(input.scheduleFlexibility),preferredLanguages:normalizedList(input.preferredLanguages),...(profilePhotos===undefined?{}:{profilePhotos,profilePhoto:profilePhotos[0]??null})});
    if(profilePhotos!==undefined){const retained=new Set(profilePhotos);for(const oldPhoto of new Set([current.profilePhoto,...current.profilePhotos].filter((value):value is string=>Boolean(value))))if(!retained.has(oldPhoto))await this.images.deleteProfilePhoto(userId,oldPhoto)}
    return this.publicUser(updated);
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
  private encryptProviderToken(token: string): string {
    const iv=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',this.tokenEncryptionKey(),iv);
    const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
    return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join(':');
  }
  private decryptProviderToken(value: string): string {
    const [version,ivValue,tagValue,encryptedValue]=value.split(':');
    if(version!=='v1'||!ivValue||!tagValue||!encryptedValue)throw new ServiceUnavailableException('Appleログインの連携解除情報を確認できませんでした');
    try{
      const decipher=createDecipheriv('aes-256-gcm',this.tokenEncryptionKey(),Buffer.from(ivValue,'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue,'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(encryptedValue,'base64url')),decipher.final()]).toString('utf8');
    }catch{throw new ServiceUnavailableException('Appleログインの連携解除情報を確認できませんでした')}
  }
  private tokenEncryptionKey(): Buffer {
    const secret=process.env.OAUTH_TOKEN_ENCRYPTION_KEY||process.env.JWT_ACCESS_SECRET;
    if(!secret)throw new ServiceUnavailableException('Appleログインの連携解除を準備できませんでした');
    return createHash('sha256').update('hangout-now/oauth-token/v1\0').update(secret).digest();
  }
  private async revokeAppleCredentials(userId:string):Promise<void>{
    const credentials=await this.repository.findOAuthCredentials(userId,'APPLE');
    if(!credentials.length)return;
    const clientId=process.env.APPLE_LOGIN_CLIENT_ID;
    if(!clientId)throw new ServiceUnavailableException('Appleログインの連携解除を準備できませんでした');
    const clientSecret=await this.appleClientSecret(clientId);
    for(const credential of credentials){
      const response=await fetch('https://appleid.apple.com/auth/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,token:this.decryptProviderToken(credential.refreshTokenEncrypted),token_type_hint:'refresh_token'})});
      if(response.ok)continue;
      let error='';
      try{error=((await response.json()) as {error?:string}).error??''}catch{/* Apple can return an empty error body. */}
      if(error==='invalid_grant'||error==='invalid_token')continue;
      throw new ServiceUnavailableException('Appleログインの連携解除を完了できませんでした。時間をおいてもう一度お試しください');
    }
  }
  private acquisition(value?: AcquisitionDto): AcquisitionInput | undefined {
    return value ? { source: value.source, medium: value.medium, campaign: value.campaign, content: value.content } : undefined;
  }
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
      preferredAreas: user.preferredAreas, preferredActivities: user.preferredActivities,
      preferredAgeMin: user.preferredAgeMin, preferredAgeMax: user.preferredAgeMax,
      preferredGenders: user.preferredGenders, activityTimeSlots: user.activityTimeSlots,
      matchingDataConsent: user.matchingDataConsent,
      participationUrgency: user.participationUrgency, maxTravelMinutes: user.maxTravelMinutes,
      preferredGroupSizes: user.preferredGroupSizes, budgetMin: user.budgetMin, budgetMax: user.budgetMax,
      socialStyles: user.socialStyles, participationGoals: user.participationGoals, firstTimePreferences: user.firstTimePreferences,
      alcoholPreference: user.alcoholPreference, smokingPreference: user.smokingPreference,
      avoidPreferences: user.avoidPreferences, scheduleFlexibility: user.scheduleFlexibility, behaviorLearningEnabled: user.behaviorLearningEnabled,
      preferredLanguages: user.preferredLanguages,
      profilePhoto: user.profilePhoto, profilePhotos: user.profilePhotos,
    };
  }
  private lineCallbackUrl(): string { return process.env.LINE_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/line/callback'; }
  private googleCallbackUrl(): string { return process.env.GOOGLE_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/google/callback'; }
  private isAllowedGoogleReturnTo(value: string): boolean { return value === 'hangoutnow://auth/google' || this.isAllowedLineReturnTo(value); }
  private appleCallbackUrl(): string { return process.env.APPLE_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/apple/callback'; }
  private isAllowedAppleReturnTo(value: string): boolean { return value === 'hangoutnow://auth/apple' || this.isAllowedLineReturnTo(value); }
  private async appleClientSecret(clientId: string): Promise<string> {
    const teamId = process.env.APPLE_TEAM_ID; const keyId = process.env.APPLE_KEY_ID; const privateKey = process.env.APPLE_PRIVATE_KEY;
    if (!teamId || !keyId || !privateKey) throw new ServiceUnavailableException('Appleログインは現在利用できません');
    const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'ES256');
    return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId }).setIssuer(teamId).setSubject(clientId).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);
  }
  private xCallbackUrl(): string { return process.env.X_LOGIN_CALLBACK_URL || 'https://hangoutnow-api.onrender.com/auth/x/callback'; }
  private isAllowedXReturnTo(value: string): boolean { return value === 'hangoutnow://auth/x' || this.isAllowedLineReturnTo(value); }
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
