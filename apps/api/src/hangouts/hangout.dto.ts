import { GenderRestriction } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateHangoutDto {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @MaxLength(30) category!: string;
  @IsIn([30, 60, 180]) startInMinutes!: number;
  @IsString() @MinLength(1) @MaxLength(100) locationName!: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsInt() @Min(2) @Max(12) maxParticipants!: number;
  @IsOptional() @IsEnum(GenderRestriction) genderRestriction?: GenderRestriction;
  @IsOptional() @IsIn([29, 39, 59]) maxAge?: number;
}
export class UpdateHangoutDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) locationName?: string;
}
export class JoinHangoutDto { @IsOptional() @IsString() @MaxLength(200) message?: string; }
export class RateParticipantDto {
  @IsUUID() ratedUserId!: string;
  @IsInt() @Min(1) @Max(5) score!: number;
}
