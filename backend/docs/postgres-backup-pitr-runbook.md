# PostgreSQL backup, retention and PITR runbook

## Recovery objectives

The default self-hosted reference policy is:

- verified physical base backup every 24 hours;
- 14-day base-backup retention;
- continuous WAL archiving with a 60-second archive timeout;
- monthly automated restore drill and a drill after PostgreSQL/storage changes.

Production owners must set explicit RPO/RTO values. Backup and WAL storage must
be encrypted, access-logged, immutable where supported, and located outside the
database host/failure domain. Compose named volumes demonstrate mechanics; they
are not off-site production storage.

## Automated backup

Start PostgreSQL and the scheduled backup worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.development.yml \
  --profile backup up -d postgres postgres-backup
```

Run an immediate verified backup:

```bash
npm run db:backup:once
```

`pg_basebackup --wal-method=stream` captures the entire cluster (all five
schemas), `pg_verifybackup` validates its manifest, and the worker removes only
base-backup directories older than `POSTGRES_BACKUP_RETENTION_DAYS`.

Monitor `pg_stat_archiver`: `failed_count` must not increase, `last_archived_wal`
must advance during writes, and archive storage must have capacity alerts.
Never delete WAL required by the oldest retained base backup. Production should
use a backup manager/provider that manages this dependency and object retention.

## Restore/PITR drill

The drill copies the newest base backup into an isolated temporary data
directory, configures `restore_command`, creates `recovery.signal`, starts a
separate PostgreSQL instance, and verifies all five schemas.

Latest recoverable point:

```bash
npm run db:restore-drill
```

Specific point:

```bash
PITR_TARGET_TIME=2026-07-30T10:30:00Z npm run db:restore-drill
```

Record the backup ID, target time, start/end time, recovered schema counts,
sample business totals, operator and result. A successful startup alone is not
enough: production drills must compare tenant/user/course/invoice counts and
currency totals against the expected checkpoint.

## Incident restore

1. Freeze writes and preserve the damaged cluster/WAL.
2. Select a verified base backup older than the target and confirm an unbroken
   WAL sequence through the target time.
3. Restore into a new isolated cluster with ordinary users blocked.
4. Configure `restore_command`, `recovery_target_time`,
   `recovery_target_inclusive`, and `recovery_target_action`.
5. Verify migrations, tenant counts, referential checks, billing totals and
   application smoke tests.
6. Document the estimated data-loss window and obtain incident/change approval.
7. Cut over DNS/connection secrets, monitor, and retain the old cluster
   read-only until the incident owner authorizes disposal.

Managed PostgreSQL deployments should enable provider PITR with the same or
stricter retention and run a real provider restore into a temporary instance.
