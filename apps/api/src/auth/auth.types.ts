export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  birthDate: string;
  bio: string | null;
  homeArea: string | null;
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
  phoneNumber: string | null;
}

export interface StoredUser extends PublicUser { passwordHash: string; }
export interface StoredRefreshToken { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; }
export interface StoredPhoneVerification { id: string; userId: string; phone: string; codeHash: string; expiresAt: Date; usedAt: Date | null; attempts: number; requestIp?: string | null; createdAt?: Date; }

export abstract class AuthRepository {
  abstract findUserByEmail(email: string): Promise<StoredUser | null>;
  abstract findUserById(id: string): Promise<StoredUser | null>;
  abstract createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date }): Promise<StoredUser>;
  abstract updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null }): Promise<StoredUser>;
  abstract saveRefreshToken(token: StoredRefreshToken): Promise<void>;
  abstract findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  abstract revokeRefreshToken(id: string): Promise<void>;
  abstract createPhoneVerification(input: StoredPhoneVerification): Promise<void>;
  abstract findPhoneVerification(userId: string, phone: string): Promise<StoredPhoneVerification | null>;
  abstract failPhoneVerification(id: string): Promise<void>;
  abstract verifyPhone(userId: string, phone: string, verificationId: string): Promise<StoredUser>;
  abstract phoneVerificationCounts(userId: string, phone: string, requestIp: string, since: Date): Promise<{user: number; phone: number; ip: number}>;
}
