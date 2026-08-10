import { createServiceHttpClient, serviceAuthorizationHeaders } from '@lms/shared';

export async function activateOrganization(organizationId: string) {
  const baseUrl = process.env.ORGANIZATION_SERVICE_URL;
  if (!baseUrl) throw new Error('ORGANIZATION_SERVICE_URL is required to activate organization');
  const client = createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.INTERNAL_ORGANIZATION_TIMEOUT_MS || 3000),
    retries: 1,
    defaultHeaders: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('billing-service'),
    },
  });
  return client.json(`/internal/organizations/${organizationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
}

export async function activateOrganizationAdmins(organizationId: string) {
  const baseUrl = process.env.AUTH_SERVICE_URL;
  if (!baseUrl) throw new Error('AUTH_SERVICE_URL is required to activate organization admins');
  const client = createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.INTERNAL_AUTH_TIMEOUT_MS || 3000),
    retries: 1,
    defaultHeaders: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('billing-service'),
    },
  });
  return client.json(`/internal/organizations/${organizationId}/admins/activate`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}
