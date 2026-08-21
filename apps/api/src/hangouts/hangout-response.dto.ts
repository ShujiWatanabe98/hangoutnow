import { AttendanceStatus, Gender, GenderRestriction, HangoutStatus, JoinRequestStatus, ServiceArea, VerificationStatus } from '@prisma/client';
import type { HostStatus } from '../host-status/host-status.service';

export class HangoutListHostDto {
  id!: string;
  displayName!: string;
  verification!: VerificationStatus;
  profilePhoto!: string | null;
  hostStatus!: HostStatus;
}

export class HangoutListItemDto {
  id!: string;
  hostUserId!: string;
  status!: HangoutStatus;
  title!: string;
  imageUrl!: string | null;
  category!: string;
  serviceArea!: ServiceArea;
  startAt!: Date;
  locationName!: string;
  publicLocationName!: string;
  distanceKm!: number | null;
  participantCount!: number;
  maxParticipants!: number;
  genderRestriction!: GenderRestriction;
  maxAge!: number | null;
  myJoinStatus!: JoinRequestStatus | null;
  host!: HangoutListHostDto;
  hearted!: boolean;
  heartCount!: number;
  matchScore!: number;
}

export class HangoutParticipantDto {
  id!: string;
  displayName!: string;
  verification!: VerificationStatus;
  profilePhoto!: string | null;
  profilePhotos!: string[];
  gender!: Gender | null;
  age!: number | undefined;
  bio!: string | null;
  homeArea!: string | null;
  interests!: string[];
}

export class HangoutDetailHostDto extends HangoutListHostDto {
  profilePhotos!: string[];
}

export class HangoutDetailDto {
  id!: string;
  hostUserId!: string;
  status!: HangoutStatus;
  title!: string;
  description!: string | null;
  imageUrl!: string | null;
  category!: string;
  serviceArea!: ServiceArea;
  startAt!: Date;
  locationName!: string;
  publicLocationName!: string;
  meetingPlaceName!: string | null | undefined;
  meetingAddress!: string | null | undefined;
  navigationUrl!: string | null | undefined;
  latitude!: number | undefined;
  longitude!: number | undefined;
  publicLatitude!: number | null;
  publicLongitude!: number | null;
  locationPrecision!: 'EXACT' | 'APPROXIMATE';
  distanceKm!: number | null;
  participantCount!: number;
  hostParticipantCount!: number;
  maxParticipants!: number;
  hostMaleCount!: number;
  hostFemaleCount!: number;
  genderRestriction!: GenderRestriction;
  maxAge!: number | null;
  isDemo!: boolean;
  host!: HangoutDetailHostDto;
  acceptedParticipants!: HangoutParticipantDto[];
  myJoinStatus!: JoinRequestStatus | null;
  myJoinRequestId!: string | null;
  myAttendanceStatus!: AttendanceStatus | null;
  hearted!: boolean;
  heartCount!: number;
  matchScore!: number;
}
