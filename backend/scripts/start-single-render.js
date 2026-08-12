#!/usr/bin/env node
/**
 * Run the LMS demo backend as one Render web service.
 *
 * Render's free/staging web services can cold-start or fail independently. For
 * demo environments this script keeps the microservice boundaries in code, but
 * runs them as localhost processes in one container so the public gateway does
 * not depend on several separate *.onrender.com services being awake.
 */
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeBin = process.execPath;
const prismaBin = path.join(root, 'node_modules', '.bin', 'prisma');
const nodeEnv = process.env.NODE_ENV || 'staging';
const externalPort = process.env.PORT || '8000';
const featureBilling = process.env.FEATURE_BILLING_ENABLED === 'true';

const localUrls = {
  auth: 'http://127.0.0.1:8001',
  organization: 'http://127.0.0.1:8002',
  academic: 'http://127.0.0.1:8003',
  billing: 'http://127.0.0.1:8004',
  notification: 'http://127.0.0.1:8005',
};

const services = [
  {
    name: 'auth-service',
    schema: 'auth',
    dbKey: 'AUTH_DATABASE_URL',
    port: '8001',
    env: { AUTH_PORT: '8001', PORT: '8001' },
    script: 'auth-service/dist/index.js',
    required: true,
  },
  {
    name: 'organization-service',
    schema: 'organization',
    dbKey: 'ORGANIZATION_DATABASE_URL',
    port: '8002',
    env: { PORT: '8002' },
    script: 'organization-service/dist/index.js',
    required: true,
  },
  {
    name: 'academic-service',
    schema: 'academic',
    dbKey: 'ACADEMIC_DATABASE_URL',
    port: '8003',
    env: { ACADEMIC_PORT: '8003', PORT: '8003' },
    script: 'academic-service/dist/index.js',
    required: true,
  },
  {
    name: 'notification-service',
    schema: 'notification',
    dbKey: 'NOTIFICATION_DATABASE_URL',
    port: '8005',
    env: { PORT: '8005' },
    script: 'notification-service/dist/index.js',
    required: false,
  },
  ...(featureBilling ? [{
    name: 'billing-service',
    schema: 'billing',
    dbKey: 'BILLING_DATABASE_URL',
    port: '8004',
    env: { PORT: '8004' },
    script: 'billing-service/dist/index.js',
    required: false,
  }] : []),
];

const firstOrigin = () =>
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .find(Boolean);

