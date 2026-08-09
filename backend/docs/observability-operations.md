# Observability and Operations

## Logging

- Runtime logs use structured JSON automatically in `NODE_ENV=production` or
  when `LOG_FORMAT=json`.
- Every HTTP request includes `requestId`, `method`, `path`, `statusCode`,
  `durationMs`, `userId` when authenticated, and `organizationId` when present.
- `X-Request-Id` is accepted from upstream and echoed back to clients so support
  can trace a browser report through gateway and downstream services.
- Centralized log storage target: Cloud provider log sink or Loki/OpenSearch with
  30-day hot retention and 1-year archive retention for audit/security incidents.

## Metrics

Every Node service exposes:

- `/health/live`
- `/health/ready`
- `/metrics`

Metrics are Prometheus text compatible:

- `http_requests_total`
- `http_request_duration_ms`
- `http_errors_total`
- `lms_process_uptime_seconds`
- `lms_process_memory_rss_bytes`
- `lms_business_events_total`
- `lms_queue_ready_messages`
- `lms_queue_unacked_messages`

Database, Redis, and RabbitMQ health are represented in readiness checks. Managed
provider metrics should be scraped alongside app metrics for CPU, memory, storage,
connections, slow queries, cache hit rate, queue depth, and consumer lag.

## Tracing

OpenTelemetry collector target:

- OTLP HTTP/gRPC collector per environment
- Gateway starts a trace for each request
- Downstream calls propagate `traceparent` and `x-request-id`
- Recommended spans: auth login/refresh, tenant resolution, Prisma query blocks,
  RabbitMQ publish/consume, notification delivery, billing webhook handling

Environment contract:

- `OTEL_ENABLED=true`
- `OTEL_SERVICE_NAME=<service-name>`
- `OTEL_EXPORTER_OTLP_ENDPOINT=<collector-url>`

## Error Tracking

Recommended provider: Sentry.

Environment contract:

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_TRACES_SAMPLE_RATE`

Rules:

- Never send request bodies containing passwords, OTPs, refresh tokens, files, or
  payment provider secrets.
- Include `requestId`, `organizationId`, user role, service, route, and release.
- Page-level frontend errors should include route and request id from failed API
  responses.

## Uptime Monitoring

External monitors:

- Frontend root route
- Gateway `/health`
- Auth login synthetic canary in staging
- Tenant dashboard synthetic canary in staging

Internal monitors:

- Service `/health/ready`
- PostgreSQL available storage, connections, replication lag, backup age
- Redis memory, rejected connections, latency
- RabbitMQ queue depth, unacked messages, consumer count
- SMTP/webhook delivery failures

## SLOs

- Gateway availability: 99.9% monthly
- Auth login p95 latency: < 800ms
- Dashboard p95 latency: < 1500ms
- API 5xx rate: < 1% over 5 minutes
- Notification delivery p95: < 5 minutes
- Backup freshness: < 24 hours
- Restore drill: at least monthly

## Dashboards

Create one dashboard per service:

- Gateway: RPS, p50/p95/p99 latency, 4xx/5xx, rate-limit blocks
- Auth: login success/failure, refresh failures, locked accounts, active sessions
- Organization: onboarding attempts/failures, tenant resolution latency
- Academic: submissions, quiz attempts, schedule mutations, report jobs
- Billing: invoices, payments, webhook failures, reconciliation lag
- Notification: queue depth, delivery success/failure, unread counts

## On-call and Escalation

- Severity 1: broad outage, login unavailable, data loss risk, payment webhook
  failure affecting many tenants. Page primary on-call immediately.
- Severity 2: single-service degradation, high latency, queue backlog, failed
  background jobs. Page primary during business hours; page after-hours if SLO
  burn rate is high.
- Severity 3: isolated tenant/user issue. Ticket queue with next-business-day SLA.
- Escalation order: primary on-call, secondary on-call, service owner, incident
  commander.
- Every Sev1/Sev2 incident requires timeline, customer impact, root cause,
  remediation, and follow-up owner.
