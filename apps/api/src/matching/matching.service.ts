import { Inject, Injectable } from '@nestjs/common';
import { FunnelEventType, Gender, JoinRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MatchCandidate {
  id: string;
  hostUserId: string;
  category: string;
  serviceArea: string;
  publicLocationName: string;
  title: string;
  startAt: Date;
  maxParticipants: number;
  host: { gender?: Gender | null; birthDate?: Date | null };
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
}

interface BehaviorSignal { category: string; serviceArea: string; strength: number }

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

export function calculateMatchScore(profile: MatchProfile, candidate: MatchCandidate, behavior: BehaviorSignal[] = [], now = new Date()) {
  if (!profile.matchingDataConsent) return 70;
  let score = 62;
  const activityAliases: Record<string, string[]> = {
    FOOD: ['グルメ', '食事', 'ラーメン'], CAFE: ['カフェ', 'コーヒー'], RUNNING: ['ランニング', '運動', 'スポーツ'],
    WALKING: ['散歩', 'ウォーキング'], MOTORCYCLE: ['ツーリング', 'バイク'],
  };
  const searchableActivity = [candidate.category, candidate.title, ...(activityAliases[candidate.category] ?? [])];
  const searchableArea = [candidate.serviceArea, candidate.publicLocationName];

  if (profile.preferredActivities.length) score += includesLoose(profile.preferredActivities, ...searchableActivity) ? 12 : -4;
  if (profile.preferredAreas.length) score += includesLoose(profile.preferredAreas, ...searchableArea) ? 10 : -5;
  if (profile.activityTimeSlots.length) {
    const keys = slotKeys(candidate.startAt);
    score += includesLoose(profile.activityTimeSlots, ...keys) ? 8 : -3;
  }
  if (profile.preferredGroupSizes.length) {
    const distance = Math.min(...profile.preferredGroupSizes.map(size => Math.abs(size - candidate.maxParticipants)));
    score += distance === 0 ? 7 : distance <= 2 ? 3 : -3;
  }
  const hostAge = age(candidate.host.birthDate);
  if (hostAge !== null && (profile.preferredAgeMin !== null || profile.preferredAgeMax !== null)) {
    score += (profile.preferredAgeMin === null || hostAge >= profile.preferredAgeMin) && (profile.preferredAgeMax === null || hostAge <= profile.preferredAgeMax) ? 5 : -5;
  }
  if (profile.preferredGenders.length && candidate.host.gender) score += profile.preferredGenders.includes(candidate.host.gender) ? 4 : -4;

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
  }
  return clamp(score);
}

@Injectable()
export class MatchingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async scoresFor(userId: string, candidates: MatchCandidate[]) {
    const profile = await this.db.user.findUnique({ where: { id: userId }, select: {
      preferredAreas: true, preferredActivities: true, preferredAgeMin: true, preferredAgeMax: true,
      preferredGenders: true, activityTimeSlots: true, participationUrgency: true, preferredGroupSizes: true,
      matchingDataConsent: true, behaviorLearningEnabled: true,
    }});
    if (!profile) return new Map<string, number>();
    const behavior = profile.matchingDataConsent && profile.behaviorLearningEnabled ? await this.behaviorSignals(userId) : [];
    return new Map(candidates.map(candidate => [candidate.id, calculateMatchScore(profile, candidate, behavior)]));
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
}
