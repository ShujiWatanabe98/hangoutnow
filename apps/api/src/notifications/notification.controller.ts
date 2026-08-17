import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { NotificationSettingsDto, PushTokenDto } from './notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly service: NotificationService) {}
  @Get() list(@Req() request: AuthenticatedRequest) { return this.service.list(request.userId); }
  @Post('push-token') registerPush(@Req() request: AuthenticatedRequest, @Body() body: PushTokenDto) { return this.service.registerPushToken(request.userId, body.token, body.platform); }
  @Post('push-token/remove') @HttpCode(204) async removePush(@Req() request: AuthenticatedRequest, @Body() body: PushTokenDto) { await this.service.removePushToken(request.userId, body.token); }
  @Post(':id/read') @HttpCode(204) async read(@Req() request: AuthenticatedRequest, @Param('id') id: string) { await this.service.markRead(request.userId, id); }
  @Post('read-all') @HttpCode(204) async all(@Req() request: AuthenticatedRequest) { await this.service.markAllRead(request.userId); }
  @Delete() @HttpCode(204) async deleteAll(@Req() request: AuthenticatedRequest) { await this.service.deleteAll(request.userId); }
  @Patch('settings') settings(@Req() request: AuthenticatedRequest, @Body() body: NotificationSettingsDto) { return this.service.settings(request.userId, body.enabled); }
}
