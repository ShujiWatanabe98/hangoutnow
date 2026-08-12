import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(1) @MaxLength(40) displayName!: string;
  @IsDateString({ strict: true }) birthDate!: string;
}

export class LoginDto {
  @IsEmail() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
  @IsString() password!: string;
}

export class RefreshDto { @IsString() @MinLength(20) refreshToken!: string; }

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string | null;
  @IsOptional() @IsString() @MaxLength(80) homeArea?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) interests?: string[];
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string | null;
}

export class RequestPhoneVerificationDto { @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string; }
export class ConfirmPhoneVerificationDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
