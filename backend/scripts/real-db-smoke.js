#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const process = require('node:process');

const backendRoot = path.resolve(__dirname, '..');

const required = ['DATABASE_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Real DB smoke requires ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SMOKE !== 'true') {
  console.error('Refusing to run real DB smoke against production without ALLOW_PRODUCTION_SMOKE=true');
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
  RUN_REAL_DB_SMOKE: 'true',
};

const run = (name, command, args) => {
  console.log(`\n[real-db-smoke] ${name}`);
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`[real-db-smoke] failed: ${name}`);
    process.exit(result.status || 1);
  }
};

run('generate Prisma clients', 'npm', ['run', 'prisma:generate']);
run('deploy all service migrations', 'npm', ['run', 'prisma:deploy']);
run('validate deterministic seed script', 'npm', ['run', 'seed:check']);
run('seed deterministic test fixtures', 'npm', ['run', 'seed']);
run('DB-backed release smoke tests', 'npm', [
  'exec',
  '--',
  'vitest',
  'run',
  'tests/release-smoke.realdb.test.ts',
  'tests/refresh.integration.test.ts',
]);

console.log('\n[real-db-smoke] passed');
