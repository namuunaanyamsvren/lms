# Data retention and privacy operations

The organization data owner must approve jurisdiction-specific periods. The
defaults below minimize operational data while preserving educational and security
evidence. Legal hold overrides cleanup only when documented, scoped and reviewed.

| Data | Default | Cleanup / disposition |
|---|---:|---|
| Auth audit events | 365 days | Daily auth retention job deletes expired rows. Admin can export filtered JSON/CSV first. |
| Expired/revoked sessions | 90 days | Session deletion cascades refresh-token records. |
| Used/expired reset and verification tokens | 30 days | Daily auth retention job; only hashes are ever stored. |
| Published auth outbox events | 30 days | Daily auth retention job. |
| Notifications and delivery records | 90 days | Notification retention job; configure `NOTIFICATION_RETENTION_DAYS`. |
| Academic records | Organization policy / applicable education law | Retain only for the approved period. Account deletion anonymizes the user projection while grades, attendance and assessment evidence can remain detached from direct identity. |
| Billing invoices | Finance/tax policy | Organization-level retention; do not place full payment-card data in LMS. |
| Backups | Deployment policy | Encrypt, access-log, test restoration, expire automatically, and document how deletion propagates after the backup window. |

Configuration bounds are 1–3650 days. Changes require owner, reason, effective
date and legal/security approval. Cleanup counts are logged without row contents.

## User export

`GET /api/auth/privacy/export` requires the user's access token and returns a
download-only, `no-store` JSON document containing:

- account and connected-provider metadata;
- safe session and authentication audit history (masked IPs, filtered metadata);
- the user's tenant-scoped enrollments, submissions, attempts/answers, attendance,
  grades, certificates, lesson progress and requests.

If any source service is unavailable, the endpoint returns 503 instead of silently
claiming a partial export.

## Account deletion / anonymization

`DELETE /api/auth/privacy/account` requires CSRF, access authentication and exact
body `{ "confirmation": "DELETE" }`.

The auth transaction removes OAuth, reset/verification and session data; removes
PII from old audit rows; replaces identity fields with a non-routable anonymous
address; disables the account; writes a non-PII audit event; and commits an
`user.anonymized` outbox event. Academic consumers anonymize the identity
projection while retaining unlinkable educational records. Notification consumers
delete notifications, delivery recipients, preferences and push subscriptions.

The outbox/inbox pattern makes retries idempotent. Reconciliation and DLQ monitoring
must alert if the anonymization event is not consumed within the privacy SLA.

## Operational request handling

1. Authenticate the requester; for guardian requests verify the tenant guardian
   relation and authority.
2. Record scope, jurisdiction and deadline without placing exported PII in tickets.
3. Use self-service export/deletion where possible.
4. For correction, legal hold or organization-wide deletion, require data-owner
   review and enumerate every service, object store, search index, cache and backup.
5. Deliver exports through an authenticated channel; never email raw archives.
6. Record completion evidence and delete temporary artifacts.
