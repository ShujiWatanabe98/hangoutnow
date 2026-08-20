import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, Redirect, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard, AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';
import { AppleCallbackDto, AppleRedeemDto, AppleStartDto, DemoLoginDto, GoogleRedeemDto, GoogleStartDto, LineRedeemDto, LineStartDto, LoginDto, RefreshDto, RegisterDto, UpdateProfileDto, XRedeemDto, XStartDto } from './auth.dto';
import { HostStatusService } from '../host-status/host-status.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } }) register(@Body() input: RegisterDto) { return this.auth.register(input); }
  @Post('login') @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200) login(@Body() input: LoginDto) { return this.auth.login(input); }
  @Post('demo-login') @Throttle({ default: { limit: 60, ttl: 60_000 } }) @HttpCode(200) demoLogin(@Body() input: DemoLoginDto) { return this.auth.demoLogin(input); }
  @Post('refresh') @HttpCode(200) refresh(@Body() input: RefreshDto) { return this.auth.refresh(input.refreshToken); }
  @Post('logout') @HttpCode(204) async logout(@Body() input: RefreshDto): Promise<void> { await this.auth.logout(input.refreshToken); }
  @Get('line/start') @Redirect() async lineStart(@Query() input: LineStartDto) { return { url: await this.auth.lineAuthorizeUrl(input.returnTo), statusCode: 302 }; }
  @Get('line/callback') @Redirect() async lineCallback(@Query('code') code: string, @Query('state') state: string) { return { url: await this.auth.lineCallback(code, state), statusCode: 302 }; }
  @Post('line/redeem') @HttpCode(200) redeemLine(@Body() input: LineRedeemDto) { return this.auth.redeemLineLogin(input); }
  @Get('google/start') @Redirect() async googleStart(@Query() input: GoogleStartDto) { return { url: await this.auth.googleAuthorizeUrl(input.returnTo), statusCode: 302 }; }
  @Get('google/callback') @Redirect() async googleCallback(@Query('code') code: string, @Query('state') state: string) { return { url: await this.auth.googleCallback(code, state), statusCode: 302 }; }
  @Post('google/redeem') @HttpCode(200) redeemGoogle(@Body() input: GoogleRedeemDto) { return this.auth.redeemGoogleLogin(input); }
  @Get('apple/start') @Redirect() async appleStart(@Query() input: AppleStartDto) { return { url: await this.auth.appleAuthorizeUrl(input.returnTo), statusCode: 302 }; }
  @Post('apple/callback') @Redirect() async appleCallback(@Body() input: AppleCallbackDto) { return { url: await this.auth.appleCallback(input.code, input.state, input.user), statusCode: 303 }; }
  @Post('apple/redeem') @HttpCode(200) redeemApple(@Body() input: AppleRedeemDto) { return this.auth.redeemAppleLogin(input); }
  @Get('x/start') @Redirect() async xStart(@Query() input: XStartDto) { return { url: await this.auth.xAuthorizeUrl(input.returnTo), statusCode: 302 }; }
  @Get('x/callback') @Redirect() async xCallback(@Query('code') code: string, @Query('state') state: string) { return { url: await this.auth.xCallback(code, state), statusCode: 302 }; }
  @Post('x/redeem') @HttpCode(200) redeemX(@Body() input: XRedeemDto) { return this.auth.redeemXLogin(input); }
}

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(HostStatusService) private readonly hostStatus: HostStatusService) {}
  @Get('me') getMe(@Req() request: AuthenticatedRequest) { return this.auth.getProfile(request.userId); }
  @Get('me/host-status') getHostStatus(@Req() request: AuthenticatedRequest) { return this.hostStatus.forUser(request.userId); }
  @Patch('me') updateMe(@Req() request: AuthenticatedRequest, @Body() input: UpdateProfileDto) { return this.auth.updateProfile(request.userId, input); }
  @Delete('me') @HttpCode(204) async deleteMe(@Req() request:AuthenticatedRequest):Promise<void>{await this.auth.deleteAccount(request.userId)}
}
