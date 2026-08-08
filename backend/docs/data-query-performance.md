# Data Query and Performance Policy

## Pagination

List endpoints must accept `page` and `limit`. Default limit is 20 and service
handlers must cap public list endpoints at 100 rows unless the endpoint is a
bounded option list.

Responses keep the existing `data` array for client compatibility and add a
`pagination` object with `items`, `total`, `page`, `limit`, and `totalPages`.

## N+1 Audit

Use Prisma `include`/`select` for known relations and bulk fetch derived
per-row state. The announcement list is the reference pattern: page the
announcements, bulk fetch read receipts by `announcementId in (...)`, then merge
in memory.

## Slow Query Log

Every service Prisma singleton emits query events and logs queries slower than
`PRISMA_SLOW_QUERY_MS` milliseconds. The default threshold is `250`.

Use a higher threshold in noisy development environments:

```env
PRISMA_SLOW_QUERY_MS=500
```

## Composite Index Audit

Every query that combines `organizationId` with a status/date/user filter should
have a matching composite index in the owning Prisma schema. Check migrations
before adding an index so production drift stays deliberate.

High-value patterns:

- `organizationId + userId + createdAt`
- `organizationId + status + createdAt`
- `organizationId + courseId + createdAt`
- `organizationId + studentId + date`
- `organizationId + requestedById + createdAt`

## Dashboard Aggregates

Dashboards should use bounded aggregate queries and small recent-activity lists.
If an aggregate must scan more than the active tenant's current term, move it to
a scheduled rollup table or materialized view before launch.

## Redis Cache Strategy

Cache only read-heavy, recomputable values with clear invalidation ownership.
Current production cache:

- `notifications:unread:{organizationId}:{userId}` with invalidation on delivery,
  read, mark-all-read, delete, and clear operations.

Do not cache tenant-isolated business entities unless every write path in the
owning service invalidates the key.

## Connection Pool

Prisma connection pool sizing is controlled in the database URL. Production
deployments should set a bounded `connection_limit` per service so total pools
fit under PostgreSQL `max_connections`.

Example:

```env
DATABASE_URL="postgresql://user:pass@postgres:5432/lms_academic?schema=public&connection_limit=10&pool_timeout=10"
```

## Large Exports

Interactive exports are for small reports only. Large exports must use
`POST /api/reports/:type/jobs`, then poll/list jobs and download the generated
asset after background processing completes.

## Benchmark

Run the dependency-free smoke benchmark against local or staging services:

```bash
node scripts/performance-benchmark.js --base http://localhost:8000 --token "$TOKEN" --organization "$ORG_ID"
```

The script reports p50, p95, p99, error count, and throughput per endpoint.
