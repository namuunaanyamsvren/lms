import {
  AppError,
  EVENT_EXCHANGE,
  EVENTS,
  publishEvent,
  serviceAuthorizationHeaders,
} from '@lms/shared';
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

export const onboardOrganization = async (input: OnboardingInput) => {
  const duplicate = await organizationPrisma.organization.findUnique({ where: { slug: input.slug } });
  if (duplicate) throw AppError.conflict('Organization slug is already in use');
  if (input.domain) {
    const duplicateDomain = await organizationPrisma.organization.findUnique({
      where: { domain: input.domain },
    });
    if (duplicateDomain) throw AppError.conflict('Organization domain is already in use');
  }

  let organization: Awaited<ReturnType<typeof organizationPrisma.organization.create>>;
  try {
    organization = await organizationPrisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        domain: input.domain,
        logoUrl: input.logoUrl,
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
  } catch (error: any) {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target : [];
    if (error?.code === 'P2002' && target.includes('slug')) {
      throw AppError.conflict('Organization slug is already in use');
    }
    if (error?.code === 'P2002' && target.includes('domain')) {
      throw AppError.conflict('Organization domain is already in use');
    }
    throw error;
  }

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
      input.admin,
    );
    publishEvent(EVENT_EXCHANGE, EVENTS.ORGANIZATION_CREATED, {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      occurredAt: new Date().toISOString(),
    }).catch(error => console.error('[Organization] ORGANIZATION_CREATED publish failed', error));
    return organization;
  } catch (error) {
    await internalDelete(
      process.env.ACADEMIC_SERVICE_URL || 'http://localhost:8003',
      `/internal/organizations/${organization.id}`,
    );
    await organizationPrisma.organization.delete({ where: { id: organization.id } }).catch(() => undefined);
    throw error;
  }
};
