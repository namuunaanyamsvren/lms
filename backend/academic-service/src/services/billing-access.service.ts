import { createServiceHttpClient, serviceAuthorizationHeaders } from '@lms/shared';

export type BillingAccessStatus = {
  restricted: boolean;
  blockingInvoices: Array<{
    id: string;
    amount: string;
    currency: string;
    dueDate: string | null;
    status: string;
  }>;
};

export async function getBillingAccessStatus(input: {
  organizationId: string;
  userId: string;
  cohortId?: string;
  enrollmentId?: string;
}): Promise<BillingAccessStatus> {
  const baseUrl = process.env.BILLING_SERVICE_URL;
  if (!baseUrl) return { restricted: false, blockingInvoices: [] };
  const client = createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.BILLING_ACCESS_TIMEOUT_MS || 2000),
    retries: 1,
    defaultHeaders: serviceAuthorizationHeaders('academic-service'),
  });
  const query = new URLSearchParams({
    userId: input.userId,
    ...(input.cohortId ? { cohortId: input.cohortId } : {}),
    ...(input.enrollmentId ? { enrollmentId: input.enrollmentId } : {}),
  });
  const response = await client.json<{ success: boolean; data: BillingAccessStatus }>(
    `/internal/organizations/${input.organizationId}/access-status?${query}`,
  );
  return response.data || { restricted: false, blockingInvoices: [] };
}
