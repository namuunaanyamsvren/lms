import crypto from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient as AuthPrismaClient } from '@prisma/client-auth';
import { PrismaClient as OrganizationPrismaClient } from '@prisma/client-organization';
import { PrismaClient as AcademicPrismaClient } from '@prisma/client-academic';
import { PrismaClient as BillingPrismaClient } from '@prisma/client-billing';
import { PrismaClient as NotificationPrismaClient } from '@prisma/client-notification';
import { verifyQPayWebhookSignature } from '../billing-service/src/services/qpay-provider.service';

const describeRealDb = process.env.RUN_REAL_DB_SMOKE === 'true' ? describe.sequential : describe.skip;

function databaseUrlForSchema(schema: string): string {
  const explicit = process.env[`${schema.toUpperCase()}_DATABASE_URL`];
  if (explicit) return explicit;
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is required for real DB smoke tests');
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

const clients = [
  ['auth', new AuthPrismaClient({ datasources: { db: { url: databaseUrlForSchema('auth') } } })],
  [
    'organization',
    new OrganizationPrismaClient({ datasources: { db: { url: databaseUrlForSchema('organization') } } }),
  ],
  ['academic', new AcademicPrismaClient({ datasources: { db: { url: databaseUrlForSchema('academic') } } })],
  ['billing', new BillingPrismaClient({ datasources: { db: { url: databaseUrlForSchema('billing') } } })],
  [
    'notification',
    new NotificationPrismaClient({ datasources: { db: { url: databaseUrlForSchema('notification') } } }),
  ],
] as const;

describeRealDb('release candidate real database smoke', () => {
  afterAll(async () => {
    await Promise.all(clients.map(([, client]) => client.$disconnect()));
  });

  it('connects to every service schema and can run a trivial query', async () => {
    await Promise.all(clients.map(async ([name, client]) => {
      await expect(client.$queryRaw`SELECT 1`).resolves.toBeTruthy();
      expect(name).toEqual(expect.any(String));
    }));
  });

  it('has deployed migration metadata for every Prisma schema', async () => {
    await Promise.all(clients.map(async ([name, client]) => {
      const migrations = await client.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `;
      expect(migrations.length, `${name} schema has no finished migrations`).toBeGreaterThan(0);
    }));
  });

  it('verifies QPay webhook signatures using the production hook', () => {
    process.env.QPAY_WEBHOOK_SECRET = 'real-db-smoke-qpay-webhook-secret';
    const body = JSON.stringify({ providerInvoiceId: 'qpay-smoke', payment_id: 'payment-smoke' });
    const signature = crypto.createHmac('sha256', process.env.QPAY_WEBHOOK_SECRET).update(body).digest('hex');

    expect(verifyQPayWebhookSignature(body, signature)).toBe(true);
    expect(verifyQPayWebhookSignature(body, 'bad-signature')).toBe(false);
  });
});
