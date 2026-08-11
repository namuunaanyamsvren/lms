import bcrypt from 'bcrypt';
import { EVENTS } from '@lms/shared';
import { Role, UserAccountStatus, type PrismaClient } from '@prisma/client-auth';

import { prisma } from '../lib/prisma';
import { enqueueAuthEvent, userEventPayload } from './auth-outbox.service';

type Logger = {
  info: (message: string, meta?: unknown) => void;
  warn?: (message: string, meta?: unknown) => void;
};

type ResolvedOrganization = {
  id: string;
  slug: string;
};

type DemoUser = {
  key: string;
  email: string;
  username: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: Role;
  studentId?: string;
  guardianLinkCode?: string;
};

const DEFAULT_DEMO_SLUG = 'mongol-erdem';
const DEFAULT_DEMO_PASSWORD = 'password123';
const SEED_MARKER_EVENT_TYPE = 'DEPLOY_DEMO_USERS_SEEDED';

export const isDeployDemoUserSeedEnabled = (env: NodeJS.ProcessEnv = process.env) => {
  if (env.ENABLE_DEMO_USERS_SEED !== undefined) return env.ENABLE_DEMO_USERS_SEED === 'true';
  return env.NODE_ENV === 'staging';
};

export const demoUserDefinitions = (): DemoUser[] => [
  {
    key: 'admin',
    email: 'admin@lms.mn',
    username: 'admin',
    phone: '99112233',
    firstName: 'Demo',
    lastName: 'Admin',
    role: Role.ORG_ADMIN,
  },
  {
    key: 'teacher',
    email: 'teacher@lms.mn',
    username: 'teacher',
    phone: '99223344',
    firstName: 'Demo',
    lastName: 'Teacher',
    role: Role.INSTRUCTOR,
  },
  {
    key: 'student',
    email: 'student@lms.mn',
    username: 'student',
    phone: '99334455',
    firstName: 'Demo',
    lastName: 'Student',
    role: Role.STUDENT,
    studentId: 'STU-DEMO-0001',
    guardianLinkCode: 'PARENT-DEMO-0001',
  },
  {
    key: 'parent',
    email: 'parent@lms.mn',
    username: 'parent',
    phone: '99445566',
    firstName: 'Demo',
    lastName: 'Parent',
    role: Role.PARENT,
  },
];

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export const resolveDemoOrganization = async (
  slug = process.env.DEMO_ORGANIZATION_SLUG || DEFAULT_DEMO_SLUG,
  organizationServiceUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002',
): Promise<ResolvedOrganization> => {
  const url = new URL('/api/organizations/resolve', normalizeBaseUrl(organizationServiceUrl));
  url.searchParams.set('host', slug);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(Number(process.env.DEMO_USERS_SEED_FETCH_TIMEOUT_MS || 5000)),
  });
  if (!response.ok) {
    throw new Error(`Demo organization resolve failed with ${response.status}`);
  }
  const body = await response.json() as { data?: { id?: string; slug?: string } };
  const data = body?.data;
  if (!data?.id) throw new Error('Demo organization resolve response did not include an id');
  return { id: data.id, slug: data.slug || slug };
};

const demoId = (slug: string, key: string) => `demo-${slug}-${key}`;

export const seedDeployDemoUsers = async (
  client: PrismaClient = prisma,
  organizationResolver = resolveDemoOrganization,
) => {
  if (!isDeployDemoUserSeedEnabled()) return { seeded: false, reason: 'disabled' };

  const organization = await organizationResolver();
  const passwordHash = await bcrypt.hash(process.env.DEMO_SEED_PASSWORD || DEFAULT_DEMO_PASSWORD, 10);
  const users = demoUserDefinitions();
  let seeded = false;

  await client.$transaction(async tx => {
    const marker = await tx.authOutboxEvent.findFirst({
      where: {
        eventType: SEED_MARKER_EVENT_TYPE,
        publishedAt: { not: null },
      },
      select: { id: true },
    });
    if (marker) return;

    for (const user of users) {
      const existing = await tx.userAccount.findUnique({
        where: {
          organizationId_email: {
            organizationId: organization.id,
            email: user.email,
          },
        },
      });
      const authUser = await tx.userAccount.upsert({
        where: {
          organizationId_email: {
            organizationId: organization.id,
            email: user.email,
          },
        },
        create: {
          id: demoId(organization.slug, user.key),
          organizationId: organization.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: UserAccountStatus.ACTIVE,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          studentId: user.studentId || null,
          guardianLinkCode: user.guardianLinkCode || null,
          deletedAt: null,
        },
        update: {
          username: user.username,
          phone: user.phone,
          passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: UserAccountStatus.ACTIVE,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          studentId: user.studentId || null,
          guardianLinkCode: user.guardianLinkCode || null,
          deletedAt: null,
        },
      });
      await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: authUser.id,
          },
        },
        create: {
          organizationId: organization.id,
          userId: authUser.id,
          role: user.role,
          status: UserAccountStatus.ACTIVE,
          source: 'DEMO_SEED',
          approvedAt: new Date(),
        },
        update: {
          role: user.role,
          status: UserAccountStatus.ACTIVE,
          source: 'DEMO_SEED',
          approvedAt: new Date(),
        },
      });
      await enqueueAuthEvent(
        tx,
        existing ? EVENTS.USER_UPDATED : EVENTS.USER_CREATED,
        userEventPayload(authUser),
      );
    }
    await tx.authOutboxEvent.create({
      data: {
        eventType: SEED_MARKER_EVENT_TYPE,
        payload: {
          organizationId: organization.id,
          slug: organization.slug,
          users: users.map(user => user.email),
        },
        publishedAt: new Date(),
        attemptCount: 1,
      },
    });
    seeded = true;
  });

  return {
    seeded,
    reason: seeded ? undefined : 'already_seeded',
    organizationId: organization.id,
    users: users.map(user => user.email),
  };
};

export const startDeployDemoUserSeed = (logger: Logger) => {
  if (!isDeployDemoUserSeedEnabled()) return;
  const maxAttempts = Number(process.env.DEMO_USERS_SEED_MAX_ATTEMPTS || 12);
  const intervalMs = Number(process.env.DEMO_USERS_SEED_RETRY_MS || 10000);
  let attempts = 0;
  let timer: NodeJS.Timeout | undefined;

  const run = async () => {
    attempts += 1;
    try {
      const result = await seedDeployDemoUsers();
      if (result.seeded) {
        logger.info('Deploy demo users seeded', {
          organizationId: result.organizationId,
          users: result.users,
        });
      } else if (result.reason === 'already_seeded') {
        logger.info('Deploy demo users already seeded', {
          organizationId: result.organizationId,
        });
      }
      if (timer) clearInterval(timer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn?.('Deploy demo user seed attempt failed', { attempts, maxAttempts, error: message });
      if (attempts >= maxAttempts && timer) clearInterval(timer);
    }
  };

  timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
};
