#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const services = [
  ['auth', 'auth-service/src/prisma/schema.prisma'],
  ['organization', 'organization-service/src/prisma/schema.prisma'],
  ['billing', 'billing-service/src/prisma/schema.prisma'],
  ['notification', 'notification-service/src/prisma/schema.prisma'],
  ['academic', 'academic-service/src/prisma/schema.prisma'],
];
const legacyBaselines = new Map([
  ['billing', '20260729000000_billing_baseline'],
  ['notification', '20260729000000_notification_baseline'],
]);
const baselineLegacy = process.argv.includes('--baseline-legacy');

function databaseUrl(schema) {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', schema);
    return url.toString();
  }
  if (!process.env.POSTGRES_PASSWORD) {
    throw new Error('DATABASE_URL or POSTGRES_PASSWORD is required');
  }
  const databaseName = process.env.MIGRATION_DATABASE_NAME || 'lms_db';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(databaseName)) {
    throw new Error('MIGRATION_DATABASE_NAME contains invalid characters');
  }
  const url = new URL(`postgresql://localhost:5432/${databaseName}`);
  url.username = process.env.POSTGRES_USER || 'postgres';
  url.password = process.env.POSTGRES_PASSWORD;
  url.searchParams.set('schema', schema);
  return url.toString();
}

for (const [databaseSchema, schemaPath] of services) {
  console.log(`[Prisma] Deploying ${databaseSchema} migrations`);
  const commandEnvironment = { ...process.env, DATABASE_URL: databaseUrl(databaseSchema) };
  if (baselineLegacy && legacyBaselines.has(databaseSchema)) {
    console.log(`[Prisma] Baselining existing ${databaseSchema} schema`);
    const baselineResult = spawnSync(
      'npx',
      [
        'prisma',
        'migrate',
        'resolve',
        '--applied',
        legacyBaselines.get(databaseSchema),
        '--schema',
        path.resolve(__dirname, '..', schemaPath),
      ],
      {
        cwd: path.resolve(__dirname, '..'),
        env: commandEnvironment,
        stdio: 'inherit',
      }
    );
    if (baselineResult.status !== 0) process.exit(baselineResult.status || 1);
  }
  const result = spawnSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', path.resolve(__dirname, '..', schemaPath)],
    {
      cwd: path.resolve(__dirname, '..'),
      env: commandEnvironment,
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
