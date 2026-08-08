# Testing Guide

## Backend

```bash
cd backend
npm run build
npm run test
npm run openapi:validate
npm run seed:check
```

## Frontend

```bash
cd frontend
npm run build
npm run test
npm run test:e2e
BROWSER_MATRIX=1 npm run test:e2e
```

## Non-functional

```bash
cd backend
npm run nonfunctional:resilience
npm run nonfunctional:k6
npm run db:restore-drill
```

CI must block on build, unit/integration tests, OpenAPI coverage, E2E smoke, dependency/security scanning, and migration drift checks.

## Definition of Done Evidence

For every feature PR, include the relevant test names, command output summary,
mobile/desktop smoke evidence, and any migration rollback/restore notes in the
PR description. Use `.github/pull_request_template.md`; the full policy is in
`docs/definition-of-done.md`.
