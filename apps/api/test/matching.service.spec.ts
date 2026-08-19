import { Gender } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateMatchScore, MatchCandidate } from '../src/matching/matching.service';

const now = new Date('2026-08-18T09:00:00+09:00');
const candidate: MatchCandidate = {
  id: 'hangout-1', hostUserId: 'host-1', category: 'CAFE', serviceArea: 'SHINJUKU',
  publicLocationName: '新宿駅周辺', title: '新宿のカフェで交流', startAt: new Date('2026-08-18T19:00:00+09:00'),
  maxParticipants: 4, host: { gender: Gender.FEMALE, birthDate: new Date('1996-01-01'), socialStyles: ['少人数'], preferredLanguages: ['日本語'] },
};
const profile = {
  preferredAreas: ['新宿'], preferredActivities: ['カフェ'], preferredAgeMin: 20, preferredAgeMax: 40,
  preferredGenders: [Gender.FEMALE], activityTimeSlots: ['NIGHT', 'TUE'], participationUrgency: 'TODAY',
  preferredGroupSizes: [4], matchingDataConsent: true, behaviorLearningEnabled: true,
  socialStyles: ['少人数'], preferredLanguages: ['日本語'],
};

describe('private matching score', () => {
  it('raises the score for declared preferences and matching behavior', () => {
    const neutral = calculateMatchScore({ ...profile, preferredAreas: [], preferredActivities: [], preferredAgeMin: null, preferredAgeMax: null, preferredGenders: [], activityTimeSlots: [], participationUrgency: null, preferredGroupSizes: [], behaviorLearningEnabled: false }, candidate, [], now);
    const matched = calculateMatchScore(profile, candidate, [{ category: 'CAFE', serviceArea: 'SHINJUKU', strength: 2 }], now);
    expect(matched).toBeGreaterThan(neutral);
    expect(matched).toBeLessThanOrEqual(99);
  });

  it('matches the Japanese time and weekday values saved by the current settings UI', () => {
    const englishScore = calculateMatchScore(profile, candidate, [], now);
    const japaneseScore = calculateMatchScore({ ...profile, activityTimeSlots: ['夜', '火'] }, candidate, [], now);
    expect(japaneseScore).toBe(englishScore);
  });

  it('does not personalize without matching-data consent', () => {
    expect(calculateMatchScore({ ...profile, matchingDataConsent: false }, candidate, [{ category: 'CAFE', serviceArea: 'SHINJUKU', strength: 50 }], now)).toBe(70);
  });

  it('ignores behavior when behavior learning is disabled', () => {
    const disabled = { ...profile, behaviorLearningEnabled: false };
    expect(calculateMatchScore(disabled, candidate, [], now)).toBe(calculateMatchScore(disabled, candidate, [{ category: 'CAFE', serviceArea: 'SHINJUKU', strength: 50 }], now));
  });

  it('uses bounded interaction reliability without reading message content', () => {
    const interactionProfile = { ...profile, preferredAreas: [], preferredActivities: [], preferredAgeMin: null, preferredAgeMax: null, preferredGenders: [], activityTimeSlots: [], participationUrgency: null, preferredGroupSizes: [], socialStyles: [], preferredLanguages: [] };
    const reliable = calculateMatchScore(interactionProfile, candidate, [], now, { averageRating: 4.8, ratingCount: 8, completionRate: 0.95, conversationParticipationRate: 0.9, enforcedSafetyActions: 0 });
    const unsafe = calculateMatchScore(interactionProfile, candidate, [], now, { averageRating: 2.2, ratingCount: 8, completionRate: 0.3, conversationParticipationRate: 0, enforcedSafetyActions: 3 });
    expect(reliable).toBeGreaterThan(unsafe);
    expect(reliable - unsafe).toBeLessThanOrEqual(25);
  });
});
