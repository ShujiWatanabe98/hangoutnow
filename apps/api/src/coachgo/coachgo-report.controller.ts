import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CoachGoReportStatus } from '@prisma/client';
import { CreateCoachGoReportDto, UpdateCoachGoReportDto } from './coachgo-report.dto';
import { CoachGoReportService } from './coachgo-report.service';

@Controller('coachgo/reports')
export class CoachGoReportController {
  constructor(@Inject(CoachGoReportService) private readonly reports: CoachGoReportService) {}

  @Get()
  list(@Headers('x-coachgo-owner-token') ownerToken?: string) {
    return this.reports.list(ownerToken);
  }

  @Post()
  create(@Body() body: CreateCoachGoReportDto) {
    return this.reports.create(body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Headers('x-coachgo-owner-token') ownerToken?: string) {
    return this.reports.deleteOwned(id, ownerToken);
  }
}

@Controller('admin/coachgo/reports')
export class CoachGoReportAdminController {
  constructor(@Inject(CoachGoReportService) private readonly reports: CoachGoReportService) {}

  private admin(token?: string, adminId?: string): string {
    if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) throw new ForbiddenException();
    return adminId?.trim() || 'admin';
  }

  @Get()
  list(@Headers('x-admin-token') token?: string, @Query('status') status?: string) {
    this.admin(token);
    if (status && !Object.values(CoachGoReportStatus).includes(status as CoachGoReportStatus)) {
      throw new BadRequestException('Invalid CoachGo report status');
    }
    return this.reports.adminList(status as CoachGoReportStatus | undefined);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateCoachGoReportDto,
    @Headers('x-admin-token') token?: string,
    @Headers('x-admin-id') adminId?: string,
  ) {
    return this.reports.adminUpdate(id, this.admin(token, adminId), body);
  }
}
