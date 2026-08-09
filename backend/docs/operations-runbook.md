# Operations Runbook

## Service Down

1. Check external uptime monitor and gateway `/health`.
2. Check service `/health/live`, `/health/ready`, and `/metrics`.
3. Inspect structured logs by `requestId`, `service`, and `statusCode >= 500`.
4. Verify recent deployment, env changes, dependency health, and autoscaling.
5. Roll back to previous image if the failure correlates with release.

## Database Full or Slow

1. Check managed PostgreSQL storage, connections, CPU, and slow query dashboard.
2. Confirm latest backup and PITR status.
3. Stop non-essential report/export jobs if saturation is high.
4. Increase storage or connection pool capacity.
5. Open a follow-up for index/query tuning.

## Queue Stuck

1. Check RabbitMQ ready/unacked counts and consumer count.
2. Restart affected consumer service if no consumers are active.
3. Inspect dead-letter queues and event inbox idempotency failures.
4. Replay only idempotent events; never manually duplicate billing webhooks.

## Email Failure

1. Check notification-service logs and SMTP provider status.
2. Verify credentials and sender reputation.
3. Pause noisy retry jobs if provider is rate-limiting.
4. Requeue failed notifications after provider recovery.

## Webhook Failure

1. Check billing-service webhook logs by provider event id.
2. Verify signature secret and raw-body route behavior.
3. Confirm idempotency table state before replay.
4. Use provider dashboard to replay failed events after fix.

## Escalation

Escalate Sev1 immediately to primary on-call, then secondary after 10 minutes,
then service owner after 20 minutes. Assign incident commander for broad outage,
data loss risk, or payment impact.
