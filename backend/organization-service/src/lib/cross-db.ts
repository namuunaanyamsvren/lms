import { PrismaClient as AuthPrismaClient } from '@prisma/client-auth';
import { PrismaClient as BillingPrismaClient } from '@prisma/client-billing';
import { PrismaClient as NotificationPrismaClient } from '@prisma/client-notification';
import { PrismaClient as AcademicPrismaClient } from '@prisma/client-academic';

function resolveDatabaseUrl(schema: string): string | undefined {
  const envKey = `${schema.toUpperCase()}_DATABASE_URL`;
  if (process.env[envKey]) return process.env[envKey];
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;
  if (baseUrl.includes('schema=')) {
    return baseUrl.replace(/schema=[^&]+/, `schema=${schema}`);
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}schema=${schema}`;
}

const authDbUrl = resolveDatabaseUrl('auth');
const billingDbUrl = resolveDatabaseUrl('billing');
const notificationDbUrl = resolveDatabaseUrl('notification');
const academicDbUrl = resolveDatabaseUrl('academic');

export const authPrisma = new AuthPrismaClient(
  authDbUrl ? { datasources: { db: { url: authDbUrl } } } : undefined,
);

export const billingPrisma = new BillingPrismaClient(
  billingDbUrl ? { datasources: { db: { url: billingDbUrl } } } : undefined,
);

export const notificationPrisma = new NotificationPrismaClient(
  notificationDbUrl ? { datasources: { db: { url: notificationDbUrl } } } : undefined,
);

export const academicPrisma = new AcademicPrismaClient(
  academicDbUrl ? { datasources: { db: { url: academicDbUrl } } } : undefined,
);
