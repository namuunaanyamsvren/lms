import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '.env') });
if (!process.env.SERVICE_TOKEN_SECRET && process.env.INTERNAL_SERVICE_KEY) {
  process.env.SERVICE_TOKEN_SECRET = process.env.INTERNAL_SERVICE_KEY;
}
if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
  const databaseUrl = new URL('postgresql://localhost:5432/lms_db');
  databaseUrl.username = process.env.POSTGRES_USER || 'postgres';
  databaseUrl.password = process.env.POSTGRES_PASSWORD;
  databaseUrl.searchParams.set('schema', 'auth');
  process.env.DATABASE_URL = databaseUrl.toString();
  const organizationUrl = new URL(databaseUrl);
  organizationUrl.searchParams.set('schema', 'organization');
  process.env.ORGANIZATION_DATABASE_URL = organizationUrl.toString();
}

export default defineConfig({
  resolve: {
    alias: {
      '@lms/shared': resolve(__dirname, 'shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
