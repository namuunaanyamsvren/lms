import { z } from 'zod';

export type ServiceName =
  | 'gateway' | 'auth' | 'organization' | 'academic' | 'billing' | 'notification';

const environment = z.enum(['development', 'test', 'staging', 'production']);
const url = z.string().url();
const duration = z.string().regex(/^\d+(ms|s|m|h|d|w)$/i);
const strongSecret = z.string().min(43, 'must contain at least 256 bits of random base64url data');
const common = z.object({
  NODE_ENV: environment.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535),
  ACCESS_TOKEN_SECRET: strongSecret,
  ACCESS_TOKEN_EXPIRES_IN: duration.default('15m'),
  REDIS_URL: url,
});

const schemas: Record<ServiceName, z.ZodTypeAny> = {
  gateway: common.extend({
    AUTH_SERVICE_URL: url, ORGANIZATION_SERVICE_URL: url, ACADEMIC_SERVICE_URL: url,
    BILLING_SERVICE_URL: url, NOTIFICATION_SERVICE_URL: url, ALLOWED_ORIGINS: z.string().min(1),
  }),
  auth: common.extend({
    DATABASE_URL: url, RABBITMQ_URL: url, REFRESH_TOKEN_SECRET: strongSecret,
    REFRESH_TOKEN_EXPIRES_IN: duration.default('7d'), CSRF_SECRET: strongSecret,
    PHONE_OTP_HASH_SECRET: strongSecret, SERVICE_TOKEN_SECRET: strongSecret,
    ORGANIZATION_SERVICE_URL: url, ALLOWED_ORIGINS: z.string().min(1),
    ACADEMIC_SERVICE_URL: url,
    FRONTEND_URL: url, GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1), GOOGLE_REDIRECT_URI: url,
  }),
  organization: common.extend({
    DATABASE_URL: url, RABBITMQ_URL: url, SERVICE_TOKEN_SECRET: strongSecret,
    AUTH_SERVICE_URL: url, ACADEMIC_SERVICE_URL: url, ALLOWED_ORIGINS: z.string().min(1),
  }),
  academic: common.extend({
    DATABASE_URL: url, RABBITMQ_URL: url, SERVICE_TOKEN_SECRET: strongSecret,
    AUTH_SERVICE_URL: url, BILLING_SERVICE_URL: url, NOTIFICATION_SERVICE_URL: url,
    ALLOWED_ORIGINS: z.string().min(1),
  }),
  billing: common.extend({
    DATABASE_URL: url, RABBITMQ_URL: url, ALLOWED_ORIGINS: z.string().min(1),
  }),
  notification: common.extend({
    DATABASE_URL: url, RABBITMQ_URL: url, ALLOWED_ORIGINS: z.string().min(1),
  }),
};

export function validateServiceEnvironment(service: ServiceName): void {
  const result = schemas[service].safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `${issue.path.join('.') || 'environment'}: ${issue.message}`).join('; ');
    throw new Error(`[${service}] Invalid environment: ${details}`);
  }
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
  if (origins.includes('*')) throw new Error(`[${service}] ALLOWED_ORIGINS must be an explicit allowlist`);
  if (process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
    throw new Error('[auth] ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different');
  }
  validateTransportSecurity(service);
}

const isHttpsUrl = (value: string | undefined) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function validateTransportSecurity(
  service: ServiceName,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production') return;

  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (origins.some(origin => !isHttpsUrl(origin))) {
    throw new Error(`[${service}] Production ALLOWED_ORIGINS must contain only HTTPS origins`);
  }
  for (const key of ['FRONTEND_URL', 'GOOGLE_REDIRECT_URI']) {
    if (env[key] && !isHttpsUrl(env[key])) {
      throw new Error(`[${service}] ${key} must use HTTPS in production`);
    }
  }

  if (env.REQUIRE_INTERNAL_TLS !== 'true') {
    if (env.ALLOW_INSECURE_INTERNAL_TRANSPORT_FOR_TESTING === 'true') return;
    throw new Error(
      `[${service}] REQUIRE_INTERNAL_TLS must be true in production`,
    );
  }

  const insecureServiceUrl = Object.entries(env).find(
    ([key, value]) => key.endsWith('_SERVICE_URL') && value && !isHttpsUrl(value),
  );
  if (insecureServiceUrl) {
    throw new Error(`[${service}] ${insecureServiceUrl[0]} must use HTTPS when internal TLS is required`);
  }
  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://')) {
    throw new Error(`[${service}] REDIS_URL must use rediss:// when internal TLS is required`);
  }
  if (env.RABBITMQ_URL && !env.RABBITMQ_URL.startsWith('amqps://')) {
    throw new Error(`[${service}] RABBITMQ_URL must use amqps:// when internal TLS is required`);
  }
  if (env.DATABASE_URL) {
    const databaseUrl = new URL(env.DATABASE_URL);
    const sslMode = databaseUrl.searchParams.get('sslmode');
    if (!['require', 'verify-ca', 'verify-full'].includes(sslMode || '')) {
      throw new Error(
        `[${service}] DATABASE_URL must set sslmode=require, verify-ca, or verify-full when internal TLS is required`,
      );
    }
  }
}

export function validateFileSecurityEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const signingSecret = env.FILE_SIGNING_SECRET?.trim();
  if (env.NODE_ENV === 'production') {
    if (!signingSecret || Buffer.byteLength(signingSecret) < 32) {
      throw new Error('[academic] FILE_SIGNING_SECRET must contain at least 32 bytes in production');
    }
    if (!env.FILE_DOWNLOAD_BASE_URL || !isHttpsUrl(env.FILE_DOWNLOAD_BASE_URL)) {
      throw new Error('[academic] FILE_DOWNLOAD_BASE_URL must use HTTPS in production');
    }
    if (!env.FILE_STORAGE_DIRECTORY || !env.FILE_STORAGE_DIRECTORY.startsWith('/')) {
      throw new Error('[academic] FILE_STORAGE_DIRECTORY must be an absolute private path in production');
    }
    if (env.FILE_STORAGE_AT_REST_ENCRYPTED !== 'true') {
      throw new Error('[academic] FILE_STORAGE_AT_REST_ENCRYPTED must be true in production');
    }
    if (env.MALWARE_SCAN_MODE !== 'required') {
      throw new Error('[academic] MALWARE_SCAN_MODE must be required in production');
    }
    if (!env.MALWARE_SCANNER_URL || !isHttpsUrl(env.MALWARE_SCANNER_URL)) {
      throw new Error('[academic] MALWARE_SCANNER_URL must use HTTPS in production');
    }
  }
}
