# Deployment Architecture

## Runtime Targets

- **Frontend hosting/CDN:** Cloudflare Pages for the Vite static frontend, fronted
  by Cloudflare CDN, WAF, cache rules, Brotli, and managed TLS.
- **API ingress/reverse proxy/TLS:** Cloudflare DNS + WAF to a managed Kubernetes
  ingress controller or a managed container ingress. Public traffic terminates TLS
  at the edge and re-encrypts to the origin.
- **Domain/DNS:** Tenant subdomains use `*.TENANT_BASE_DOMAIN`; custom domains use
  TXT verification through the organization domain verification flow.
- **PostgreSQL managed instance:** Managed PostgreSQL 15+ with PITR, automated
  backups, read replicas where needed, private networking, and TLS-required URLs.
- **Redis managed instance:** Managed Redis with private networking, TLS, eviction
  policy configured for cache/session workloads, and health monitoring.
- **RabbitMQ managed/HA:** Managed RabbitMQ quorum queues or equivalent HA plan with
  TLS, private networking, dead-letter queues, and queue depth alarms.
- **Object storage + CDN:** Cloudflare R2 or S3-compatible private buckets for
  report/certificate/upload assets, signed URLs only, CDN for public immutable
  assets.

## Scaling

- Services are stateless. Access tokens are self-contained; refresh/session state,
  revocation, rate limits, and queues live in Redis/PostgreSQL/RabbitMQ.
- Horizontal scaling is safe for gateway, auth, organization, academic, billing,
  and notification services. Consumers must keep idempotency keys/event inboxes.
- Kubernetes/container platform requests start at `100m CPU / 256Mi` for gateway
  and `250m CPU / 512Mi` for service pods, then tune from metrics.
- Autoscaling should use request rate, p95 latency, CPU, memory, and queue depth.
  Notification consumers also scale on RabbitMQ ready-message count.

## Release Strategy

- **Staging:** Mirrors production topology with smaller managed instances, seeded
  deterministic data, and production-like secrets sourced from the secret manager.
- **Preview:** Per-PR frontend preview deployments and optional ephemeral backend
  namespaces for high-risk backend changes.
- **Zero-downtime migrations:** Prefer expand/migrate/contract:
  add nullable columns/tables first, deploy backwards-compatible code, backfill,
  enforce constraints, then remove old code/data in a later release.
- Run `npm run prisma:deploy`, OpenAPI validation, smoke E2E, browser matrix, and
  restore drill before production approval.
- Keep previous container image tags for immediate rollback. Roll back code first;
  database rollbacks use forward-fix unless the restore drill is explicitly invoked.

## Disaster Recovery

- Target RPO: 15 minutes for PostgreSQL PITR-backed data.
- Target RTO: 4 hours for complete regional rebuild; 30 minutes for app-only rollback.
- Required drills:
  - `npm run db:backup:once`
  - `npm run db:restore-drill`
  - Redis/RabbitMQ/downstream outage checks through
    `npm run nonfunctional:resilience`
- Store restore credentials and runbooks outside the cluster in the incident
  response knowledge base.