const publicBackendUrl = () =>
  (process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${externalPort}`).replace(/\/+$/, '');

const appendSchema = (value, schema) => {
  const url = new URL(value);
  url.searchParams.set('schema', schema);
  return url.toString();
};

const configured = (...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value && value !== 'null' && value !== 'undefined') return value;
  }
  return undefined;
};

const databaseUrlFor = (schema, key) => {
  const explicit = configured(key);
  if (explicit) return explicit;
  const base = configured('DATABASE_URL', 'POSTGRES_URL');
  if (!base) throw new Error(`${key} or DATABASE_URL is required`);
  return appendSchema(base, schema);
};

const baseEnv = () => {
  const env = {
    ...process.env,
    NODE_ENV: nodeEnv,
    FEATURE_BILLING_ENABLED: featureBilling ? 'true' : 'false',
    AUTH_SERVICE_URL: localUrls.auth,
    ORGANIZATION_SERVICE_URL: localUrls.organization,
    ACADEMIC_SERVICE_URL: localUrls.academic,
    BILLING_SERVICE_URL: localUrls.billing,
    NOTIFICATION_SERVICE_URL: localUrls.notification,
    FILE_DOWNLOAD_BASE_URL: process.env.FILE_DOWNLOAD_BASE_URL || publicBackendUrl(),
    FILE_STORAGE_DIRECTORY: process.env.FILE_STORAGE_DIRECTORY || '/data/private-uploads',
    FILE_STORAGE_AT_REST_ENCRYPTED: process.env.FILE_STORAGE_AT_REST_ENCRYPTED || 'false',
    MALWARE_SCAN_MODE: process.env.MALWARE_SCAN_MODE || 'disabled',
    STARTUP_DEPENDENCY_ATTEMPTS: process.env.STARTUP_DEPENDENCY_ATTEMPTS || '20',
    STARTUP_DEPENDENCY_RETRY_DELAY_MS: process.env.STARTUP_DEPENDENCY_RETRY_DELAY_MS || '3000',
    STARTUP_DEPENDENCY_TIMEOUT_MS: process.env.STARTUP_DEPENDENCY_TIMEOUT_MS || '10000',
  };

  if (!env.FRONTEND_URL) env.FRONTEND_URL = firstOrigin() || publicBackendUrl();
  if (!env.ALLOWED_ORIGINS) env.ALLOWED_ORIGINS = env.FRONTEND_URL;
  if (!env.GOOGLE_CLIENT_ID) env.GOOGLE_CLIENT_ID = 'demo-google-client-id';
  if (!env.GOOGLE_CLIENT_SECRET) env.GOOGLE_CLIENT_SECRET = 'demo-google-client-secret';
  if (!env.GOOGLE_REDIRECT_URI) {
    env.GOOGLE_REDIRECT_URI = `${publicBackendUrl()}/api/v1/auth/google/callback`;
  }
  if (!env.REDIS_URL && nodeEnv !== 'production') env.REDIS_URL = 'redis://127.0.0.1:6379';
  if (!env.RABBITMQ_URL && nodeEnv !== 'production') env.RABBITMQ_URL = 'amqp://127.0.0.1:5672';
  if (nodeEnv !== 'production') {
    const twilioMissing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
      .some(key => !env[key]);
    if (!env.SMS_PROVIDER || (env.SMS_PROVIDER === 'twilio' && twilioMissing)) env.SMS_PROVIDER = 'mock';
  }
  return env;
};

const envForService = service => ({
  ...baseEnv(),
  ...service.env,
  DATABASE_URL: databaseUrlFor(service.schema, service.dbKey),
});

const gatewayEnv = () => ({
  ...baseEnv(),
  PORT: externalPort,
});

const migrate = service => {
  console.log(`[single-render] migrating ${service.name}`);
  const result = spawnSync(
    prismaBin,
    ['migrate', 'deploy', '--schema', `${service.schema === 'organization' ? 'organization-service' : `${service.schema}-service`}/src/prisma/schema.prisma`],
    {
      cwd: root,
      env: envForService(service),
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) {
    throw new Error(`${service.name} migration failed with exit ${result.status}`);
  }
};

const children = new Map();

const start = service => {
  console.log(`[single-render] starting ${service.name} on ${service.port}`);
  const child = spawn(nodeBin, [service.script], {
    cwd: root,
    env: envForService(service),
    stdio: 'inherit',
  });
  children.set(service.name, { child, service });
  child.on('exit', (code, signal) => {
    children.delete(service.name);
    console.error(`[single-render] ${service.name} exited`, { code, signal });
    if (service.required) shutdown(code || 1);
  });
  return child;
};

const waitForLive = async service => {
  const deadline = Date.now() + Number(process.env.SINGLE_RENDER_SERVICE_START_TIMEOUT_MS || 90000);
  const url = `http://127.0.0.1:${service.port}/health/live`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still booting.
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`${service.name} did not become live before timeout`);
};

let shuttingDown = false;
const shutdown = exitCode => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children.values()) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 3000).unref();
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  const activeServices = services.filter(service => featureBilling || service.schema !== 'billing');
  for (const service of activeServices) migrate(service);
  for (const service of activeServices) start(service);
  for (const service of activeServices.filter(service => service.required)) {
    await waitForLive(service);
  }

  console.log(`[single-render] starting gateway on ${externalPort}`);
  const gateway = spawn(nodeBin, ['gateway/dist/index.js'], {
    cwd: root,
    env: gatewayEnv(),
    stdio: 'inherit',
  });
  children.set('gateway', { child: gateway, service: { name: 'gateway', required: true } });
  gateway.on('exit', (code, signal) => {
    children.delete('gateway');
    console.error('[single-render] gateway exited', { code, signal });
    shutdown(code || 1);
  });
})().catch(error => {
  console.error('[single-render] startup failed', error);
  shutdown(1);
});
