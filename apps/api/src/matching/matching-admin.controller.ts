import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { CreateMatchingConfigDto } from './matching-admin.dto';
import { MatchingAdminService } from './matching-admin.service';

@Controller('admin/matching')
export class MatchingAdminController {
  constructor(@Inject(MatchingAdminService) private readonly matching: MatchingAdminService) {}
  private admin(token?: string, adminId?: string) {
    if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) throw new ForbiddenException();
    return adminId?.trim() || 'admin';
  }
  @Get() dashboard(@Headers('x-admin-token') token?: string) { this.admin(token); return this.matching.dashboard(); }
  @Post('configs') create(@Body() body: CreateMatchingConfigDto, @Headers('x-admin-token') token?: string, @Headers('x-admin-id') adminId?: string) { return this.matching.create(this.admin(token, adminId), body); }
  @Post('configs/:id/activate') activate(@Param('id') id: string, @Headers('x-admin-token') token?: string, @Headers('x-admin-id') adminId?: string) { return this.matching.activate(id, this.admin(token, adminId)); }
}
