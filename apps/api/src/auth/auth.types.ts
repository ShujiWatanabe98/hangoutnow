export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  birthDate: string | null;
  gender: string | null;
  bio: string | null;
  homeArea: string | null;
  preferredAreas: string[];
  preferredActivities: string[];
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredGenders: string[];
  activityTimeSlots: string[];
  matchingDataConsent: boolean;
  participationUrgency: string | null;
  maxTravelMinutes: number | null;
  preferredGroupSizes: number[];
  budgetMin: number | null;
  budgetMax: number | null;
  socialStyles: string[];
  participationGoals: string[];
  firstTimePreferences: string[];
  alcoholPreference: string | null;
  smokingPreference: string | null;
  avoidPreferences: string[];
  scheduleFlexibility: string[];
  behaviorLearningEnabled: boolean;
  preferredLanguages: string[];
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
  profilePhotos: string[];
}

export interface StoredUser extends PublicUser { passwordHash: string; }
export interface StoredRefreshToken { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; }
export interface StoredOAuthLoginTicket { id: string; tokenHash: string; provider: string; subject: string; displayName: string | null; profilePhoto: string | null; userId: string | null; expiresAt: Date; usedAt: Date | null; }
export interface AcquisitionInput { source: string; medium: string; campaign: string; content: string; }

export abstract class AuthRepository {
  abstract findUserByEmail(email: string): Promise<StoredUser | null>;
  abstract findUserById(id: string): Promise<StoredUser | null>;
  abstract createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date | null; gender?: string; acquisition?: AcquisitionInput }): Promise<StoredUser>;
  abstract updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; profilePhotos?: string[]; gender?: string; preferredAreas?: string[]; preferredActivities?: string[]; preferredAgeMin?: number | null; preferredAgeMax?: number | null; preferredGenders?: string[]; activityTimeSlots?: string[]; matchingDataConsent?: boolean; participationUrgency?: string | null; maxTravelMinutes?: number | null; preferredGroupSizes?: number[]; budgetMin?: number | null; budgetMax?: number | null; socialStyles?: string[]; participationGoals?: string[]; firstTimePreferences?: string[]; alcoholPreference?: string | null; smokingPreference?: string | null; avoidPreferences?: string[]; scheduleFlexibility?: string[]; behaviorLearningEnabled?: boolean; preferredLanguages?: string[] }): Promise<StoredUser>;
  abstract saveRefreshToken(token: StoredRefreshToken): Promise<void>;
  abstract findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  abstract revokeRefreshToken(id: string): Promise<void>;
  abstract deleteUser(userId: string): Promise<void>;
  abstract findOAuthIdentity(provider: string, subject: string): Promise<StoredUser | null>;
  abstract createOAuthIdentity(provider: string, subject: string, userId: string): Promise<void>;
  abstract saveOAuthLoginTicket(input: StoredOAuthLoginTicket): Promise<void>;
  abstract findOAuthLoginTicket(tokenHash: string): Promise<StoredOAuthLoginTicket | null>;
  abstract consumeOAuthLoginTicket(id: string): Promise<void>;
}
