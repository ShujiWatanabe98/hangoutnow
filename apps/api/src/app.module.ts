import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, UsersController } from './auth/auth.controller';
import { AccessTokenGuard } from './auth/access-token.guard';
import { AuthService } from './auth/auth.service';
import { AuthRepository } from './auth/auth.types';
import { PrismaAuthRepository } from './auth/prisma-auth.repository';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { HangoutController, JoinRequestController } from './hangouts/hangout.controller';
import { HangoutService } from './hangouts/hangout.service';
import { ChatController, DirectChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { ReportAdminController, SafetyController } from './safety/safety.controller';
import { SafetyService } from './safety/safety.service';
import { NotificationController } from './notifications/notification.controller';
import { NotificationService } from './notifications/notification.service';
import { RealtimeGateway } from './notifications/realtime.gateway';
import { SmsVerificationProvider } from './auth/sms-verification.provider';
import { ImageStorageService } from './storage/image-storage.service';
import { DemoController } from './demo/demo.controller';
import { DemoService } from './demo/demo.service';
import { HostStatusService } from './host-status/host-status.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { NewsletterController } from './newsletter/newsletter.controller';
import { NewsletterService } from './newsletter/newsletter.service';

@Module({
  imports: [JwtModule.registerAsync({
    useFactory: () => {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
      return { secret };
    },
  }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [HealthController, AuthController, UsersController, HangoutController, JoinRequestController, ChatController, DirectChatController, DemoController, SafetyController, ReportAdminController, NotificationController, AnalyticsController, NewsletterController],
  providers: [PrismaService, HangoutService, ChatService, DemoService, HostStatusService, SafetyService, NotificationService, AnalyticsService, NewsletterService, RealtimeGateway, SmsVerificationProvider, ImageStorageService, PrismaAuthRepository, { provide: AuthRepository, useExisting: PrismaAuthRepository }, AuthService, AccessTokenGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
