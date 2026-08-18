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
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
  profilePhotos: string[];
  phoneNumber: string | null;
}

export interface StoredUser extends PublicUser { passwordHash: string; }
export interface StoredRefreshToken { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; }
export interface StoredPhoneVerification { id: string; userId: string; phone: string; codeHash: string; expiresAt: Date; usedAt: Date | null; attempts: number; requestIp?: string | null; createdAt?: Date; }
export interface StoredOAuthLoginTicket { id: string; tokenHash: string; provider: string; subject: string; displayName: string | null; profilePhoto: string | null; userId: string | null; expiresAt: Date; usedAt: Date | null; }

export abstract class AuthRepository {
  abstract findUserByEmail(email: string): Promise<StoredUser | null>;
  abstract findUserById(id: string): Promise<StoredUser | null>;
  abstract findUserByPhone(phone: string): Promise<StoredUser | null>;
  abstract createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date | null; gender?: string }): Promise<StoredUser>;
  abstract updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; profilePhotos?: string[]; gender?: string; preferredAreas?: string[]; preferredActivities?: string[]; preferredAgeMin?: number | null; preferredAgeMax?: number | null; preferredGenders?: string[]; activityTimeSlots?: string[]; matchingDataConsent?: boolean; participationUrgency?: string | null; maxTravelMinutes?: number | null; preferredGroupSizes?: number[]; budgetMin?: number | null; budgetMax?: number | null; socialStyles?: string[]; participationGoals?: string[]; firstTimePreferences?: string[]; alcoholPreference?: string | null; smokingPreference?: string | null }): Promise<StoredUser>;
  abstract saveRefreshToken(token: StoredRefreshToken): Promise<void>;
  abstract findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  abstract revokeRefreshToken(id: string): Promise<void>;
  abstract createPhoneVerification(input: StoredPhoneVerification): Promise<void>;
  abstract findPhoneVerification(userId: string, phone: string): Promise<StoredPhoneVerification | null>;
  abstract failPhoneVerification(id: string): Promise<void>;
  abstract verifyPhone(userId: string, phone: string, verificationId: string): Promise<StoredUser>;
  abstract setVerifiedPhone(userId: string, phone: string): Promise<StoredUser>;
  abstract phoneVerificationCounts(userId: string, phone: string, requestIp: string, since: Date): Promise<{user: number; phone: number; ip: number}>;
  abstract deleteUser(userId: string): Promise<void>;
  abstract findOAuthIdentity(provider: string, subject: string): Promise<StoredUser | null>;
  abstract createOAuthIdentity(provider: string, subject: string, userId: string): Promise<void>;
  abstract saveOAuthLoginTicket(input: StoredOAuthLoginTicket): Promise<void>;
  abstract findOAuthLoginTicket(tokenHash: string): Promise<StoredOAuthLoginTicket | null>;
  abstract consumeOAuthLoginTicket(id: string): Promise<void>;
}
