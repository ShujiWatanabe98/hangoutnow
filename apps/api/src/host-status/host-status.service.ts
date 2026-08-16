import { Injectable } from '@nestjs/common';
import { HangoutStatus, ReportStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type HostTier = 'WHITE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface HostStatus {
  tier: HostTier;
  label: string;
  completedHangouts: number;
  totalParticipants: number;
  ratingCount: number;
  averageRating: number | null;
  hostRatingCount: number;
  hostAverageRating: number | null;
  participantRatingCount: number;
  participantAverageRating: number | null;
  recentAverageRating: number | null;
  cancellationRate: number;
  nextTier: HostTier | null;
}

interface HostStatusInput {
  completedHangouts: number;
  cancelledHangouts: number;
  totalParticipants: number;
  ratings: Array<{ score: number; hangoutId: string; startAt: Date }>;
  participantRatings?: Array<{ score: number }>;
  verification: VerificationStatus;
  resolvedReports: number;
}

const LEVELS = [
  { tier: 'DIAMOND' as const, label: 'ダイアモンド', completed: 100, participants: 600, ratings: 100, average: 4.9, recent: 4.8, maxCancellation: 0.02 },
  { tier: 'PLATINUM' as const, label: 'プラチナ', completed: 50, participants: 250, ratings: 50, average: 4.8, recent: 4.7, maxCancellation: 0.03 },
  { tier: 'GOLD' as const, label: 'ゴールド', completed: 25, participants: 100, ratings: 25, average: 4.6, recent: 4.5, maxCancellation: 0.05 },
  { tier: 'SILVER' as const, label: 'シルバー', completed: 10, participants: 30, ratings: 10, average: 4.3, recent: 4.2, maxCancellation: 0.1 },
  { tier: 'BRONZE' as const, label: 'ブロンズ', completed: 3, participants: 0, ratings: 0, average: 0, recent: 0, maxCancellation: 1 },
];

const LABELS: Record<HostTier, string> = { WHITE: 'ホワイト', BRONZE: 'ブロンズ', SILVER: 'シルバー', GOLD: 'ゴールド', PLATINUM: 'プラチナ', DIAMOND: 'ダイアモンド' };
const DEVELOPER_EMAIL = 'info@method-more.com';

export function developerHostStatus(email: string): HostStatus | null {
  if (email.trim().toLowerCase() !== DEVELOPER_EMAIL) return null;
  return { tier: 'DIAMOND', label: 'ダイアモンド', completedHangouts: 100, totalParticipants: 600, ratingCount: 100, averageRating: 5, hostRatingCount: 100, hostAverageRating: 5, participantRatingCount: 100, participantAverageRating: 5, recentAverageRating: 5, cancellationRate: 0, nextTier: null };
}

export function calculateHostStatus(input: HostStatusInput): HostStatus {
  const ratingCount = input.ratings.length;
  const averageRating = ratingCount ? Number((input.ratings.reduce((sum, rating) => sum + rating.score, 0) / ratingCount).toFixed(1)) : null;
  const recentHangoutIds = [...new Set([...input.ratings].sort((a, b) => b.startAt.getTime() - a.startAt.getTime()).map((rating) => rating.hangoutId))].slice(0, 10);
  const recentRatings = input.ratings.filter((rating) => recentHangoutIds.includes(rating.hangoutId));
  const recentAverageRating = recentRatings.length ? Number((recentRatings.reduce((sum, rating) => sum + rating.score, 0) / recentRatings.length).toFixed(1)) : null;
  const decided = input.completedHangouts + input.cancelledHangouts;
  const cancellationRate = decided ? Number((input.cancelledHangouts / decided).toFixed(3)) : 0;
  const trusted = input.verification === VerificationStatus.PHONE_VERIFIED && input.resolvedReports === 0;
  const level = trusted ? LEVELS.find((candidate) => input.completedHangouts >= candidate.completed && input.totalParticipants >= candidate.participants && ratingCount >= candidate.ratings && (averageRating ?? 0) >= candidate.average && (recentAverageRating ?? 0) >= candidate.recent && cancellationRate <= candidate.maxCancellation) : undefined;
  const tier: HostTier = level?.tier ?? 'WHITE';
  const ascending: HostTier[] = ['WHITE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const nextTier = ascending[ascending.indexOf(tier) + 1] ?? null;
  const participantRatingCount = input.participantRatings?.length ?? 0;
  const participantAverageRating = participantRatingCount ? Number((input.participantRatings!.reduce((sum, rating) => sum + rating.score, 0) / participantRatingCount).toFixed(1)) : null;
  return { tier, label: LABELS[tier], completedHangouts: input.completedHangouts, totalParticipants: input.totalParticipants, ratingCount, averageRating, hostRatingCount: ratingCount, hostAverageRating: averageRating, participantRatingCount, participantAverageRating, recentAverageRating, cancellationRate, nextTier };
}

@Injectable()
export class HostStatusService {
  constructor(private readonly db: PrismaService) {}

  async forUsers(userIds: string[]): Promise<Map<string, HostStatus>> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    const [users, hangouts, ratings, reports] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, verification: true } }),
      this.db.hangout.findMany({ where: { hostUserId: { in: ids }, status: { in: [HangoutStatus.FINISHED, HangoutStatus.CANCELLED] } }, select: { id: true, hostUserId: true, status: true, joinRequests: { where: { status: 'ACCEPTED' }, select: { id: true } } } }),
      this.db.hangoutRating.findMany({ where: { ratedUserId: { in: ids } }, select: { ratedUserId: true, score: true, hangoutId: true, hangout: { select: { hostUserId: true, startAt: true } } } }),
      this.db.report.groupBy({ by: ['targetUserId'], where: { targetUserId: { in: ids }, status: ReportStatus.RESOLVED }, _count: { _all: true } }),
    ]);
    return new Map(users.map((user) => {
      const hosted = hangouts.filter((hangout) => hangout.hostUserId === user.id);
      const hostRatings = ratings.filter((rating) => rating.ratedUserId === user.id && rating.hangout.hostUserId === user.id).map((rating) => ({ score: rating.score, hangoutId: rating.hangoutId, startAt: rating.hangout.startAt }));
      const participantRatings = ratings.filter((rating) => rating.ratedUserId === user.id && rating.hangout.hostUserId !== user.id).map((rating) => ({ score: rating.score }));
      const status = calculateHostStatus({ completedHangouts: hosted.filter((hangout) => hangout.status === HangoutStatus.FINISHED).length, cancelledHangouts: hosted.filter((hangout) => hangout.status === HangoutStatus.CANCELLED).length, totalParticipants: hosted.filter((hangout) => hangout.status === HangoutStatus.FINISHED).reduce((sum, hangout) => sum + hangout.joinRequests.length, 0), ratings: hostRatings, participantRatings, verification: user.verification, resolvedReports: reports.find((report) => report.targetUserId === user.id)?._count._all ?? 0 });
      return [user.id, developerHostStatus(user.email) ?? status];
    }));
  }

  async forUser(userId: string): Promise<HostStatus> {
    const status = (await this.forUsers([userId])).get(userId);
    if (!status) throw new Error('User not found');
    return status;
  }
}
