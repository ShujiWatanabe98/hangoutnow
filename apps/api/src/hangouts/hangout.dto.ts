import { AttendanceStatus, GenderRestriction, ServiceArea } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateHangoutDto {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) imageUrl?: string;
  @IsString() @MaxLength(30) category!: string;
  @IsEnum(ServiceArea) serviceArea!: ServiceArea;
  @IsIn([30, 60, 180]) startInMinutes!: number;
  @IsString() @MinLength(1) @MaxLength(100) locationName!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) meetingPlaceName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) meetingAddress?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) navigationUrl?: string;
  @IsString() @MinLength(1) @MaxLength(100) publicLocationName!: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsInt() @Min(2) @Max(8) maxParticipants!: number;
  @IsOptional() @IsInt() @Min(0) @Max(8) hostMaleCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8) hostFemaleCount?: number;
  @IsOptional() @IsEnum(GenderRestriction) genderRestriction?: GenderRestriction;
  @IsOptional() @IsIn([29, 39, 59]) maxAge?: number;
}
export class UpdateHangoutDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(1_500_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/) imageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) locationName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) meetingPlaceName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) meetingAddress?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) navigationUrl?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) publicLocationName?: string;
  @IsOptional() @IsEnum(GenderRestriction) genderRestriction?: GenderRestriction;
  @IsOptional() @IsInt() @Min(0) @Max(8) hostMaleCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8) hostFemaleCount?: number;
  @IsOptional() @IsIn([29, 39, 59]) maxAge?: number | null;
}
export class JoinHangoutDto { @IsString() @MinLength(1) @MaxLength(200) message!: string; }
export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  @IsIn([AttendanceStatus.CONFIRMED, AttendanceStatus.CANCELLED])
  status!: AttendanceStatus;
}
export class RateParticipantDto {
  @IsUUID() ratedUserId!: string;
  @IsInt() @Min(1) @Max(5) score!: number;
}
