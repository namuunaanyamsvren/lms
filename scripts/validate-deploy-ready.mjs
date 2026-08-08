import { spawnSync } from 'node:child_process';
import process from 'node:process';

const commonEnv = {
  ...process.env,
  CI: process.env.CI || 'true',
};

const productionEnv = {
  ...commonEnv,
  NODE_ENV: 'production',
  REQUIRE_INTERNAL_TLS: 'true',
  ACCESS_TOKEN_SECRET: 'deploy-ready-access-secret-with-at-least-forty-three-characters',
  REFRESH_TOKEN_SECRET: 'deploy-ready-refresh-secret-with-at-least-forty-three-characters',
  SERVICE_TOKEN_SECRET: 'deploy-ready-service-secret-with-at-least-forty-three-characters',
  CSRF_SECRET: 'deploy-ready-csrf-secret-with-at-least-forty-three-characters',
  PHONE_OTP_HASH_SECRET: 'deploy-ready-phone-secret-with-at-least-forty-three-characters',
  GOOGLE_CLIENT_ID: 'deploy-ready-google-client',
  GOOGLE_CLIENT_SECRET: 'deploy-ready-google-secret',
  PROVIDER_WEBHOOK_SECRET: 'deploy-ready-provider-webhook-secret',
  ALLOWED_ORIGINS: 'https://lms.example.com',
  FRONTEND_URL: 'https://lms.example.com',
  FRONTEND_HTTP_PORT: '8080',
  TENANT_BASE_DOMAIN: 'lms.example.com',
  API_UPSTREAM: 'https://api.lms.example.com',
  AUTH_SERVICE_URL: 'https://auth.internal.example.com',
  ORGANIZATION_SERVICE_URL: 'https://organization.internal.example.com',
  ACADEMIC_SERVICE_URL: 'https://academic.internal.example.com',
  BILLING_SERVICE_URL: 'https://billing.internal.example.com',
  NOTIFICATION_SERVICE_URL: 'https://notification.internal.example.com',
  AUTH_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/auth?sslmode=require',
  ORGANIZATION_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/organization?sslmode=require',
  ACADEMIC_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/academic?sslmode=require',
  BILLING_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/billing?sslmode=require',
  NOTIFICATION_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/notification?sslmode=require',
  REDIS_URL: 'rediss://redis.example.com:6379',
  RABBITMQ_URL: 'amqps://rabbitmq.example.com:5671',
  GOOGLE_REDIRECT_URI: 'https://lms.example.com/auth/callback',
  FILE_DOWNLOAD_BASE_URL: 'https://lms.example.com/api/uploads/download',
  FILE_SIGNING_SECRET: 'deploy-ready-file-secret-with-at-least-thirty-two-bytes',
  FILE_STORAGE_AT_REST_ENCRYPTED: 'true',
  MALWARE_SCAN_MODE: 'required',
  MALWARE_SCANNER_URL: 'https://scanner.example.com/scan',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-pass',
  SMTP_FROM: 'noreply@example.com',
  SMS_PROVIDER_URL: 'https://sms.example.com/send',
  SMS_PROVIDER_TOKEN: 'deploy-ready-sms-token',
  TWILIO_ACCOUNT_SID: 'deploy-ready-twilio-account-sid',
  TWILIO_AUTH_TOKEN: 'deploy-ready-twilio-auth-token',
  TWILIO_FROM_NUMBER: '+15555550100',
  WEB_PUSH_PROVIDER_URL: 'https://push.example.com',
  WEB_PUSH_PROVIDER_TOKEN: 'push-token',
  SENTRY_DSN: 'https://public@example.com/1',
  FEATURE_BILLING_ENABLED: 'false',
  QPAY_API_URL: 'https://qpay.example.com',
  QPAY_CLIENT_ID: 'deploy-ready-qpay-client',
  QPAY_CLIENT_SECRET: 'deploy-ready-qpay-secret',
  QPAY_WEBHOOK_SECRET: 'deploy-ready-qpay-webhook-secret',
  QPAY_CALLBACK_URL: 'https://lms.example.com/api/payments/qpay/webhook',
};

const steps = [
  {
    name: 'Backend TypeScript build',
    command: 'npm',
    args: ['run', 'build', '--prefix', 'backend'],
    env: commonEnv,
  },
  {
    name: 'Backend tests',
    command: 'npm',
    args: ['run', 'test', '--prefix', 'backend'],
    env: commonEnv,
  },
  {
    name: 'OpenAPI route coverage',
    command: 'npm',
    args: ['run', 'openapi:validate', '--prefix', 'backend'],
    env: commonEnv,
  },
  {
    name: 'Frontend production build',
    command: 'npm',
    args: ['run', 'build', '--prefix', 'frontend'],
    env: commonEnv,
  },
  {
    name: 'Frontend tests',
    command: 'npm',
    args: ['run', 'test', '--prefix', 'frontend'],
    env: commonEnv,
  },
  {
    name: 'Production readiness gate',
    command: 'npm',
    args: ['run', 'production:validate', '--prefix', 'backend'],
    env: productionEnv,
  },
  ...(process.env.RUN_MIGRATION_DRIFT_CHECK === 'true'
    ? [{
        name: 'Prisma migration drift check',
        command: 'npm',
        args: ['run', 'prisma:check-drift', '--prefix', 'backend'],
        env: commonEnv,
      }]
    : []),
  {
    name: 'Managed production compose config',
    command: 'docker',
    args: ['compose', '-f', 'backend/docker-compose.managed-production.yml', 'config', '--quiet'],
    env: productionEnv,
  },
];

for (const [index, step] of steps.entries()) {
  console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: step.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`\nDeploy readiness failed: ${step.name}`);
    process.exit(result.status || 1);
  }
}

console.log('\nDeploy readiness passed.');
