import { FunnelEventType, MatchDeclineReason, MatchOutcome } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class TrackFunnelEventDto {
  @IsEnum(FunnelEventType)
  eventType!: FunnelEventType;

  @IsOptional()
  @IsUUID()
  hangoutId?: string;
}

export class SaveMatchFeedbackDto {
  @IsUUID()
  hangoutId!: string;

  @IsEnum(MatchOutcome)
  outcome!: MatchOutcome;

  @IsOptional()
  @IsEnum(MatchDeclineReason)
  reason?: MatchDeclineReason;
}
