import { IsBoolean, IsString, IsUUID, MaxLength } from 'class-validator';
export class PushPauseDto { @IsBoolean() paused!: boolean; }
export class TestPushDto { @IsUUID() userId!: string; @IsString() @MaxLength(80) title!: string; @IsString() @MaxLength(200) body!: string; }
