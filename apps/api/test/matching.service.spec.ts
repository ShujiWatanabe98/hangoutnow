import { Gender } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateMatchResult, calculateMatchScore, MatchCandidate } from '../src/matching/matching.service';

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

  it('keeps current activity intent stronger than accumulated past behavior', () => {
    const matchingActivity = calculateMatchResult(profile, candidate, [], now);
    const oldSignals = Array.from({ length: 40 }, () => ({ category: 'RUNNING', serviceArea: 'SHIBUYA', strength: 5, occurredAt: new Date('2025-01-01') }));
    const mismatchingActivity = calculateMatchResult({ ...profile, preferredActivities: ['ランニング'] }, candidate, oldSignals, now);
    expect(matchingActivity.patterns.ACTIVITY_INTENT ?? 0).toBeGreaterThan(mismatchingActivity.patterns.ACTIVITY_INTENT ?? 0);
    expect(matchingActivity.patterns.ACTIVITY_INTENT ?? 0).toBeGreaterThan(mismatchingActivity.patterns.DECISION_STYLE ?? 0);
  });

  it('decays old behavior and caps the decision-style contribution', () => {
    const recent = calculateMatchResult(profile, candidate, [{ category: 'CAFE', serviceArea: 'SHINJUKU', strength: 20, occurredAt: now }], now);
    const old = calculateMatchResult(profile, candidate, [{ category: 'CAFE', serviceArea: 'SHINJUKU', strength: 20, occurredAt: new Date('2025-08-18') }], now);
    expect(recent.patterns.DECISION_STYLE).toBe(8);
    expect(old.patterns.DECISION_STYLE).toBeLessThan(1);
  });

  it('returns explainable pattern scores without exposing private data', () => {
    const result = calculateMatchResult(profile, candidate, [], now, { averageRating: 4.8, ratingCount: 8, completionRate: 0.95, conversationParticipationRate: 0.9, enforcedSafetyActions: 0 });
    expect(result.algorithmVersion).toBe('match-v1.2.0');
    expect(result.reasons).toContain('やりたい活動と一致');
    expect(result.reasons.length).toBeLessThanOrEqual(3);
    expect(result.patterns).toMatchObject({ ACTIVITY_INTENT: expect.any(Number), LIFE_RHYTHM: expect.any(Number), BODY_RHYTHM: expect.any(Number), TRUST_SAFETY: expect.any(Number) });
    expect(JSON.stringify(result)).not.toMatch(/message|latitude|longitude/i);
  });

  it('reduces low-sample rating influence', () => {
    const neutralProfile = { ...profile, preferredAreas: [], preferredActivities: [], preferredAgeMin: null, preferredAgeMax: null, preferredGenders: [], activityTimeSlots: [], participationUrgency: null, preferredGroupSizes: [], socialStyles: [], preferredLanguages: [] };
    const oneRating = calculateMatchResult(neutralProfile, candidate, [], now, { averageRating: 5, ratingCount: 1, completionRate: null, conversationParticipationRate: null, enforcedSafetyActions: 0 });
    const tenRatings = calculateMatchResult(neutralProfile, candidate, [], now, { averageRating: 5, ratingCount: 10, completionRate: null, conversationParticipationRate: null, enforcedSafetyActions: 0 });
    expect(tenRatings.patterns.TRUST_SAFETY ?? 0).toBeGreaterThan(oneRating.patterns.TRUST_SAFETY ?? 0);
  });
});
