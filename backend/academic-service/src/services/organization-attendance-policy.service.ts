import { serviceAuthorizationHeaders } from '@lms/shared';

// Mirrors today's hardcoded behavior (attendance.service.ts's former
// ABSENCE_THRESHOLD = 3) as the fallback when organization-service can't be
// reached or the org hasn't configured a custom threshold.
const DEFAULT_ABSENCE_THRESHOLD = 3;

export const getOrganizationAttendancePolicy = async (
  organizationId: string,
): Promise<{
  absenceThreshold: number;
  riskGradeThreshold?: number;
  riskAttendanceThreshold?: number;
}> => {
  const baseUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002';
  try {
    const response = await fetch(
      `${baseUrl}/internal/organizations/${organizationId}/attendance-policy`,
      { headers: serviceAuthorizationHeaders('academic-service') },
    );
    if (!response.ok) return { absenceThreshold: DEFAULT_ABSENCE_THRESHOLD };
    const result = await response.json() as {
      data: {
        absenceThreshold: number;
        riskGradeThreshold?: number;
        riskAttendanceThreshold?: number;
      };
    };
    return {
      absenceThreshold: result.data.absenceThreshold || DEFAULT_ABSENCE_THRESHOLD,
      riskGradeThreshold: result.data.riskGradeThreshold,
      riskAttendanceThreshold: result.data.riskAttendanceThreshold,
    };
  } catch {
    // A temporary organization-service outage must not block attendance recording;
    // fall back to the default threshold.
    return { absenceThreshold: DEFAULT_ABSENCE_THRESHOLD };
  }
};
