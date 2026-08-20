import { Inject, Injectable } from '@nestjs/common';
import { FunnelEventType, Gender, HangoutStatus, JoinRequestStatus, ModerationActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export { MATCHING_ALGORITHM_VERSION } from './matching-version';
import { DEFAULT_MATCHING_WEIGHTS, MATCHING_ALGORITHM_VERSION, MatchingWeights } from './matching-version';
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

interface BehaviorSignal { category: string; serviceArea: string; strength: number; occurredAt?: Date }
export interface InteractionSignal { averageRating: number | null; ratingCount: number; completionRate: number | null; conversationParticipationRate: number | null; enforcedSafetyActions: number }

export type MatchPattern = 'ACTIVITY_INTENT' | 'LIFE_RHYTHM' | 'BODY_RHYTHM' | 'DECISION_STYLE' | 'MOBILITY' | 'PARTICIPATION_PACE' | 'SOCIAL_STYLE' | 'TRUST_SAFETY';
export interface MatchResult { score: number; algorithmVersion: typeof MATCHING_ALGORITHM_VERSION; reasons: string[]; patterns: Partial<Record<MatchPattern, number>> }

const clamp = (value: number) => Math.max(40, Math.min(99, Math.round(value)));
const normalized = (value: string) => value.trim().toLocaleLowerCase('ja-JP');
const includesLoose = (values: string[], ...targets: string[]) => values.some(value => targets.some(target => normalized(value).includes(normalized(target)) || normalized(target).includes(normalized(value))));

function slotKeys(date: Date) {
  const japanTime = new Date(date.getTime() + 9 * 3_600_000);
  const hour = japanTime.getUTCHours();
  const time = hour < 6 ? ['LATE_NIGHT', '深夜'] : hour < 11 ? ['MORNING', '朝'] : hour < 15 ? ['DAYTIME', '昼'] : hour < 19 ? ['EVENING', '夕方'] : ['NIGHT', '夜'];
  const dayIndex = japanTime.getUTCDay();
  const day = [
    ['SUN', '日'], ['MON', '月'], ['TUE', '火'], ['WED', '水'], ['THU', '木'], ['FRI', '金'], ['SAT', '土'],
  ][dayIndex]!;
  return [...time, ...day];
}

function age(birthDate?: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let value = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) value -= 1;
  return value;
}

export function calculateMatchResult(profile: MatchProfile, candidate: MatchCandidate, behavior: BehaviorSignal[] = [], now = new Date(), interaction?: InteractionSignal, weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS): MatchResult {
  if (!profile.matchingDataConsent) return { score: 70, algorithmVersion: MATCHING_ALGORITHM_VERSION, reasons: ['開催日時が近い順に表示しています'], patterns: {} };
  let score = weights.baseScore;
  const patterns: Partial<Record<MatchPattern, number>> = {};
  const reasons: string[] = [];
  const add = (pattern: MatchPattern, value: number, reason?: string) => { score += value; patterns[pattern] = (patterns[pattern] ?? 0) + value; if (reason && value > 0) reasons.push(reason); };
  const activityAliases: Record<string, string[]> = {
    FOOD: ['グルメ', '食事', 'ラーメン'], CAFE: ['カフェ', 'コーヒー'], RUNNING: ['ランニング', '運動', 'スポーツ'],
    WALKING: ['散歩', 'ウォーキング'], MOTORCYCLE: ['ツーリング', 'バイク'],
  };
  const searchableActivity = [candidate.category, candidate.title, ...(activityAliases[candidate.category] ?? [])];
  const searchableArea = [candidate.serviceArea, candidate.publicLocationName];

  if (profile.preferredActivities.length) add('ACTIVITY_INTENT', includesLoose(profile.preferredActivities, ...searchableActivity) ? weights.activityMatch : weights.activityMiss, 'やりたい活動と一致');
  if (profile.preferredAreas.length) add('MOBILITY', includesLoose(profile.preferredAreas, ...searchableArea) ? weights.areaMatch : weights.areaMiss, '希望エリアと一致');
  if (profile.activityTimeSlots.length) {
    const keys = slotKeys(candidate.startAt);
    add('BODY_RHYTHM', includesLoose(profile.activityTimeSlots, ...keys) ? weights.timeMatch : weights.timeMiss, '活動しやすい時間帯');
  }
  if (profile.preferredGroupSizes.length) {
    const distance = Math.min(...profile.preferredGroupSizes.map(size => Math.abs(size - candidate.maxParticipants)));
    add('PARTICIPATION_PACE', distance === 0 ? weights.groupMatch : distance <= 2 ? weights.groupMatch * 0.4 : -3, '希望するグループ規模');
  }
  const hostAge = age(candidate.host.birthDate);
  if (hostAge !== null && (profile.preferredAgeMin !== null || profile.preferredAgeMax !== null)) {
    add('SOCIAL_STYLE', (profile.preferredAgeMin === null || hostAge >= profile.preferredAgeMin) && (profile.preferredAgeMax === null || hostAge <= profile.preferredAgeMax) ? weights.ageMatch : weights.ageMiss);
  }
  if (profile.preferredGenders.length && candidate.host.gender) add('SOCIAL_STYLE', profile.preferredGenders.includes(candidate.host.gender) ? 4 : -4);
  if (profile.socialStyles.length && candidate.host.socialStyles?.length) add('SOCIAL_STYLE', includesLoose(profile.socialStyles, ...candidate.host.socialStyles) ? 3 : 0, '活動スタイルが近い');
  if (profile.preferredLanguages.length && candidate.host.preferredLanguages?.length) add('SOCIAL_STYLE', includesLoose(profile.preferredLanguages, ...candidate.host.preferredLanguages) ? weights.languageMatch : -Math.min(2, weights.languageMatch), '希望言語と一致');

  const hoursAway = Math.max(0, (candidate.startAt.getTime() - now.getTime()) / 3_600_000);
  if (profile.participationUrgency === 'NOW') add('LIFE_RHYTHM', hoursAway <= 3 ? 7 : -3, '今すぐ参加しやすい');
  else if (profile.participationUrgency === 'TODAY') add('LIFE_RHYTHM', hoursAway <= 24 ? 5 : -2, '今日参加しやすい');
  else if (profile.participationUrgency === 'THIS_WEEK') add('LIFE_RHYTHM', hoursAway <= 24 * 7 ? 4 : -2, '今週の予定に合う');
  else if (profile.participationUrgency === 'WEEKEND') add('LIFE_RHYTHM', [0, 6].includes(candidate.startAt.getDay()) ? 5 : -2, '週末の予定に合う');

  if (profile.behaviorLearningEnabled) {
    let behaviorScore = 0;
    for (const signal of behavior) {
      const ageDays = signal.occurredAt ? Math.max(0, (now.getTime() - signal.occurredAt.getTime()) / 86_400_000) : 0;
      const decay = Math.pow(0.5, ageDays / 30);
      if (normalized(signal.category) === normalized(candidate.category)) behaviorScore += signal.strength * decay;
      if (normalized(signal.serviceArea) === normalized(candidate.serviceArea)) behaviorScore += signal.strength * 0.45 * decay;
    }
    add('DECISION_STYLE', Math.min(8, behaviorScore), '最近の活動傾向に合う');
    if (interaction) {
      const confidence = Math.min(1, interaction.ratingCount / 10);
      if (interaction.averageRating !== null) add('TRUST_SAFETY', Math.max(-4, Math.min(4, (interaction.averageRating - 3) * 2)) * confidence);
      if (interaction.completionRate !== null) add('TRUST_SAFETY', Math.max(-3, Math.min(3, (interaction.completionRate - 0.7) * 6)), '開催実績が安定');
      if (interaction.conversationParticipationRate !== null) add('TRUST_SAFETY', Math.max(0, Math.min(2, interaction.conversationParticipationRate * 2)));
      add('TRUST_SAFETY', -Math.min(weights.safetyPenalty * 2, interaction.enforcedSafetyActions * weights.safetyPenalty));
    }
  }
  return { score: clamp(score), algorithmVersion: MATCHING_ALGORITHM_VERSION, reasons: [...new Set(reasons)].slice(0, 3), patterns };
}

