import { Transform } from 'class-transformer';
import { Gender, ParticipationUrgency } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '正しいメールアドレスを入力してください' }) @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
  @IsString({ message: 'パスワードを入力してください' }) @MinLength(12, { message: 'パスワードは12文字以上で入力してください' }) @MaxLength(128, { message: 'パスワードは128文字以内で入力してください' }) password!: string;
  @IsString({ message: '表示名を入力してください' }) @MinLength(1, { message: '表示名を入力してください' }) @MaxLength(40, { message: '表示名は40文字以内で入力してください' }) displayName!: string;
  @IsDateString({ strict: true }, { message: '正しい生年月日を入力してください' }) birthDate!: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
}

export class LoginDto {
  @IsEmail({}, { message: '正しいメールアドレスを入力してください' }) @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
  @IsString({ message: 'パスワードを入力してください' }) password!: string;
}

export enum DemoRole { HOST = 'host', GUEST = 'guest' }
export enum AlcoholPreference { NONE = 'NONE', SOMETIMES = 'SOMETIMES', YES = 'YES' }
export enum SmokingPreference { NON_SMOKING = 'NON_SMOKING', SEPARATED = 'SEPARATED', NO_PREFERENCE = 'NO_PREFERENCE' }
export class DemoLoginDto { @IsEnum(DemoRole) role!: DemoRole; }

export class RefreshDto { @IsString() @MinLength(20) refreshToken!: string; }

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string | null;
  @IsOptional() @IsString() @MaxLength(80) homeArea?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) interests?: string[];
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(80, { each: true }) preferredAreas?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) preferredActivities?: string[];
  @IsOptional() @IsInt() @Min(18) @Max(100) preferredAgeMin?: number | null;
  @IsOptional() @IsInt() @Min(18) @Max(100) preferredAgeMax?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsEnum(Gender, { each: true }) preferredGenders?: Gender[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(30, { each: true }) activityTimeSlots?: string[];
  @IsOptional() @IsBoolean() matchingDataConsent?: boolean;
  @IsOptional() @IsEnum(ParticipationUrgency) participationUrgency?: ParticipationUrgency | null;
  @IsOptional() @IsInt() @Min(5) @Max(180) maxTravelMinutes?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsInt({ each: true }) @Min(2, { each: true }) @Max(20, { each: true }) preferredGroupSizes?: number[];
  @IsOptional() @IsInt() @Min(0) @Max(100_000) budgetMin?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) budgetMax?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(40, { each: true }) socialStyles?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsString({ each: true }) @MaxLength(40, { each: true }) participationGoals?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) @MaxLength(40, { each: true }) firstTimePreferences?: string[];
  @IsOptional() @IsEnum(AlcoholPreference) alcoholPreference?: AlcoholPreference | null;
  @IsOptional() @IsEnum(SmokingPreference) smokingPreference?: SmokingPreference | null;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsString({ each: true }) @MaxLength(40, { each: true }) avoidPreferences?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(40, { each: true }) scheduleFlexibility?: string[];
  @IsOptional() @IsBoolean() behaviorLearningEnabled?: boolean;
}

export class RequestPhoneVerificationDto { @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string; }
export class ConfirmPhoneVerificationDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
export class RequestPhoneAuthDto { @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string; }
export class ConfirmPhoneAuthDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @MinLength(20) challengeToken!: string;
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
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
}

export class GoogleStartDto {
  @IsString() @Matches(/^(hangoutnow:\/\/auth\/google|https:\/\/(www\.)?method-more\.com\/(demo|app)\.html|https:\/\/hangoutnow-demo\.onrender\.com\/(demo|app)\.html|http:\/\/(localhost|127\.0\.0\.1):4173\/(demo|app)\.html)$/) returnTo!: string;
}

export class GoogleRedeemDto {
  @IsString() @MinLength(20) ticket!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
}

export class AppleStartDto {
  @IsString() @Matches(/^(hangoutnow:\/\/auth\/apple|https:\/\/(www\.)?method-more\.com\/(demo|app)\.html|https:\/\/hangoutnow-demo\.onrender\.com\/(demo|app)\.html|http:\/\/(localhost|127\.0\.0\.1):4173\/(demo|app)\.html)$/) returnTo!: string;
}

export class AppleCallbackDto {
  @IsString() @MinLength(10) code!: string;
  @IsString() @MinLength(20) state!: string;
  @IsOptional() @IsString() @MaxLength(2000) user?: string;
}

export class AppleRedeemDto {
  @IsString() @MinLength(20) ticket!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
}

export class XStartDto {
  @IsString() @Matches(/^(hangoutnow:\/\/auth\/x|https:\/\/(www\.)?method-more\.com\/(demo|app)\.html|https:\/\/hangoutnow-demo\.onrender\.com\/(demo|app)\.html|http:\/\/(localhost|127\.0\.0\.1):4173\/(demo|app)\.html)$/) returnTo!: string;
}

export class XRedeemDto {
  @IsString() @MinLength(20) ticket!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) displayName?: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) profilePhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1_500_000, { each: true }) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, { each: true }) profilePhotos?: string[];
}
