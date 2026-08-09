# Non-functional Checks

## Load, Spike, Soak

Run with k6 against a local or staging gateway:

```bash
k6 run backend/performance/k6/lms-nonfunctional.js
```

Useful overrides:

```bash
BASE_URL=http://127.0.0.1:8080/api/v1 \
TENANT=e2e-school \
EMAIL=admin@example.test \
PASSWORD='Correct horse battery staple 47' \
LOAD_VUS=25 SPIKE_VUS=100 SOAK_VUS=10 SOAK_DURATION=30m \
k6 run backend/performance/k6/lms-nonfunctional.js
```

## Backup Restore Drill

The backend already exposes a PITR restore drill:

```bash
cd backend
npm run db:backup:start
npm run db:backup:once
npm run db:restore-drill
```

The restore drill boots the latest base backup on an isolated port and verifies
the five application schemas exist.

## Redis/RabbitMQ/Downstream Resilience

Run services, stop one dependency, then run:

```bash
BASE_URL=http://127.0.0.1:8080/api/v1 node backend/scripts/nonfunctional/resilience-check.js
```

Expected behavior is bounded responses: no hung requests, no unhandled process
crashes, and graceful `401`, `403`, `404`, or `503` where a dependency is
required.
