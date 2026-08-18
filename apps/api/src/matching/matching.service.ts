import { Inject, Injectable } from '@nestjs/common';
import { FunnelEventType, Gender, HangoutStatus, JoinRequestStatus, ModerationActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export { MATCHING_ALGORITHM_VERSION } from './matching-version';
import { DEFAULT_MATCHING_WEIGHTS, MatchingWeights } from './matching-version';
import { MatchingAdminService } from './matching-admin.service';

export interface MatchCandidate {
  id: string;
  hostUserId: string;
  category: string;
  serviceArea: string;
  publicLocationName: string;
  title: string;
  startAt: Date;
  maxParticipants: number;
  host: { gender?: Gender | null; birthDate?: Date | null; socialStyles?: string[]; preferredLanguages?: string[] };
}

interface MatchProfile {
  preferredAreas: string[];
  preferredActivities: string[];
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredGenders: Gender[];
  activityTimeSlots: string[];
  participationUrgency: string | null;
  preferredGroupSizes: number[];
  matchingDataConsent: boolean;
  behaviorLearningEnabled: boolean;
  socialStyles: string[];
  preferredLanguages: string[];
}

interface BehaviorSignal { category: string; serviceArea: string; strength: number }
export interface InteractionSignal { averageRating: number | null; ratingCount: number; completionRate: number | null; conversationParticipationRate: number | null; enforcedSafetyActions: number }

const clamp = (value: number) => Math.max(40, Math.min(99, Math.round(value)));
const normalized = (value: string) => value.trim().toLocaleLowerCase('ja-JP');
const includesLoose = (values: string[], ...targets: string[]) => values.some(value => targets.some(target => normalized(value).includes(normalized(target)) || normalized(target).includes(normalized(value))));

function slotKeys(date: Date) {
  const japanTime = new Date(date.getTime() + 9 * 3_600_000);
  const hour = japanTime.getUTCHours();
  const time = hour < 6 ? 'LATE_NIGHT' : hour < 11 ? 'MORNING' : hour < 15 ? 'DAYTIME' : hour < 19 ? 'EVENING' : hour < 24 ? 'NIGHT' : 'LATE_NIGHT';
  return [time, ['SUN','MON','TUE','WED','THU','FRI','SAT'][japanTime.getUTCDay()]!];
}

function age(birthDate?: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let value = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) value -= 1;
  return value;
}

export function calculateMatchScore(profile: MatchProfile, candidate: MatchCandidate, behavior: BehaviorSignal[] = [], now = new Date(), interaction?: InteractionSignal, weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS) {
  if (!profile.matchingDataConsent) return 70;
  let score = weights.baseScore;
  const activityAliases: Record<string, string[]> = {
    FOOD: ['グルメ', '食事', 'ラーメン'], CAFE: ['カフェ', 'コーヒー'], RUNNING: ['ランニング', '運動', 'スポーツ'],
    WALKING: ['散歩', 'ウォーキング'], MOTORCYCLE: ['ツーリング', 'バイク'],
  };
  const searchableActivity = [candidate.category, candidate.title, ...(activityAliases[candidate.category] ?? [])];
  const searchableArea = [candidate.serviceArea, candidate.publicLocationName];

  if (profile.preferredActivities.length) score += includesLoose(profile.preferredActivities, ...searchableActivity) ? weights.activityMatch : weights.activityMiss;
  if (profile.preferredAreas.length) score += includesLoose(profile.preferredAreas, ...searchableArea) ? weights.areaMatch : weights.areaMiss;
  if (profile.activityTimeSlots.length) {
    const keys = slotKeys(candidate.startAt);
    score += includesLoose(profile.activityTimeSlots, ...keys) ? weights.timeMatch : weights.timeMiss;
  }
  if (profile.preferredGroupSizes.length) {
    const distance = Math.min(...profile.preferredGroupSizes.map(size => Math.abs(size - candidate.maxParticipants)));
    score += distance === 0 ? weights.groupMatch : distance <= 2 ? weights.groupMatch * 0.4 : -3;
  }
  const hostAge = age(candidate.host.birthDate);
  if (hostAge !== null && (profile.preferredAgeMin !== null || profile.preferredAgeMax !== null)) {
    score += (profile.preferredAgeMin === null || hostAge >= profile.preferredAgeMin) && (profile.preferredAgeMax === null || hostAge <= profile.preferredAgeMax) ? weights.ageMatch : weights.ageMiss;
  }
  if (profile.preferredGenders.length && candidate.host.gender) score += profile.preferredGenders.includes(candidate.host.gender) ? 4 : -4;
  if (profile.socialStyles.length && candidate.host.socialStyles?.length) score += includesLoose(profile.socialStyles, ...candidate.host.socialStyles) ? 3 : 0;
  if (profile.preferredLanguages.length && candidate.host.preferredLanguages?.length) score += includesLoose(profile.preferredLanguages, ...candidate.host.preferredLanguages) ? weights.languageMatch : -Math.min(2, weights.languageMatch);

  const hoursAway = Math.max(0, (candidate.startAt.getTime() - now.getTime()) / 3_600_000);
  if (profile.participationUrgency === 'NOW') score += hoursAway <= 3 ? 7 : -3;
  else if (profile.participationUrgency === 'TODAY') score += hoursAway <= 24 ? 5 : -2;
  else if (profile.participationUrgency === 'THIS_WEEK') score += hoursAway <= 24 * 7 ? 4 : -2;
  else if (profile.participationUrgency === 'WEEKEND') score += [0, 6].includes(candidate.startAt.getDay()) ? 5 : -2;

  if (profile.behaviorLearningEnabled) {
    for (const signal of behavior) {
      if (normalized(signal.category) === normalized(candidate.category)) score += signal.strength;
      if (normalized(signal.serviceArea) === normalized(candidate.serviceArea)) score += signal.strength * 0.45;
    }
    if (interaction) {
      if (interaction.ratingCount >= 3 && interaction.averageRating !== null) score += Math.max(-4, Math.min(4, (interaction.averageRating - 3) * 2));
      if (interaction.completionRate !== null) score += Math.max(-3, Math.min(3, (interaction.completionRate - 0.7) * 6));
      if (interaction.conversationParticipationRate !== null) score += Math.max(0, Math.min(2, interaction.conversationParticipationRate * 2));
      score -= Math.min(weights.safetyPenalty * 2, interaction.enforcedSafetyActions * weights.safetyPenalty);
    }
  }
  return clamp(score);
}

