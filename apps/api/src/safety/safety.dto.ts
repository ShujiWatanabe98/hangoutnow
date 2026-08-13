import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReportDto {
  @IsUUID() targetUserId!: string;
  @IsOptional() @IsUUID() hangoutId?: string;
  @IsIn(['HARASSMENT','SPAM','DANGEROUS','SEXUAL','SOLICITATION','FRAUD','HATE','IMPERSONATION','OTHER']) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsBoolean() blockUser?: boolean;
}

export class UpdateReportDto {
  @IsIn(['OPEN','REVIEWING','RESOLVED','DISMISSED']) status!: 'OPEN'|'REVIEWING'|'RESOLVED'|'DISMISSED';
  @IsOptional() @IsString() @MaxLength(100) assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) resolution?: string;
}

export class ModerationActionDto {
  @IsIn(['NOTE','WARNING','SUSPEND','BAN','RESTORE']) action!: 'NOTE'|'WARNING'|'SUSPEND'|'BAN'|'RESTORE';
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}
