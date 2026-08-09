# Production launch verification

Use this record for the final launch approval after CI release-candidate checks
are green. Store the completed record in the team's runbook system and set the
four evidence URL environment variables to its stable HTTPS links.

## Secret verification

- Evidence env: `PRODUCTION_SECRET_INVENTORY_EVIDENCE_URL`
- Confirm every production secret is loaded from the deployment secret manager.
- Confirm no value is a placeholder, sample, test credential, or shared local
  development credential.
- Record secret names only, never secret values.
- Record owner, rotation date, next rotation date, and deployment target.

## Backup and restore drill

- Evidence env: `BACKUP_RESTORE_DRILL_EVIDENCE_URL`
- Run provider PITR or `npm run db:restore-drill` against an isolated restore
  target.
- Record backup ID, target time, start/end time, operator, and result.
- Verify all five schemas restore and compare tenant/user/course/invoice counts
  against the release checkpoint.

## Monitoring alert test

- Evidence env: `MONITORING_ALERT_TEST_EVIDENCE_URL`
- Confirm `SENTRY_DSN` or `ERROR_MONITORING_DSN` is configured for production.
- Trigger a controlled non-customer-impacting error in staging or production
  canary.
- Record alert URL, service, release SHA, request ID, routing destination, and
  acknowledgement time.

## Payment webhook live verification

- Evidence env: `PAYMENT_WEBHOOK_LIVE_VERIFICATION_URL`
- Required when `FEATURE_BILLING_ENABLED=true`.
- Send a live provider sandbox/low-value payment webhook through the public
  callback URL.
- Verify signature validation, idempotent reconciliation, invoice/payment state,
  and audit/outbox records.
- Record provider event ID, invoice ID, payment ID, callback URL, and result.

## Strict approval command

```bash
REQUIRE_PRODUCTION_LIVE_EVIDENCE=true npm run production:validate --prefix backend
```

The command must pass before marking a production launch as fully verified.
