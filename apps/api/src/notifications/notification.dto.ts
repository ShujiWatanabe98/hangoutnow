import { IsBoolean, IsIn, IsString, Matches, MaxLength } from 'class-validator';
export class NotificationSettingsDto { @IsBoolean() enabled!: boolean; }
export class PushTokenDto {
  @IsString() @MaxLength(200) @Matches(/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/) token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}
