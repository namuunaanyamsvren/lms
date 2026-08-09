# Environment Variable Reference

## Shared

- `NODE_ENV`: `development`, `test`, or `production`.
- `PORT`: service HTTP port.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: access and refresh signing secrets.
- `LOG_FORMAT`: set `json` for structured logs.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint.
- `REDIS_URL`: Redis connection string.
- `RABBITMQ_URL`: RabbitMQ connection string.

## Databases

- `AUTH_DATABASE_URL`
- `ORGANIZATION_DATABASE_URL`
- `ACADEMIC_DATABASE_URL`
- `BILLING_DATABASE_URL`
- `NOTIFICATION_DATABASE_URL`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`: local fallback only.

## Frontend / Auth

- `FRONTEND_URL`
- `CORS_ORIGIN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Files, Billing, Notifications

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `PROVIDER_WEBHOOK_SECRET`
- `PRODUCTION_SECRET_INVENTORY_EVIDENCE_URL`: HTTPS link to the release record
  proving production secrets were loaded from the deployment secret manager,
  are non-placeholder values, and have an owner/rotation date.
- `MONITORING_ALERT_TEST_EVIDENCE_URL`: HTTPS link to the latest production or
  production-equivalent Sentry/error-monitoring alert test.
- `PAYMENT_WEBHOOK_LIVE_VERIFICATION_URL`: HTTPS link to the latest live
  payment-provider webhook verification record.
- `BACKUP_RESTORE_DRILL_EVIDENCE_URL`
- `REQUIRE_PRODUCTION_LIVE_EVIDENCE`: set to `true` for final production
  approval. When enabled, missing production secret, monitoring alert, payment
  webhook, or restore-drill evidence fails `npm run production:validate`.

Run `npm run production:validate` before staging or production promotion. It
fails on missing TLS, placeholder secrets, disabled provider settings, and
unsafe live billing configuration.

Secrets must come from a managed secret store in staging/production. Do not commit real values.
