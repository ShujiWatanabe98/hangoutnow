import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, Redirect, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard, AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';
import { ConfirmPhoneVerificationDto, LineRedeemDto, LineStartDto, LoginDto, RefreshDto, RegisterDto, RequestPhoneVerificationDto, UpdateProfileDto } from './auth.dto';
import { HostStatusService } from '../host-status/host-status.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } }) register(@Body() input: RegisterDto) { return this.auth.register(input); }
  @Post('login') @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200) login(@Body() input: LoginDto) { return this.auth.login(input); }
  @Post('refresh') @HttpCode(200) refresh(@Body() input: RefreshDto) { return this.auth.refresh(input.refreshToken); }
  @Post('logout') @HttpCode(204) async logout(@Body() input: RefreshDto): Promise<void> { await this.auth.logout(input.refreshToken); }
  @Get('line/start') @Redirect() async lineStart(@Query() input: LineStartDto) { return { url: await this.auth.lineAuthorizeUrl(input.returnTo), statusCode: 302 }; }
  @Get('line/callback') @Redirect() async lineCallback(@Query('code') code: string, @Query('state') state: string) { return { url: await this.auth.lineCallback(code, state), statusCode: 302 }; }
  @Post('line/redeem') @HttpCode(200) redeemLine(@Body() input: LineRedeemDto) { return this.auth.redeemLineLogin(input); }
}

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(HostStatusService) private readonly hostStatus: HostStatusService) {}
  @Get('me') getMe(@Req() request: AuthenticatedRequest) { return this.auth.getProfile(request.userId); }
  @Get('me/host-status') getHostStatus(@Req() request: AuthenticatedRequest) { return this.hostStatus.forUser(request.userId); }
  @Patch('me') updateMe(@Req() request: AuthenticatedRequest, @Body() input: UpdateProfileDto) { return this.auth.updateProfile(request.userId, input); }
  @Delete('me') @HttpCode(204) async deleteMe(@Req() request:AuthenticatedRequest):Promise<void>{await this.auth.deleteAccount(request.userId)}
  @Post('me/phone/request') requestPhone(@Req() request: AuthenticatedRequest, @Body() input: RequestPhoneVerificationDto) { return this.auth.requestPhoneVerification(request.userId, input, request.ip||request.socket.remoteAddress||'unknown'); }
  @Post('me/phone/confirm') confirmPhone(@Req() request: AuthenticatedRequest, @Body() input: ConfirmPhoneVerificationDto) { return this.auth.confirmPhoneVerification(request.userId, input); }
}
