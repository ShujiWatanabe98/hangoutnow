import { IsBoolean } from 'class-validator';
export class NotificationSettingsDto { @IsBoolean() enabled!: boolean; }
