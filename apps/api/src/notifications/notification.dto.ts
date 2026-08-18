import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export const NOTIFICATION_TYPES = ['JOIN_REQUEST','JOIN_ACCEPTED','JOIN_REJECTED','WAITLISTED','WAITLIST_OPEN','CHAT_MESSAGE','DIRECT_MESSAGE','REMINDER','ATTENDANCE_CANCELLED','HANGOUT_FINISHED'] as const;
export class NotificationSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(NOTIFICATION_TYPES, { each: true }) disabledTypes?: string[];
}
export class PushTokenDto {
  @IsString() @MaxLength(200) @Matches(/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/) token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}
