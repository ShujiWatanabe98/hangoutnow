import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { ModerationActionDto, ReportDto, UpdateReportDto } from './safety.dto';
import { SafetyService } from './safety.service';

@Controller('safety')
@UseGuards(AccessTokenGuard)
export class SafetyController {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}
  @Post('blocks/:id') block(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.safety.block(request.userId, id); }
  @Delete('blocks/:id') unblock(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.safety.unblock(request.userId, id); }
  @Get('blocks') blocks(@Req() request: AuthenticatedRequest) { return this.safety.blocks(request.userId); }
  @Post('reports') report(@Req() request: AuthenticatedRequest, @Body() body: ReportDto) { return this.safety.report(request.userId, body); }
}

@Controller('admin/reports')
export class ReportAdminController {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}
  private admin(token?: string, adminId?: string) {
    if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) throw new ForbiddenException();
    return adminId?.trim() || 'admin';
  }
  @Get() list(@Headers('x-admin-token') token?: string, @Query('status') status?: string) {
    this.admin(token);
    if (status && !Object.values(ReportStatus).includes(status as ReportStatus)) throw new BadRequestException('Invalid report status');
    return this.safety.reports(status as ReportStatus | undefined);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() body: UpdateReportDto, @Headers('x-admin-token') token?: string) { this.admin(token); return this.safety.updateReport(id, body); }
  @Post(':id/actions') action(@Param('id') id: string, @Body() body: ModerationActionDto, @Headers('x-admin-token') token?: string, @Headers('x-admin-id') adminId?: string) { return this.safety.act(id, this.admin(token, adminId), body); }
}
