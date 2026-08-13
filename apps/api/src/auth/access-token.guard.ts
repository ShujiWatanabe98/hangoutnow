import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedRequest extends Request { userId: string; }

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Optional() @Inject(PrismaService) private readonly db?: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      request.userId = this.auth.verifyAccessToken(token).sub;
      const user = this.db ? await this.db.user.findUnique({ where: { id: request.userId }, select: { accountStatus: true } }) : null;
      if (user?.accountStatus === 'SUSPENDED' || user?.accountStatus === 'BANNED') throw new ForbiddenException('Account access is restricted');
      return true;
    } catch (error) { if (error instanceof ForbiddenException) throw error; throw new UnauthorizedException(); }
  }
}