@Injectable()
export class MatchingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(MatchingAdminService) private readonly admin: MatchingAdminService) {}

  async scoresFor(userId: string, candidates: MatchCandidate[]) {
    const profile = await this.db.user.findUnique({ where: { id: userId }, select: {
      preferredAreas: true, preferredActivities: true, preferredAgeMin: true, preferredAgeMax: true,
      preferredGenders: true, activityTimeSlots: true, participationUrgency: true, preferredGroupSizes: true,
      matchingDataConsent: true, behaviorLearningEnabled: true,
      socialStyles: true, preferredLanguages: true,
    }});
    if (!profile) return new Map<string, number>();
    const learningEnabled = profile.matchingDataConsent && profile.behaviorLearningEnabled;
    const [behavior, interactions, weights] = await Promise.all([
      learningEnabled ? this.behaviorSignals(userId) : Promise.resolve([]),
      learningEnabled ? this.interactionSignals(candidates.map(candidate => candidate.hostUserId)) : Promise.resolve(new Map<string, InteractionSignal>()),
      this.admin.activeWeights(),
    ]);
    return new Map(candidates.map(candidate => [candidate.id, calculateMatchScore(profile, candidate, behavior, new Date(), interactions.get(candidate.hostUserId), weights)]));
  }

  private async behaviorSignals(userId: string): Promise<BehaviorSignal[]> {
    const [hearted, joined, hosted, viewed] = await Promise.all([
      this.db.hangout.findMany({ where: { hearts: { some: { userId } } }, select: { category: true, serviceArea: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { joinRequests: { some: { userId, status: JoinRequestStatus.ACCEPTED } } }, select: { category: true, serviceArea: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { hostUserId: userId }, select: { category: true, serviceArea: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { funnelEvents: { some: { userId, eventType: FunnelEventType.HANGOUT_VIEWED } } }, select: { category: true, serviceArea: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
    ]);
    const compact = (rows: Array<{ category: string; serviceArea: string }>, strength: number) => rows.slice(0, 12).map(row => ({ ...row, strength }));
    return [...compact(hearted, 0.8), ...compact(joined, 1.5), ...compact(hosted, 1.2), ...compact(viewed, 0.25)];
  }

  private async interactionSignals(hostUserIds: string[]) {
    const ids = [...new Set(hostUserIds)];
    if (!ids.length) return new Map<string, InteractionSignal>();
    const [ratings, hosted, conversationRooms, actions] = await Promise.all([
      this.db.hangoutRating.groupBy({ by: ['ratedUserId'], where: { ratedUserId: { in: ids } }, _avg: { score: true }, _count: { score: true } }),
      this.db.hangout.groupBy({ by: ['hostUserId', 'status'], where: { hostUserId: { in: ids } }, _count: { _all: true } }),
      this.db.message.findMany({ where: { senderUserId: { in: ids }, room: { hangout: { hostUserId: { in: ids } } } }, select: { roomId: true, senderUserId: true, room: { select: { hangout: { select: { hostUserId: true } } } } } }),
      this.db.moderationAction.findMany({ where: { targetUserId: { in: ids }, action: { in: [ModerationActionType.WARNING, ModerationActionType.SUSPEND, ModerationActionType.BAN] } }, select: { targetUserId: true } }),
    ]);
    const result = new Map<string, InteractionSignal>();
    for (const id of ids) {
      const rating = ratings.find(row => row.ratedUserId === id);
      const hostRows = hosted.filter(row => row.hostUserId === id);
      const total = hostRows.reduce((sum, row) => sum + row._count._all, 0);
      const completed = hostRows.find(row => row.status === HangoutStatus.FINISHED)?._count._all ?? 0;
      const roomsWithHostMessage = new Set(conversationRooms.filter(message => message.senderUserId === id && message.room.hangout.hostUserId === id).map(message => message.roomId)).size;
      result.set(id, {
        averageRating: rating?._avg.score ?? null, ratingCount: rating?._count.score ?? 0,
        completionRate: total ? completed / total : null,
        conversationParticipationRate: total ? Math.min(1, roomsWithHostMessage / total) : null,
        enforcedSafetyActions: actions.filter(row => row.targetUserId === id).length,
      });
    }
    return result;
  }
}
