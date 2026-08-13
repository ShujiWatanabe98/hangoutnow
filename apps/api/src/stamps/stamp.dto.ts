import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateStampDto {
  @IsString() @MinLength(1) @MaxLength(30) text!: string;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) imageData?: string;
}
