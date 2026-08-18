import { Body, Controller, ForbiddenException, Get, Headers, Inject, Post } from '@nestjs/common';
import { NotificationAdminService } from './notification-admin.service';
import { PushPauseDto, TestPushDto } from './notification-admin.dto';

@Controller('admin/notifications')
export class NotificationAdminController {
  constructor(@Inject(NotificationAdminService) private readonly service: NotificationAdminService) {}
  private admin(token?: string, adminId?: string) { if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) throw new ForbiddenException(); return adminId?.trim() || 'admin'; }
  @Get() overview(@Headers('x-admin-token') token?: string) { this.admin(token); return this.service.overview(); }
  @Post('pause') pause(@Body() body: PushPauseDto, @Headers('x-admin-token') token?: string, @Headers('x-admin-id') adminId?: string) { return this.service.pause(this.admin(token, adminId), body.paused); }
  @Post('cleanup') cleanup(@Headers('x-admin-token') token?: string) { this.admin(token); return this.service.cleanup(); }
  @Post('test') test(@Body() body: TestPushDto, @Headers('x-admin-token') token?: string) { this.admin(token); return this.service.test(body.userId, body.title, body.body); }
}
