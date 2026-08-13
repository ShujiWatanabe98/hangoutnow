import { VerificationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateHostStatus } from '../src/host-status/host-status.service';

const rating = (score: number, index: number) => ({ score, hangoutId: `hangout-${index}`, startAt: new Date(2026, 7, index + 1) });

describe('host status rules', () => {
  it('keeps a new host at bronze', () => {
    expect(calculateHostStatus({ completedHangouts: 0, cancelledHangouts: 0, totalParticipants: 0, ratings: [], verification: VerificationStatus.UNVERIFIED, resolvedReports: 0 }).tier).toBe('BRONZE');
  });

  it('promotes a trusted host when all silver requirements are met', () => {
    const status = calculateHostStatus({ completedHangouts: 3, cancelledHangouts: 0, totalParticipants: 8, ratings: [rating(4, 1), rating(5, 2), rating(4, 3)], verification: VerificationStatus.PHONE_VERIFIED, resolvedReports: 0 });
    expect(status).toMatchObject({ tier: 'SILVER', completedHangouts: 3, totalParticipants: 8, averageRating: 4.3, nextTier: 'GOLD' });
  });

  it('does not promote a host with an upheld report or excessive cancellations', () => {
    const ratings = Array.from({ length: 12 }, (_, index) => rating(5, index));
    expect(calculateHostStatus({ completedHangouts: 10, cancelledHangouts: 0, totalParticipants: 40, ratings, verification: VerificationStatus.PHONE_VERIFIED, resolvedReports: 1 }).tier).toBe('BRONZE');
    expect(calculateHostStatus({ completedHangouts: 10, cancelledHangouts: 2, totalParticipants: 40, ratings, verification: VerificationStatus.PHONE_VERIFIED, resolvedReports: 0 }).tier).toBe('SILVER');
  });
});
