# EduPulse LMS SaaS

Production-oriented multi-tenant LMS SaaS project with React/Vite frontend,
Express/TypeScript microservices, Prisma, PostgreSQL, Redis, RabbitMQ, Docker,
OpenAPI, tests, and deployment readiness checks.

## Local Run

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run docker:up
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Deploy Readiness

Run the full pre-deploy gate from the repository root:

```bash
npm run verify:deploy
```

This checks backend build/tests, OpenAPI coverage, frontend build/tests,
production readiness validation, and managed production Compose syntax.

## Production Deploy

Prepare real secrets and provider URLs:

```bash
cp deploy.env.example deploy.env
```

Then deploy the managed production stack:

```bash
docker compose --env-file deploy.env -f backend/docker-compose.managed-production.yml up -d --build
```

Only the frontend ingress is published. The frontend nginx container proxies
`/api` to `API_UPSTREAM`; app services use HTTPS/TLS internal endpoints from
the deploy environment.

## Required Evidence Before Launch

- `npm run verify:deploy` passed
- Fresh database migrations applied
- Restore drill evidence attached
- Desktop/mobile/accessibility smoke passed
- Critical/high vulnerabilities resolved or documented non-applicable
- Monitoring/logs/traces/alerts configured
