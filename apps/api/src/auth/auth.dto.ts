import { Transform } from 'class-transformer';
import { Gender } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(1) @MaxLength(40) displayName!: string;
  @IsDateString({ strict: true }) birthDate!: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
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
  @IsOptional() @IsEnum(Gender) gender?: Gender;
}

export class RequestPhoneVerificationDto { @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string; }
export class ConfirmPhoneVerificationDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}

export class LineStartDto {
  @IsString() @Matches(/^(hangoutnow:\/\/auth\/line|https:\/\/(www\.)?method-more\.com\/(demo|app)\.html|https:\/\/hangoutnow-demo\.onrender\.com\/(demo|app)\.html|http:\/\/(localhost|127\.0\.0\.1):4173\/(demo|app)\.html)$/) returnTo!: string;
}

export class LineRedeemDto {
  @IsString() @MinLength(20) ticket!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
}
