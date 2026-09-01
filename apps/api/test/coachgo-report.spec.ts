import { CoachGoReportStatus, type CoachGoHazardReport } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { CoachGoReportService } from '../src/coachgo/coachgo-report.service';

const storedReport: CoachGoHazardReport = {
  id: '019d0000-0000-7000-8000-000000000001',
  ownerTokenHash: '9'.repeat(64),
  category: 'FLOOD',
  longitude: 139.7,
  latitude: 35.6,
  status: CoachGoReportStatus.ACTIVE,
  expiresAt: new Date('2026-09-02T07:00:00.000Z'),
  moderatedAt: null,
  moderatedBy: null,
  moderationNote: null,
  createdAt: new Date('2026-09-01T07:00:00.000Z'),
  updatedAt: new Date('2026-09-01T07:00:00.000Z'),
};

describe('CoachGo shared hazard reports', () => {
  it('returns active reports without exposing owner credentials', async () => {
    const db = { coachGoHazardReport: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([storedReport]) } } as unknown as PrismaService;
    const result = await new CoachGoReportService(db).list();
    expect(result.reports[0]).toMatchObject({ id: storedReport.id, category: 'FLOOD', ownedByCurrentDevice: false });
    expect(result.reports[0]).not.toHaveProperty('ownerTokenHash');
  });

  it('hashes the device token before PostgreSQL storage', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({ ...storedReport, ...data }));
    const db = { coachGoHazardReport: { create } } as unknown as PrismaService;
    const result = await new CoachGoReportService(db).create({ ownerToken: 'private-device-token', category: 'FLOOD', longitude: 139.7, latitude: 35.6 });
    const data = create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data.ownerTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.ownerTokenHash).not.toBe('private-device-token');
    expect(result.ownedByCurrentDevice).toBe(true);
    expect(result).not.toHaveProperty('ownerTokenHash');
  });

  it('rejects deletion from a different device', async () => {
    const db = { coachGoHazardReport: { findUnique: vi.fn().mockResolvedValue(storedReport), update: vi.fn() } } as unknown as PrismaService;
    await expect(new CoachGoReportService(db).deleteOwned(storedReport.id, 'different-device-token')).rejects.toThrow('この投稿は削除できません');
    expect(db.coachGoHazardReport.update).not.toHaveBeenCalled();
  });

  it('soft-deletes a report from the original device', async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({ ...storedReport, ...data }));
    const dbForCreate = { coachGoHazardReport: { create } } as unknown as PrismaService;
    const serviceForCreate = new CoachGoReportService(dbForCreate);
    await serviceForCreate.create({ ownerToken: 'original-device-token', category: 'FLOOD', longitude: 139.7, latitude: 35.6 });
    const created = create.mock.results[0]?.value as CoachGoHazardReport;
    const update = vi.fn();
    const db = { coachGoHazardReport: { findUnique: vi.fn().mockResolvedValue(created), update } } as unknown as PrismaService;
    await new CoachGoReportService(db).deleteOwned(created.id, 'original-device-token');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CoachGoReportStatus.DELETED }) }));
  });

  it('returns moderation counts and excludes owner hashes from the dashboard', async () => {
    const dashboardReport = { ...storedReport };
    const findMany = vi.fn().mockResolvedValue([dashboardReport]);
    const db = { coachGoHazardReport: {
      updateMany: vi.fn(),
      findMany,
      groupBy: vi.fn().mockResolvedValue([{ status: CoachGoReportStatus.ACTIVE, _count: { _all: 1 } }]),
    } } as unknown as PrismaService;
    const result = await new CoachGoReportService(db).adminList();
    expect(result.summary.ACTIVE).toBe(1);
    const select = findMany.mock.calls[0]?.[0].select as Record<string, boolean>;
    expect(select).not.toHaveProperty('ownerTokenHash');
  });
});
