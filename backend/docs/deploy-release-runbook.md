# Container image release, promotion, and rollback

## Pipeline

Every push and pull request builds all backend service images (`gateway`,
`auth-service`, `organization-service`, `academic-service`,
`billing-service`, `notification-service`) and scans each with Trivy
(`container-images.yml`); the build fails on a CRITICAL/HIGH vulnerability in
the image. Pushes to `main` additionally publish the scanned images to GHCR,
tagged `ghcr.io/<owner>/lms-<service>:sha-<commit-sha>` and `:latest`.

Publishing an image is not deploying it. `:production` only moves when someone
explicitly promotes a SHA.

## Promotion (manual approval)

Before promotion, run the production readiness gate:

```bash
npm run production:validate
```

The gate must pass for live production launches, or the release owner must
document the exact non-applicable exception in the promotion record.

For final production approval, run the same gate with live evidence required:

```bash
REQUIRE_PRODUCTION_LIVE_EVIDENCE=true npm run production:validate
```

The strict gate requires HTTPS evidence links for:

- production secret-manager inventory and rotation owner;
- latest backup/restore drill result;
- latest Sentry/error-monitoring alert test;
- latest live payment webhook verification when billing is enabled.

Do not paste secrets into the evidence record. The record should show secret
names, source system, last rotation/owner, and validation result only.

`deploy-production.yml` is `workflow_dispatch`-only and targets the GitHub
`production` Environment. **Required reviewers must be turned on for that
Environment in repo Settings → Environments** — this is a one-time UI setting,
not something a committed workflow file can enable on its own. Without it,
the job runs unattended the moment it's triggered.

To promote a build:

1. Confirm the target commit's SHA passed `container-images.yml` on `main` (its images exist in GHCR as `:sha-<sha>`).
2. Run `deploy-production.yml` with that SHA as `image_sha`.
3. The job verifies each service's `:sha-<image_sha>` manifest actually exists in GHCR (fails loudly if it doesn't — e.g. a typo'd or unbuilt SHA), then repoints `:production` at it via `docker buildx imagetools create` (a manifest-level retag, not a rebuild or re-scan).
4. A required reviewer approves the run before it executes, per the Environment protection rule.

## Rollback

Rollback is the same workflow run with an earlier known-good SHA. Because
promotion only repoints a tag, there's no rebuild, no re-scan, and no waiting
— `:production` starts pointing at the old image again as soon as the run
completes.

Keep a record of the last few promoted SHAs (the `deploy-production.yml` run
history in GitHub Actions is authoritative) so a rollback target is always at
hand without having to reconstruct one from commit history under pressure.

## Retention

`image-retention.yml` runs weekly and prunes `:sha-*` versions older than 30
days, always keeping at least the 20 most recent per service. `:latest` and
`:production` are never deletion candidates — the prune filter only ever
matches the `sha-*` pattern. This bounds registry storage growth while
keeping enough history that a rollback target from the last several weeks is
always available.

## What this does not cover

These workflows build, scan, gate, tag, and retain backend images — they do not
deploy to a live host. The frontend production image is defined in
`frontend/Dockerfile`. For a real production environment with managed
PostgreSQL, Redis, RabbitMQ, and TLS/service-mesh endpoints, use
`backend/docker-compose.managed-production.yml`; it publishes only the nginx
frontend ingress on `FRONTEND_HTTP_PORT`.

Once a host is chosen, its deploy step should pull the promoted backend images,
build or pull the frontend image, inject production secrets from the deployment
secret manager, run `npm run production:validate`, then start:

```bash
docker compose -f backend/docker-compose.managed-production.yml up -d
```

Set `API_UPSTREAM`, all `*_SERVICE_URL` values, `REDIS_URL`, `RABBITMQ_URL`,
and service database URLs to HTTPS/TLS provider endpoints. The older
`docker-compose.yml` plus `docker-compose.production.yml` path remains useful
for a self-hosted rehearsal stack, but it still brings local infrastructure
containers with it.
