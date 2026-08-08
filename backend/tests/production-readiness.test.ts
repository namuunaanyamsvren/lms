import { describe, expect, it } from 'vitest';
import { validateProductionReadiness } from '@lms/shared';

const strong = 's'.repeat(48);

const baseProductionEnv = {
  NODE_ENV: 'production',
  REQUIRE_INTERNAL_TLS: 'true',
  ACCESS_TOKEN_SECRET: `access-${strong}`,
  REFRESH_TOKEN_SECRET: `refresh-${strong}`,
  CSRF_SECRET: `csrf-${strong}`,
  PHONE_OTP_HASH_SECRET: `otp-${strong}`,
  SERVICE_TOKEN_SECRET: `service-${strong}`,
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: `google-${strong}`,
  GOOGLE_REDIRECT_URI: 'https://app.example.com/auth/callback',
  PROVIDER_WEBHOOK_SECRET: `provider-${strong}`,
  ALLOWED_ORIGINS: 'https://app.example.com',
  FRONTEND_URL: 'https://app.example.com',
  AUTH_DATABASE_URL: 'postgresql://user:pass@db.example.com/lms?schema=auth&sslmode=verify-full',
  ORGANIZATION_DATABASE_URL: 'postgresql://user:pass@db.example.com/lms?schema=organization&sslmode=verify-full',
  ACADEMIC_DATABASE_URL: 'postgresql://user:pass@db.example.com/lms?schema=academic&sslmode=verify-full',
  BILLING_DATABASE_URL: 'postgresql://user:pass@db.example.com/lms?schema=billing&sslmode=verify-full',
  NOTIFICATION_DATABASE_URL: 'postgresql://user:pass@db.example.com/lms?schema=notification&sslmode=verify-full',
  REDIS_URL: 'rediss://redis.example.com:6380',
  RABBITMQ_URL: 'amqps://rabbit.example.com:5671',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: `smtp-${strong}`,
  SMTP_FROM: 'LMS Notifications <notifications@example.com>',
  SMS_PROVIDER_URL: 'https://sms.example.com/send',
  SMS_PROVIDER_TOKEN: `sms-${strong}`,
  WEB_PUSH_PROVIDER_URL: 'https://push.example.com/send',
  WEB_PUSH_PROVIDER_TOKEN: `push-${strong}`,
  FILE_DOWNLOAD_BASE_URL: 'https://api.example.com/api/uploads/download',
  FILE_STORAGE_AT_REST_ENCRYPTED: 'true',
  MALWARE_SCAN_MODE: 'required',
  MALWARE_SCANNER_URL: 'https://scanner.example.com/scan',
  FEATURE_BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_live_realistic',
  STRIPE_WEBHOOK_SECRET: 'whsec_realistic',
  STRIPE_PRICE_ID: 'price_live_realistic',
  QPAY_API_URL: 'https://qpay.example.com',
  QPAY_CLIENT_ID: 'qpay-client',
  QPAY_CLIENT_SECRET: `qpay-${strong}`,
  QPAY_WEBHOOK_SECRET: `qpay-webhook-${strong}`,
  QPAY_CALLBACK_URL: 'https://api.example.com/api/payments/qpay/webhook',
  SENTRY_DSN: 'https://public@example.com/1',
  BACKUP_RESTORE_DRILL_EVIDENCE_URL: 'https://runbooks.example.com/restore/latest',
};

describe('production readiness validator', () => {
  it('accepts a complete production SaaS environment', () => {
    const result = validateProductionReadiness(baseProductionEnv);

    expect(result.ready).toBe(true);
    expect(result.issues.filter(issue => issue.level === 'error')).toEqual([]);
  });

  it('fails closed for placeholder secrets, insecure transport, and test Stripe keys', () => {
    const result = validateProductionReadiness({
      ...baseProductionEnv,
      ACCESS_TOKEN_SECRET: 'secret-store-reference',
      REDIS_URL: 'redis://redis:6379',
      STRIPE_SECRET_KEY: 'sk_test_wrong',
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ACCESS_TOKEN_SECRET', level: 'error' }),
        expect.objectContaining({ key: 'REDIS_URL', level: 'error' }),
        expect.objectContaining({ key: 'STRIPE_SECRET_KEY', level: 'error' }),
      ]),
    );
  });

  it('allows explicit billing-off scope only as a warning', () => {
    const result = validateProductionReadiness({
      ...baseProductionEnv,
      FEATURE_BILLING_ENABLED: 'false',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      STRIPE_PRICE_ID: '',
    });

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({ key: 'FEATURE_BILLING_ENABLED', level: 'warning' }),
    ]);
  });

  it('requires QPay webhook configuration when billing is enabled', () => {
    const result = validateProductionReadiness({
      ...baseProductionEnv,
      QPAY_WEBHOOK_SECRET: '',
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'QPAY_WEBHOOK_SECRET', level: 'error' }),
      ]),
    );
  });
});
