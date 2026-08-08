#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const services = [
  ['auth', 'auth-service/src/prisma/schema.prisma', 'auth-service/src/prisma/migrations'],
  [
    'organization',
    'organization-service/src/prisma/schema.prisma',
    'organization-service/src/prisma/migrations',
  ],
  ['billing', 'billing-service/src/prisma/schema.prisma', 'billing-service/src/prisma/migrations'],
  [
    'notification',
    'notification-service/src/prisma/schema.prisma',
    'notification-service/src/prisma/migrations',
  ],
  ['academic', 'academic-service/src/prisma/schema.prisma', 'academic-service/src/prisma/migrations'],
];

function shadowDatabaseUrl(schema) {
  if (process.env.SHADOW_DATABASE_URL) {
    const url = new URL(process.env.SHADOW_DATABASE_URL);
    url.searchParams.set('schema', `shadow_${schema}`);
    return url.toString();
  }
  if (!process.env.POSTGRES_PASSWORD) {
    throw new Error('SHADOW_DATABASE_URL or POSTGRES_PASSWORD is required');
  }
  const databaseName = process.env.SHADOW_DATABASE_NAME || 'lms_migration_shadow';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(databaseName)) {
    throw new Error('SHADOW_DATABASE_NAME contains invalid characters');
  }
  const url = new URL(`postgresql://localhost:5432/${databaseName}`);
  url.username = process.env.POSTGRES_USER || 'postgres';
  url.password = process.env.POSTGRES_PASSWORD;
  url.searchParams.set('schema', schema);
  return url.toString();
}

let drifted = false;
for (const [databaseSchema, schemaPath, migrationsPath] of services) {
  console.log(`[Prisma] Checking ${databaseSchema} schema for drift against committed migrations`);
  const result = spawnSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-migrations',
      path.resolve(__dirname, '..', migrationsPath),
      '--to-schema-datamodel',
      path.resolve(__dirname, '..', schemaPath),
      '--shadow-database-url',
      shadowDatabaseUrl(databaseSchema),
      '--exit-code',
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    console.error(
      `[Prisma] ${databaseSchema} schema.prisma drifted from its committed migrations. ` +
        'Run `prisma migrate dev` in that service to generate the missing migration.'
    );
    drifted = true;
  }
}

if (drifted) process.exit(1);
console.log('[Prisma] No migration drift detected.');
