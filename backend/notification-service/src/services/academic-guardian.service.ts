import { createServiceHttpClient, serviceAuthorizationHeaders } from '@lms/shared';

export async function createApprovedGuardianLink(input: {
  organizationId: string;
  parentUserId: string;
  guardianLinkCode: string;
  approvedById: string;
}) {
  const baseUrl = process.env.ACADEMIC_SERVICE_URL;
  if (!baseUrl) throw new Error('ACADEMIC_SERVICE_URL is required to create guardian links');
  const client = createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.INTERNAL_ACADEMIC_TIMEOUT_MS || 3000),
    retries: 1,
    defaultHeaders: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('notification-service'),
    },
  });
  const response = await client.json<{ success: boolean; data: unknown }>(
    '/internal/guardian-links/approved',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}
