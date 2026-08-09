import { serviceAuthorizationHeaders } from '@lms/shared';

export const getOrganizationGradingScale = async (
  organizationId: string,
): Promise<Record<string, number>> => {
  const baseUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002';
  try {
    const response = await fetch(
      `${baseUrl}/internal/organizations/${organizationId}/grading-policy`,
      { headers: serviceAuthorizationHeaders('academic-service') },
    );
    if (!response.ok) return {};
    const result = await response.json() as { data: { gradingScale: Record<string, number> } };
    return result.data.gradingScale || {};
  } catch {
    // A temporary organization-service outage must not block grade computation;
    // fall back to the default scale (see grade.service.ts DEFAULT_GRADING_SCALE).
    return {};
  }
};
