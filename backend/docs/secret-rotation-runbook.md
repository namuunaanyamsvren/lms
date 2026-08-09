# Secret rotation runbook

Rotate `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SERVICE_TOKEN_SECRET`,
`CSRF_SECRET`, `PHONE_OTP_HASH_SECRET`, database, RabbitMQ, SMTP/Twilio and
provider credentials. Never place live values in Compose, source control, tickets,
chat, or logs.

## Prepare

1. Record owner, environment, reason, maintenance and rollback windows.
2. Generate every symmetric secret independently with a secret manager's 256-bit
   generator or `openssl rand -base64 32`. Never derive or reuse values.
3. Save new versions in the deployment secret manager and verify its audit log.
4. Back up state and confirm health dashboards and rollback access.

## Rotate

1. Rotate database/provider credentials through their native dual-credential flow.
2. Deploy `SERVICE_TOKEN_SECRET` to all callers and receivers together. Existing
   signed service tokens expire within 60 seconds.
3. Rotate `ACCESS_TOKEN_SECRET`; existing access tokens (default maximum 15 minutes)
   become invalid.
4. Rotate `REFRESH_TOKEN_SECRET` and revoke refresh sessions; users sign in again.
5. Rotate CSRF and OTP secrets; invalidate outstanding CSRF/OTP challenges.
6. Restart services and verify `/health`, login/refresh/logout, onboarding,
   provisioning, consumers and data stores.

## Roll back or respond

Restore the immediately previous secret-manager version, redeploy and repeat smoke
tests. For suspected exposure, never restore the exposed value: revoke credentials
and sessions, rotate again, retain audit evidence and notify the security owner.

## Close

Remove superseded versions after the rollback window, attach health and scan
evidence to the change record, and schedule the next rotation. Scan the full history:

```sh
gitleaks detect --source . --redact --log-opts="--all"
```
