import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsObject, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class MatchingWeightsDto {
  @IsNumber() @Min(40) @Max(80) baseScore!: number;
  @IsNumber() @Min(0) @Max(20) activityMatch!: number;
  @IsNumber() @Min(-10) @Max(0) activityMiss!: number;
  @IsNumber() @Min(0) @Max(20) areaMatch!: number;
  @IsNumber() @Min(-10) @Max(0) areaMiss!: number;
  @IsNumber() @Min(0) @Max(15) timeMatch!: number;
  @IsNumber() @Min(-10) @Max(0) timeMiss!: number;
  @IsNumber() @Min(0) @Max(10) groupMatch!: number;
  @IsNumber() @Min(0) @Max(10) ageMatch!: number;
  @IsNumber() @Min(-10) @Max(0) ageMiss!: number;
  @IsNumber() @Min(0) @Max(10) languageMatch!: number;
  @IsNumber() @Min(0) @Max(10) safetyPenalty!: number;
}

export class CreateMatchingConfigDto {
  @IsString() @Matches(/^match-v\d+\.\d+\.\d+$/) version!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) note!: string;
  @IsObject() @ValidateNested() @Type(() => MatchingWeightsDto) weights!: MatchingWeightsDto;
}
