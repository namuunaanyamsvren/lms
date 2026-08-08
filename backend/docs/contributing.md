# Contribution Guide

## Branches And Commits

- Branch from `main` with `feature/`, `fix/`, `docs/`, or `test/`.
- Keep commits focused and reversible.
- Include migration, API docs, and tests in the same change when behavior changes.
- A backlog item may move to `[x]` only after the Definition of Done is met.

## Code Style

- TypeScript strict mode stays on.
- Request validation uses Zod.
- Service routes must use shared auth, tenant, error, request logging, and tracing middleware.
- Tenant-scoped data access must include `organizationId`.
- Background/event work must be idempotent.

## Pull Request Gates

- Complete `.github/pull_request_template.md`.
- Attach evidence for every applicable Definition of Done item.
- `npm run build`
- `npm run test`
- `npm run openapi:validate`
- affected frontend E2E tests
- migration drift check when Prisma schema changes

See `docs/definition-of-done.md` for the full checklist.
