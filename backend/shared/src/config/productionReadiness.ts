type ReadinessLevel = 'error' | 'warning';

export type ProductionReadinessIssue = {
  level: ReadinessLevel;
  key: string;
  message: string;
};

export type ProductionReadinessResult = {
  ready: boolean;
  issues: ProductionReadinessIssue[];
};

const secretPlaceholderPattern = /^(|secret|secret-store-reference|change-me|changeme|example|password|postgres|guest)$/i;

const add = (
  issues: ProductionReadinessIssue[],
  level: ReadinessLevel,
  key: string,
  message: string,
) => issues.push({ level, key, message });

const required = (env: NodeJS.ProcessEnv, issues: ProductionReadinessIssue[], key: string) => {
  if (!env[key]?.trim()) add(issues, 'error', key, `${key} is required`);
};

const notPlaceholder = (env: NodeJS.ProcessEnv, issues: ProductionReadinessIssue[], key: string) => {
  const value = env[key]?.trim();
  if (value && secretPlaceholderPattern.test(value)) {
    add(issues, 'error', key, `${key} must come from a real secret value`);
  }
};

const requireHttpsUrl = (env: NodeJS.ProcessEnv, issues: ProductionReadinessIssue[], key: string) => {
  const value = env[key]?.trim();
  if (!value) return;
  try {
    if (new URL(value).protocol !== 'https:') {
      add(issues, 'error', key, `${key} must use HTTPS in production`);
    }
  } catch {
    add(issues, 'error', key, `${key} must be a valid URL`);
  }
};

const requirePostgresTls = (env: NodeJS.ProcessEnv, issues: ProductionReadinessIssue[], key: string) => {
  const value = env[key]?.trim();
  if (!value) {
    add(issues, 'error', key, `${key} is required`);
    return;
  }
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get('sslmode');
    if (!['require', 'verify-ca', 'verify-full'].includes(sslMode || '')) {
      add(issues, 'error', key, `${key} must set sslmode=require, verify-ca, or verify-full`);
    }
  } catch {
    add(issues, 'error', key, `${key} must be a valid PostgreSQL URL`);
  }
};

export function validateProductionReadiness(
  env: NodeJS.ProcessEnv = process.env,
): ProductionReadinessResult {
  const issues: ProductionReadinessIssue[] = [];

  if (env.NODE_ENV !== 'production') {
    add(issues, 'error', 'NODE_ENV', 'NODE_ENV must be production');
  }
  if (env.REQUIRE_INTERNAL_TLS !== 'true') {
    add(issues, 'error', 'REQUIRE_INTERNAL_TLS', 'Internal service traffic must require TLS');
  }

  [
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'CSRF_SECRET',
    'PHONE_OTP_HASH_SECRET',
    'SERVICE_TOKEN_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'PROVIDER_WEBHOOK_SECRET',
  ].forEach(key => {
    required(env, issues, key);
    notPlaceholder(env, issues, key);
  });

  if (env.ACCESS_TOKEN_SECRET && env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) {
    add(issues, 'error', 'REFRESH_TOKEN_SECRET', 'Access and refresh token secrets must be different');
  }

  ['ALLOWED_ORIGINS', 'FRONTEND_URL', 'GOOGLE_REDIRECT_URI', 'FILE_DOWNLOAD_BASE_URL', 'MALWARE_SCANNER_URL']
    .forEach(key => {
      required(env, issues, key);
      if (key !== 'ALLOWED_ORIGINS') requireHttpsUrl(env, issues, key);
    });

  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*')) {
    add(issues, 'error', 'ALLOWED_ORIGINS', 'ALLOWED_ORIGINS must be an explicit HTTPS allowlist');
  }
  origins.forEach(origin => {
    if (!origin.startsWith('https://')) add(issues, 'error', 'ALLOWED_ORIGINS', `Origin ${origin} must use HTTPS`);
  });

  [
    'AUTH_DATABASE_URL',
    'ORGANIZATION_DATABASE_URL',
    'ACADEMIC_DATABASE_URL',
    'BILLING_DATABASE_URL',
    'NOTIFICATION_DATABASE_URL',
  ].forEach(key => requirePostgresTls(env, issues, key));

  required(env, issues, 'REDIS_URL');
  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://')) {
    add(issues, 'error', 'REDIS_URL', 'REDIS_URL must use rediss:// in production');
  }
  required(env, issues, 'RABBITMQ_URL');
  if (env.RABBITMQ_URL && !env.RABBITMQ_URL.startsWith('amqps://')) {
    add(issues, 'error', 'RABBITMQ_URL', 'RABBITMQ_URL must use amqps:// in production');
  }

  ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach(key => {
    required(env, issues, key);
    notPlaceholder(env, issues, key);
  });
  // Matches the vars channel-provider.service.ts's sendChannel('SMS', ...) actually
  // reads (a generic HTTP bridge, not a Twilio SDK integration) — this previously
  // checked TWILIO_* vars the runtime code never reads, which would pass this
  // check while leaving SMS delivery completely unconfigured, or fail it while
  // SMS was actually working.
  ['SMS_PROVIDER_URL', 'SMS_PROVIDER_TOKEN'].forEach(key => {
    required(env, issues, key);
    notPlaceholder(env, issues, key);
  });
  requireHttpsUrl(env, issues, 'SMS_PROVIDER_URL');
  ['WEB_PUSH_PROVIDER_URL', 'WEB_PUSH_PROVIDER_TOKEN'].forEach(key => {
    required(env, issues, key);
    notPlaceholder(env, issues, key);
  });
  requireHttpsUrl(env, issues, 'WEB_PUSH_PROVIDER_URL');
  if (!env.SENTRY_DSN?.trim() && !env.ERROR_MONITORING_DSN?.trim()) {
    add(issues, 'warning', 'SENTRY_DSN', 'Configure SENTRY_DSN or ERROR_MONITORING_DSN before production incident monitoring handoff');
  }

  if (env.FEATURE_BILLING_ENABLED === 'true') {
    ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'].forEach(key => {
      required(env, issues, key);
      notPlaceholder(env, issues, key);
    });
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      add(issues, 'error', 'STRIPE_SECRET_KEY', 'Production billing must use a live Stripe secret key');
    }
    ['QPAY_API_URL', 'QPAY_CLIENT_ID', 'QPAY_CLIENT_SECRET', 'QPAY_WEBHOOK_SECRET', 'QPAY_CALLBACK_URL'].forEach(key => {
      required(env, issues, key);
      notPlaceholder(env, issues, key);
    });
    requireHttpsUrl(env, issues, 'QPAY_API_URL');
    requireHttpsUrl(env, issues, 'QPAY_CALLBACK_URL');
  } else {
    add(issues, 'warning', 'FEATURE_BILLING_ENABLED', 'Billing is disabled; production launch must explicitly accept this scope');
  }

  if (env.FILE_STORAGE_AT_REST_ENCRYPTED !== 'true') {
    add(issues, 'error', 'FILE_STORAGE_AT_REST_ENCRYPTED', 'Private file storage must be encrypted at rest');
  }
  if (env.MALWARE_SCAN_MODE !== 'required') {
    add(issues, 'error', 'MALWARE_SCAN_MODE', 'Malware scanning must fail closed in production');
  }
  if (!env.BACKUP_RESTORE_DRILL_EVIDENCE_URL?.trim()) {
    add(issues, 'warning', 'BACKUP_RESTORE_DRILL_EVIDENCE_URL', 'Attach latest restore-drill evidence before launch approval');
  }

  return { ready: !issues.some(issue => issue.level === 'error'), issues };
}