export function calculateMatchScore(profile: MatchProfile, candidate: MatchCandidate, behavior: BehaviorSignal[] = [], now = new Date(), interaction?: InteractionSignal, weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS) {
  return calculateMatchResult(profile, candidate, behavior, now, interaction, weights).score;
}

@Injectable()
export class MatchingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(MatchingAdminService) private readonly admin: MatchingAdminService) {}

  async scoresFor(userId: string, candidates: MatchCandidate[]) {
    const results = await this.resultsFor(userId, candidates);
    return new Map([...results].map(([id, result]) => [id, result.score]));
  }

  async resultsFor(userId: string, candidates: MatchCandidate[]) {
    const profile = await this.db.user.findUnique({ where: { id: userId }, select: {
      preferredAreas: true, preferredActivities: true, preferredAgeMin: true, preferredAgeMax: true,
      preferredGenders: true, activityTimeSlots: true, participationUrgency: true, preferredGroupSizes: true,
      matchingDataConsent: true, behaviorLearningEnabled: true,
      socialStyles: true, preferredLanguages: true,
    }});
    if (!profile) return new Map<string, MatchResult>();
    const learningEnabled = profile.matchingDataConsent && profile.behaviorLearningEnabled;
    const [behavior, interactions, weights] = await Promise.all([
      learningEnabled ? this.behaviorSignals(userId) : Promise.resolve([]),
      learningEnabled ? this.interactionSignals(candidates.map(candidate => candidate.hostUserId)) : Promise.resolve(new Map<string, InteractionSignal>()),
      this.admin.activeWeights(),
    ]);
    return new Map(candidates.map(candidate => [candidate.id, calculateMatchResult(profile, candidate, behavior, new Date(), interactions.get(candidate.hostUserId), weights)]));
  }

  private async behaviorSignals(userId: string): Promise<BehaviorSignal[]> {
    const [hearted, joined, hosted, viewed] = await Promise.all([
      this.db.hangout.findMany({ where: { hearts: { some: { userId } } }, select: { category: true, serviceArea: true, updatedAt: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { joinRequests: { some: { userId, status: JoinRequestStatus.ACCEPTED } } }, select: { category: true, serviceArea: true, updatedAt: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { hostUserId: userId }, select: { category: true, serviceArea: true, updatedAt: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
      this.db.hangout.findMany({ where: { funnelEvents: { some: { userId, eventType: FunnelEventType.HANGOUT_VIEWED } } }, select: { category: true, serviceArea: true, updatedAt: true }, take: 50, orderBy: { updatedAt: 'desc' } }),
    ]);
    const compact = (rows: Array<{ category: string; serviceArea: string; updatedAt: Date }>, strength: number) => rows.slice(0, 12).map(row => ({ category: row.category, serviceArea: row.serviceArea, occurredAt: row.updatedAt, strength }));
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
