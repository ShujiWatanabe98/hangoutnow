import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ModerationActionType, ReportStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationActionDto, ReportDto, UpdateReportDto } from './safety.dto';

@Injectable()
export class SafetyService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async block(uid: string, target: string) {
    if (uid === target) throw new BadRequestException('Cannot block yourself');
    if (!await this.db.user.findUnique({ where: { id: target } })) throw new NotFoundException();
    return this.db.block.upsert({ where: { blockerId_blockedId: { blockerId: uid, blockedId: target } }, create: { id: uuidv7(), blockerId: uid, blockedId: target }, update: {} });
  }

  async unblock(uid: string, target: string) { await this.db.block.deleteMany({ where: { blockerId: uid, blockedId: target } }); }
  async blocks(uid: string) { return this.db.block.findMany({ where: { blockerId: uid }, include: { blocked: { select: { id: true, displayName: true } } }, orderBy: { createdAt: 'desc' } }); }

  async report(uid: string, input: ReportDto) {
    if (uid === input.targetUserId) throw new BadRequestException('Cannot report yourself');
    if (!await this.db.user.findUnique({ where: { id: input.targetUserId } })) throw new NotFoundException('Reported user not found');
    try {
      const report = await this.db.report.create({ data: { id: uuidv7(), reporterId: uid, targetUserId: input.targetUserId, hangoutId: input.hangoutId, reason: input.reason, details: input.details?.trim() } });
      if (input.blockUser) await this.block(uid, input.targetUserId);
      return report;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException('Report already submitted');
    }
  }

  async reports(status?: ReportStatus) {
    return this.db.report.findMany({
      where: status ? { status } : undefined,
      include: { reporter: { select: { id: true, displayName: true } }, targetUser: { select: { id: true, displayName: true, accountStatus: true } }, hangout: { select: { id: true, title: true } }, actions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async updateReport(id: string, input: UpdateReportDto) {
    const report = await this.db.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (input.status === 'RESOLVED' && !input.resolution?.trim()) throw new BadRequestException('Resolution is required when resolving a report');
    return this.db.report.update({ where: { id }, data: { status: input.status, assignedTo: input.assignedTo?.trim() || null, resolution: input.resolution?.trim() || null } });
  }

  async act(id: string, adminId: string, input: ModerationActionDto) {
    const report = await this.db.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const accountStatus: Record<ModerationActionDto['action'], AccountStatus | undefined> = {
      NOTE: undefined, WARNING: AccountStatus.WARNED, SUSPEND: AccountStatus.SUSPENDED, BAN: AccountStatus.BANNED, RESTORE: AccountStatus.ACTIVE,
    };
    return this.db.$transaction(async (tx) => {
      const action = await tx.moderationAction.create({ data: { id: uuidv7(), reportId: id, targetUserId: report.targetUserId, action: input.action as ModerationActionType, reason: input.reason.trim(), adminId } });
      const nextStatus = accountStatus[input.action];
      if (nextStatus) await tx.user.update({ where: { id: report.targetUserId }, data: { accountStatus: nextStatus } });
      await tx.report.update({ where: { id }, data: { status: ReportStatus.REVIEWING, assignedTo: adminId } });
      return action;
    });
  }

  async blocked(a: string, b: string) { return Boolean(await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })); }
}
