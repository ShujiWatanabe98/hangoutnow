import { FunnelEventType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class TrackFunnelEventDto {
  @IsEnum(FunnelEventType)
  eventType!: FunnelEventType;

  @IsOptional()
  @IsUUID()
  hangoutId?: string;
}
