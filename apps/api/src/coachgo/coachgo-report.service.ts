import { createHash } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CoachGoReportStatus, type CoachGoHazardReport } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoachGoReportDto, UpdateCoachGoReportDto } from './coachgo-report.dto';

const REPORT_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const PUBLIC_REPORT_LIMIT = 2_000;
const ADMIN_REPORT_LIMIT = 500;

function ownerHash(ownerToken: string): string {
  return createHash('sha256').update(ownerToken, 'utf8').digest('hex');
}

function publicReport(report: CoachGoHazardReport, requesterHash: string | null) {
  return {
    id: report.id,
    category: report.category,
    longitude: report.longitude,
    latitude: report.latitude,
    createdAt: report.createdAt.toISOString(),
    expiresAt: report.expiresAt.toISOString(),
    ownedByCurrentDevice: requesterHash !== null && report.ownerTokenHash === requesterHash,
  };
}

@Injectable()
export class CoachGoReportService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private async expireOldReports(now = new Date()): Promise<void> {
    await this.db.coachGoHazardReport.updateMany({
      where: { status: CoachGoReportStatus.ACTIVE, expiresAt: { lte: now } },
      data: { status: CoachGoReportStatus.EXPIRED },
    });
  }

  async list(ownerToken?: string) {
    const now = new Date();
    await this.expireOldReports(now);
    const reports = await this.db.coachGoHazardReport.findMany({
      where: { status: CoachGoReportStatus.ACTIVE, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: PUBLIC_REPORT_LIMIT,
    });
    const requesterHash = ownerToken ? ownerHash(ownerToken) : null;
    return { reports: reports.map((report) => publicReport(report, requesterHash)), refreshedAt: now.toISOString() };
  }

  async create(input: CreateCoachGoReportDto) {
    const report = await this.db.coachGoHazardReport.create({
      data: {
        id: uuidv7(),
        ownerTokenHash: ownerHash(input.ownerToken),
        category: input.category,
        longitude: input.longitude,
        latitude: input.latitude,
        expiresAt: new Date(Date.now() + REPORT_LIFETIME_MS),
      },
    });
    return publicReport(report, report.ownerTokenHash);
  }

  async deleteOwned(id: string, ownerToken?: string): Promise<void> {
    if (!ownerToken) throw new ForbiddenException('投稿した端末を確認できません');
    const report = await this.db.coachGoHazardReport.findUnique({ where: { id } });
    if (!report || report.status === CoachGoReportStatus.DELETED) throw new NotFoundException('投稿が見つかりません');
    if (report.ownerTokenHash !== ownerHash(ownerToken)) throw new ForbiddenException('この投稿は削除できません');
    await this.db.coachGoHazardReport.update({
      where: { id },
      data: { status: CoachGoReportStatus.DELETED, moderatedAt: new Date(), moderatedBy: 'report-owner', moderationNote: '投稿端末による削除' },
    });
  }

  async adminList(status?: CoachGoReportStatus) {
    await this.expireOldReports();
    const [reports, grouped] = await Promise.all([
      this.db.coachGoHazardReport.findMany({
        where: status ? { status } : undefined,
        select: {
          id: true,
          category: true,
          longitude: true,
          latitude: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          moderatedAt: true,
          moderatedBy: true,
          moderationNote: true,
        },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_REPORT_LIMIT,
      }),
      this.db.coachGoHazardReport.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      summary: Object.fromEntries(Object.values(CoachGoReportStatus).map((value) => [value, grouped.find((item) => item.status === value)?._count._all ?? 0])),
      reports,
    };
  }

  async adminUpdate(id: string, adminId: string, input: UpdateCoachGoReportDto) {
    const report = await this.db.coachGoHazardReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('投稿が見つかりません');
    return this.db.coachGoHazardReport.update({
      where: { id },
      data: {
        status: input.status,
        moderatedAt: new Date(),
        moderatedBy: adminId,
        moderationNote: input.note?.trim() || null,
      },
      select: { id: true, status: true, moderatedAt: true, moderatedBy: true, moderationNote: true },
    });
  }
}
