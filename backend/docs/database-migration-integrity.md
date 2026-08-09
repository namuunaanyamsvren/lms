# Database migration and cross-service integrity

## Migration policy

Every Prisma service owns one PostgreSQL schema and has a checked-in baseline:

| Schema | Baseline |
|---|---|
| auth | `20260728000000_auth_baseline` |
| organization | `20260728000000_organization_baseline` |
| academic | `20260727000000_academic_baseline` |
| billing | `20260729000000_billing_baseline` |
| notification | `20260729000000_notification_baseline` |

New directories are named `YYYYMMDDHHMMSS_lower_snake_case`. Once a migration
has reached a shared environment, its SQL and name are immutable. Corrections
are a new, later migration.

Development may use `prisma migrate dev` to create reviewed SQL. Test, staging
and production use only `prisma migrate deploy`. `prisma db push`,
`prisma migrate reset`, `--force-reset`, and automatic destructive schema sync
are forbidden in Docker startup and deployment workflows.

The protected `database-deploy.yml` workflow deploys owner schemas in this
order: auth, organization, billing, notification, academic. Application rollout
must begin only after all schema steps succeed.

## Forward-fix and failed migration runbook

1. Stop the application rollout, but do not edit or delete applied migration
   files.
2. Capture the failing migration name, Prisma output, PostgreSQL logs,
   `_prisma_migrations` row, and a verified pre-change backup identifier.
3. If Prisma reports a failed migration that made no durable change, fix the
   database cause and use `prisma migrate resolve --rolled-back <name>`.
   Re-run the unchanged migration through `migrate deploy`.
4. If SQL partially committed or application data changed, write an idempotent
   forward-fix migration. Use guards and validation queries; rehearse against a
   restored production-sized copy.
5. For incompatible column changes, use expand/migrate/contract:
   add nullable/new structures, dual-read or backfill in bounded batches,
   switch traffic, and remove old structures in a later release.
6. A PITR rollback is a disaster-recovery action, not a normal migration undo.
   Restore into an isolated target, verify it, calculate the data-loss window,
   obtain incident/change approval, and only then plan cutover.

Never run `migrate reset` or restore over the only production copy.

## Data ownership

| Identifier/data | Authoritative service | Other-service handling |
|---|---|---|
| organization | organization-service | immutable ID projection from organization events |
| login identity / user ID | auth-service | academic projection from versioned user events |
| course and enrollment | academic-service | external consumers retain opaque IDs only |
| subscription, invoice, payment, money/currency | billing-service | accessed through billing API/events |
| per-recipient notification/delivery/preferences | notification-service | accessed through notification API/events |

There are no cross-database foreign keys. A cross-service ID is accepted only
from a verified tenant JWT, a service-authenticated owner API, or a versioned
event envelope. Consumers use inbox idempotency; publishers use transactional
outboxes. Reconciliation jobs alert on stalled inbox/outbox records. A command
that needs current ownership validates it synchronously with the authoritative
service; read paths may use explicitly named projections.

Tenant ID and resource ID must travel together. Local relations and uniqueness
always include `organizationId` where tenant scope applies. Cross-tenant
references return 404.

## Legacy academic billing/notification rows

The academic migration
`20260730100000_soft_delete_and_authoritative_services` removes the duplicate
Prisma models and renames existing tables to:

- `_legacy_Invoice_20260730`
- `_legacy_Payment_20260730`
- `_legacy_Notification_20260730`

This preserves existing history without allowing new writes. Before dropping
the archived tables:

1. Export counts and SHA-256 manifests grouped by organization.
2. Map every legacy invoice/payment to billing `Decimal(19,4)` plus its ISO
   4217 currency; require an idempotency/transaction key.
3. Import notification rows with deterministic idempotency keys.
4. Compare source/imported counts, totals per currency, rejected rows and
   tenant ownership.
5. Retain the signed reconciliation report and financial-owner approval.
6. Drop legacy tables only in a later reviewed migration after the retention
   window.

## Deletion and privacy integrity

Organizations, authoritative users, academic user projections and courses use
`deletedAt`. Active queries exclude it. Course deletion archives rather than
cascading educational history. Account deletion deletes credentials/sessions,
anonymizes direct identity, sets `deletedAt`, and fans out `USER_ANONYMIZED`.
Organization deprovisioning anonymizes user projections, archives courses,
erases notification PII, and disables—but retains—financial records.
