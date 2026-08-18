/**
 * Increment this immutable identifier whenever scoring behavior or weights change.
 * Historical feedback keeps the version that was active when it was saved.
 */
export const MATCHING_ALGORITHM_VERSION = 'match-v1.1.0' as const;

export interface MatchingWeights {
  baseScore: number; activityMatch: number; activityMiss: number; areaMatch: number; areaMiss: number;
  timeMatch: number; timeMiss: number; groupMatch: number; ageMatch: number; ageMiss: number;
  languageMatch: number; safetyPenalty: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = Object.freeze({
  baseScore: 62, activityMatch: 12, activityMiss: -4, areaMatch: 10, areaMiss: -5,
  timeMatch: 8, timeMiss: -3, groupMatch: 7, ageMatch: 5, ageMiss: -5,
  languageMatch: 4, safetyPenalty: 4,
});
