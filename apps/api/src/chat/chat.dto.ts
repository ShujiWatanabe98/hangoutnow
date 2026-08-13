import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
export class SendMessageDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((input: SendMessageDto) => !input.stampId)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body?: string;
  @ValidateIf((input: SendMessageDto) => !input.body)
  @IsUUID()
  stampId?: string;
}
export class CreateDirectChatDto { @IsUUID() userId!: string; }
