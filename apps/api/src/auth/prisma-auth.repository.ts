import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AcquisitionInput, AuthRepository, StoredOAuthCredential, StoredOAuthLoginTicket, StoredRefreshToken, StoredUser } from './auth.types';

const includeInterests = { interests: { include: { interest: true } } } as const;

@Injectable()
export class PrismaAuthRepository extends AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { super(); }

  private mapUser(user: Awaited<ReturnType<PrismaAuthRepository['loadUser']>>): StoredUser {
    return {
      id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null, gender: user.gender, bio: user.bio, homeArea: user.homeArea,
      preferredAreas: user.preferredAreas, preferredActivities: user.preferredActivities,
      preferredAgeMin: user.preferredAgeMin, preferredAgeMax: user.preferredAgeMax,
      preferredGenders: user.preferredGenders, activityTimeSlots: user.activityTimeSlots,
      matchingDataConsent: user.matchingDataConsent,
      participationUrgency: user.participationUrgency, maxTravelMinutes: user.maxTravelMinutes,
      preferredGroupSizes: user.preferredGroupSizes, budgetMin: user.budgetMin, budgetMax: user.budgetMax,
      socialStyles: user.socialStyles, participationGoals: user.participationGoals, firstTimePreferences: user.firstTimePreferences,
      alcoholPreference: user.alcoholPreference, smokingPreference: user.smokingPreference,
      avoidPreferences: user.avoidPreferences, scheduleFlexibility: user.scheduleFlexibility, behaviorLearningEnabled: user.behaviorLearningEnabled,
      preferredLanguages: user.preferredLanguages,
      verificationStatus: user.verification, interests: user.interests.map((item) => item.interest.name),
      profilePhoto: user.profilePhoto, profilePhotos: user.profilePhotos,
    };
  }

  private async loadUser(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: includeInterests });
    return user;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: includeInterests });
    return user ? this.mapUser(user) : null;
  }
  async findUserById(id: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: includeInterests });
    return user ? this.mapUser(user) : null;
  }
  async createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date | null; gender?: string; acquisition?: AcquisitionInput }): Promise<StoredUser> {
    const { acquisition, ...profile } = input;
    const user = await this.prisma.user.create({ data: { id: uuidv7(), ...profile, gender: profile.gender as 'MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED'|undefined, ...(acquisition ? { acquisitionAttribution: { create: acquisition } } : {}) }, include: includeInterests });
    return this.mapUser(user);
  }
  async updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; profilePhotos?: string[]; gender?: string; preferredAreas?: string[]; preferredActivities?: string[]; preferredAgeMin?: number | null; preferredAgeMax?: number | null; preferredGenders?: string[]; activityTimeSlots?: string[]; matchingDataConsent?: boolean; participationUrgency?: string | null; maxTravelMinutes?: number | null; preferredGroupSizes?: number[]; budgetMin?: number | null; budgetMax?: number | null; socialStyles?: string[]; participationGoals?: string[]; firstTimePreferences?: string[]; alcoholPreference?: string | null; smokingPreference?: string | null; avoidPreferences?: string[]; scheduleFlexibility?: string[]; behaviorLearningEnabled?: boolean; preferredLanguages?: string[] }): Promise<StoredUser> {
    const { interests, gender, preferredGenders, matchingDataConsent, participationUrgency, ...profile } = input;
    const user = await this.prisma.user.update({
      where: { id: userId }, data: {
        ...profile, ...(gender ? { gender: gender as 'MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED' } : {}),
        ...(preferredGenders ? { preferredGenders: preferredGenders as ('MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED')[] } : {}),
        ...(matchingDataConsent === undefined ? {} : { matchingDataConsent, matchingDataConsentAt: matchingDataConsent ? new Date() : null }),
        ...(participationUrgency === undefined ? {} : { participationUrgency: participationUrgency as 'NOW'|'TODAY'|'THIS_WEEK'|'WEEKEND'|'FLEXIBLE'|null }),
        ...(interests ? { interests: { deleteMany: {}, create: interests.map((name) => ({ interest: { connectOrCreate: { where: { name }, create: { id: uuidv7(), name } } } })) } } : {}),
      }, include: includeInterests,
    });
    return this.mapUser(user);
  }
  async saveRefreshToken(token: StoredRefreshToken): Promise<void> { await this.prisma.refreshToken.create({ data: token }); }
  async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> { return this.prisma.refreshToken.findUnique({ where: { tokenHash } }); }
  async revokeRefreshToken(id: string): Promise<void> { await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }); }
  async deleteUser(userId:string):Promise<void>{await this.prisma.user.delete({where:{id:userId}})}
  async findOAuthIdentity(provider:string,subject:string):Promise<StoredUser|null>{
    const identity=await this.prisma.oAuthIdentity.findUnique({where:{provider_subject:{provider,subject}},include:{user:{include:includeInterests}}});
    return identity?this.mapUser(identity.user):null;
  }
  async createOAuthIdentity(provider:string,subject:string,userId:string):Promise<void>{await this.prisma.oAuthIdentity.create({data:{id:uuidv7(),provider,subject,userId}})}
  async upsertOAuthCredential(provider:string,subject:string,userId:string,refreshTokenEncrypted:string):Promise<void>{
    await this.prisma.oAuthIdentity.upsert({
      where:{provider_subject:{provider,subject}},
      create:{id:uuidv7(),provider,subject,userId,refreshTokenEncrypted},
      update:{userId,refreshTokenEncrypted},
    });
  }
  async findOAuthCredentials(userId:string,provider:string):Promise<StoredOAuthCredential[]>{
    const rows=await this.prisma.oAuthIdentity.findMany({where:{userId,provider,refreshTokenEncrypted:{not:null}},select:{provider:true,subject:true,refreshTokenEncrypted:true}});
    return rows.flatMap((row)=>row.refreshTokenEncrypted?[{provider:row.provider,subject:row.subject,refreshTokenEncrypted:row.refreshTokenEncrypted}]:[]);
  }
  async saveOAuthLoginTicket(input:StoredOAuthLoginTicket):Promise<void>{await this.prisma.oAuthLoginTicket.create({data:input})}
  async findOAuthLoginTicket(tokenHash:string):Promise<StoredOAuthLoginTicket|null>{return this.prisma.oAuthLoginTicket.findUnique({where:{tokenHash}})}
  async consumeOAuthLoginTicket(id:string):Promise<void>{await this.prisma.oAuthLoginTicket.update({where:{id},data:{usedAt:new Date()}})}
}
