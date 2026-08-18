import { MatchingAlgorithmStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { MatchingAdminService } from '../src/matching/matching-admin.service';
import { DEFAULT_MATCHING_WEIGHTS } from '../src/matching/matching-version';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('matching algorithm administration', () => {
  it('uses safe code defaults until an active database version exists', async () => {
    const db = { matchingAlgorithmConfig: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    await expect(new MatchingAdminService(db).activeWeights()).resolves.toEqual(DEFAULT_MATCHING_WEIGHTS);
  });

  it('archives the previous active version before activating a reviewed draft', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ id: 'draft', status: MatchingAlgorithmStatus.ACTIVE });
    const tx = { matchingAlgorithmConfig: { updateMany, update } };
    const db = {
      matchingAlgorithmConfig: { findUnique: vi.fn().mockResolvedValue({ id: 'draft', status: MatchingAlgorithmStatus.DRAFT, weights: DEFAULT_MATCHING_WEIGHTS }) },
      $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    await new MatchingAdminService(db).activate('draft', 'operator-1');
    expect(updateMany).toHaveBeenCalledWith({ where: { status: MatchingAlgorithmStatus.ACTIVE }, data: { status: MatchingAlgorithmStatus.ARCHIVED } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activatedBy: 'operator-1', status: MatchingAlgorithmStatus.ACTIVE }) }));
  });
});
