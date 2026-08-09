import { AppError, serviceAuthorizationHeaders } from '@lms/shared';

export interface OrganizationAuthPolicy {
  active: boolean;
  allowRegister: boolean;
  maxUsers: number;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  invitationCodeHash: string|null;
  allowedEmailDomains: string[];
  passwordPolicy:{minimumLength:number}|null;
}

export const getOrganizationAuthPolicy = async (
  organizationId: string,
): Promise<OrganizationAuthPolicy> => {
  const baseUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002';
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw AppError.internal('ORGANIZATION_SERVICE_URL is invalid');
  }
  const safeOrganizationId = encodeURIComponent(organizationId);
  const response = await fetch(
    new URL(`/internal/organizations/${safeOrganizationId}/registration-policy`, base).toString(),
    { headers: serviceAuthorizationHeaders('auth-service') },
  );
  if (!response.ok) {
    throw AppError.badRequest('Organization is not available');
  }
  const result = await response.json() as { data: Partial<OrganizationAuthPolicy> };
  const data = result.data || {};
  return {
    active: data.active !== false,
    allowRegister: data.allowRegister !== false,
    maxUsers: Number.isInteger(data.maxUsers) && data.maxUsers! > 0 ? data.maxUsers! : 100,
    requireEmailVerification: Boolean(data.requireEmailVerification),
    requirePhoneVerification: Boolean(data.requirePhoneVerification),
    invitationCodeHash: data.invitationCodeHash || null,
    allowedEmailDomains: Array.isArray(data.allowedEmailDomains)
      ? data.allowedEmailDomains.filter(Boolean).map(domain => domain.toLowerCase())
      : [],
    passwordPolicy: data.passwordPolicy || null,
  };
};
