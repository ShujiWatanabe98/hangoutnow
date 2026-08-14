import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
export class SendMessageDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}
export class CreateDirectChatDto { @IsUUID() userId!: string; }
