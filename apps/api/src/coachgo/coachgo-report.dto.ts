import { CoachGoReportStatus } from '@prisma/client';
import { IsEnum, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export const COACHGO_REPORT_CATEGORIES = [
  'FLOOD',
  'ACCIDENT',
  'ROADWORK',
  'POLICE',
  'OBJECT',
  'BROKEN_DOWN',
  'CONGESTION',
  'ROAD_DAMAGE',
  'HAIL',
  'HEAVY_RAIN',
  'STRONG_WIND',
  'HEAVY_SNOW',
  'LOW_VISIBILITY',
  'ANIMAL',
  'WRONG_WAY',
  'SIGN_ISSUE',
] as const;

export class CreateCoachGoReportDto {
  @IsString()
  @Length(16, 128)
  @Matches(/^[A-Za-z0-9._~-]+$/)
  ownerToken!: string;

  @IsString()
  @IsIn(COACHGO_REPORT_CATEGORIES)
  category!: typeof COACHGO_REPORT_CATEGORIES[number];

  @IsLongitude()
  longitude!: number;

  @IsLatitude()
  latitude!: number;
}

export class UpdateCoachGoReportDto {
  @IsEnum(CoachGoReportStatus)
  status!: CoachGoReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
