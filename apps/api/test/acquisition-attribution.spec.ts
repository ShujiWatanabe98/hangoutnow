import { AttendanceStatus, HangoutStatus, JoinRequestStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { MatchingAdminService } from '../src/matching/matching-admin.service';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('privacy-safe campaign acquisition dashboard', () => {
  it('aggregates registrations and downstream activity without returning user identity', async () => {
    const rows = [
      {
        source:'x',medium:'organic-social',campaign:'shinjuku-launch-202609',content:'post-concept-01',
        user:{joinRequests:[{status:JoinRequestStatus.PENDING,attendanceStatus:null,hangout:{status:HangoutStatus.OPEN}}],hostedHangouts:[]},
      },
      {
        source:'instagram',medium:'organic-social',campaign:'shinjuku-launch-202609',content:'profile-first-five',
        user:{joinRequests:[{status:JoinRequestStatus.ACCEPTED,attendanceStatus:AttendanceStatus.CONFIRMED,hangout:{status:HangoutStatus.FINISHED}}],hostedHangouts:[]},
      },
      {
        source:'founder',medium:'qr',campaign:'shinjuku-launch-202609',content:'first-five',
        user:{joinRequests:[],hostedHangouts:[{status:HangoutStatus.FINISHED}]},
      },
    ];
    const db = { acquisitionAttribution:{count:vi.fn().mockResolvedValue(rows.length),findMany:vi.fn().mockResolvedValue(rows)} } as unknown as PrismaService;
    const result = await new MatchingAdminService(db).acquisitionDashboard();
    expect(result).toMatchObject({ trackedRegistrations:3,joinRequestedUsers:2,acceptedUsers:1,hostedUsers:1,activatedUsers:3,completedUsers:2,truncated:false,consentRequired:true });
    expect(result.groups).toHaveLength(3);
    expect(JSON.stringify(result)).not.toMatch(/email|displayName|phone|latitude|message/i);
  });

  it('marks the dashboard as truncated instead of overstating a partial sample', async () => {
    const db = { acquisitionAttribution:{count:vi.fn().mockResolvedValue(5_001),findMany:vi.fn().mockResolvedValue([])} } as unknown as PrismaService;
    const result = await new MatchingAdminService(db).acquisitionDashboard();
    expect(result).toMatchObject({ trackedRegistrations:5_001,sampledRegistrations:0,truncated:true });
  });
});
