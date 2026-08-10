import {
  AppError,
  EVENT_EXCHANGE,
  EVENTS,
  publishEvent,
  serviceAuthorizationHeaders,
} from '@lms/shared';
import crypto from 'crypto';
import { prisma as organizationPrisma } from '../lib/prisma';

export { organizationPrisma };

type OnboardingInput = {
  name: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  primaryColor?: string;
  allowRegister?: boolean;
  maxUsers?: number;
  admin: {
    email: string;
    username?: string;
    phone?: string;
    password: string;
    firstName: string;
    lastName: string;
  };
};

const internalPost = async (baseUrl: string, path: string, body: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('organization-service'),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { message?: string } | null;
    throw AppError.internal(result?.message || `Provisioning request failed (${response.status})`);
  }
  return response.json();
};

const internalDelete = async (baseUrl: string, path: string) => {
  await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: serviceAuthorizationHeaders('organization-service'),
  }).catch(() => undefined);
};

const createOnboardingPaymentToken = (organizationId: string) => {
  const secret = process.env.ONBOARDING_PAYMENT_TOKEN_SECRET || process.env.SERVICE_TOKEN_SECRET;
  if (!secret) throw new Error('ONBOARDING_PAYMENT_TOKEN_SECRET or SERVICE_TOKEN_SECRET is required');
  const expiresAt = Date.now() + Number(process.env.ONBOARDING_PAYMENT_TOKEN_TTL_MS || 30 * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({ organizationId, expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

export const onboardOrganization = async (input: OnboardingInput) => {
  const duplicate = await organizationPrisma.organization.findUnique({ where: { slug: input.slug } });
  if (duplicate) throw AppError.conflict('Organization slug is already in use');
  const billingEnabled = process.env.FEATURE_BILLING_ENABLED === 'true';
  const organization = await organizationPrisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      logoUrl: input.logoUrl,
      status: billingEnabled ? 'TRIAL' : 'ACTIVE',
      settings: {
        create: {
          primaryColor: input.primaryColor,
          allowRegister: input.allowRegister,
          maxUsers: input.maxUsers,
        },
      },
    },
    include: { settings: true },
  });

  try {
    await internalPost(
      process.env.ACADEMIC_SERVICE_URL || 'http://localhost:8003',
      '/internal/organizations',
      {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        domain: organization.domain,
        logoUrl: organization.logoUrl,
      },
    );
    await internalPost(
      process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
      `/internal/organizations/${organization.id}/admin`,
      { ...input.admin, isActive: true },
    );
    publishEvent(EVENT_EXCHANGE, EVENTS.ORGANIZATION_CREATED, {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      occurredAt: new Date().toISOString(),
    }).catch(error => console.error('[Organization] ORGANIZATION_CREATED publish failed', error));
    return {
      ...organization,
      onboardingPaymentToken: createOnboardingPaymentToken(organization.id),
    };
  } catch (error) {
    await internalDelete(
      process.env.ACADEMIC_SERVICE_URL || 'http://localhost:8003',
      `/internal/organizations/${organization.id}`,
    );
    await organizationPrisma.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
    throw error;
  }
};
