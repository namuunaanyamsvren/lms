import { createServiceHttpClient, serviceAuthorizationHeaders } from '@lms/shared';

export async function approveStudentMembership(input: {
  organizationId: string;
  userId: string;
  approvedById: string;
  role?: string;
}) {
  const baseUrl = process.env.AUTH_SERVICE_URL;
  if (!baseUrl) throw new Error('AUTH_SERVICE_URL is required to approve organization membership');
  const client = createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.INTERNAL_AUTH_TIMEOUT_MS || 3000),
    retries: 1,
    defaultHeaders: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('notification-service'),
    },
  });
  const response = await client.json<{ success: boolean; data: unknown }>(
    `/internal/organizations/${input.organizationId}/memberships`,
    {
      method: 'PUT',
      body: JSON.stringify({
        userId: input.userId,
        role: input.role || 'STUDENT',
        source: 'STUDENT_ACCESS_REQUEST',
        approvedById: input.approvedById,
      }),
    },
  );
  return response.data;
}
