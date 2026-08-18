import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository, StoredOAuthLoginTicket, StoredPhoneVerification, StoredRefreshToken, StoredUser } from './auth.types';

const includeInterests = { interests: { include: { interest: true } } } as const;

@Injectable()
export class PrismaAuthRepository extends AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { super(); }

  private mapUser(user: Awaited<ReturnType<PrismaAuthRepository['loadUser']>>): StoredUser {
    return {
      id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null, gender: user.gender, bio: user.bio, homeArea: user.homeArea,
      verificationStatus: user.verification, interests: user.interests.map((item) => item.interest.name),
      profilePhoto: user.profilePhoto, profilePhotos: user.profilePhotos, phoneNumber: user.phoneNumber,
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
  async findUserByPhone(phone: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({ where: { phoneNumber: phone }, include: includeInterests });
    return user ? this.mapUser(user) : null;
  }
  async createUser(input: { email: string; passwordHash: string; displayName: string; birthDate: Date | null; gender?: string }): Promise<StoredUser> {
    const user = await this.prisma.user.create({ data: { id: uuidv7(), ...input, gender: input.gender as 'MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED'|undefined }, include: includeInterests });
    return this.mapUser(user);
  }
  async updateProfile(userId: string, input: { displayName?: string; bio?: string | null; homeArea?: string | null; interests?: string[]; profilePhoto?: string | null; profilePhotos?: string[]; gender?: string }): Promise<StoredUser> {
    const { interests, gender, ...profile } = input;
    const user = await this.prisma.user.update({
      where: { id: userId }, data: {
        ...profile, ...(gender ? { gender: gender as 'MALE'|'FEMALE'|'OTHER'|'UNDISCLOSED' } : {}),
        ...(interests ? { interests: { deleteMany: {}, create: interests.map((name) => ({ interest: { connectOrCreate: { where: { name }, create: { id: uuidv7(), name } } } })) } } : {}),
      }, include: includeInterests,
    });
    return this.mapUser(user);
  }
  async saveRefreshToken(token: StoredRefreshToken): Promise<void> { await this.prisma.refreshToken.create({ data: token }); }
  async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> { return this.prisma.refreshToken.findUnique({ where: { tokenHash } }); }
  async revokeRefreshToken(id: string): Promise<void> { await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }); }
  async createPhoneVerification(input: StoredPhoneVerification): Promise<void> { await this.prisma.phoneVerification.create({ data: input }); }
  async findPhoneVerification(userId: string, phone: string): Promise<StoredPhoneVerification | null> {
    return this.prisma.phoneVerification.findFirst({ where: { userId, phone, usedAt: null }, orderBy: { createdAt: 'desc' } });
  }
  async failPhoneVerification(id: string): Promise<void> { await this.prisma.phoneVerification.update({ where: { id }, data: { attempts: { increment: 1 } } }); }
  async verifyPhone(userId: string, phone: string, verificationId: string): Promise<StoredUser> {
    await this.prisma.$transaction([
      this.prisma.phoneVerification.update({ where: { id: verificationId }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { phoneNumber: phone, verification: 'PHONE_VERIFIED' } }),
    ]);
    return this.loadUser(userId).then((user) => this.mapUser(user));
  }
  async setVerifiedPhone(userId:string,phone:string):Promise<StoredUser>{const user=await this.prisma.user.update({where:{id:userId},data:{phoneNumber:phone,verification:'PHONE_VERIFIED'},include:includeInterests});return this.mapUser(user)}
  async phoneVerificationCounts(userId:string,phone:string,requestIp:string,since:Date){const[user,phoneCount,ip]=await Promise.all([this.prisma.phoneVerification.count({where:{userId,createdAt:{gte:since}}}),this.prisma.phoneVerification.count({where:{phone,createdAt:{gte:since}}}),this.prisma.phoneVerification.count({where:{requestIp,createdAt:{gte:since}}})]);return{user,phone:phoneCount,ip}}
  async deleteUser(userId:string):Promise<void>{await this.prisma.user.delete({where:{id:userId}})}
  async findOAuthIdentity(provider:string,subject:string):Promise<StoredUser|null>{
    const identity=await this.prisma.oAuthIdentity.findUnique({where:{provider_subject:{provider,subject}},include:{user:{include:includeInterests}}});
    return identity?this.mapUser(identity.user):null;
  }
  async createOAuthIdentity(provider:string,subject:string,userId:string):Promise<void>{await this.prisma.oAuthIdentity.create({data:{id:uuidv7(),provider,subject,userId}})}
  async saveOAuthLoginTicket(input:StoredOAuthLoginTicket):Promise<void>{await this.prisma.oAuthLoginTicket.create({data:input})}
  async findOAuthLoginTicket(tokenHash:string):Promise<StoredOAuthLoginTicket|null>{return this.prisma.oAuthLoginTicket.findUnique({where:{tokenHash}})}
  async consumeOAuthLoginTicket(id:string):Promise<void>{await this.prisma.oAuthLoginTicket.update({where:{id},data:{usedAt:new Date()}})}
}
