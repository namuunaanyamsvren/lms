# Migration Guide

- Create migrations in the owning service only.
- Use `npm run prisma:generate` after schema changes.
- Use `npm run prisma:deploy` for all non-local deployments.
- Never use `prisma db push`, `migrate reset`, or destructive manual DDL in staging/production.
- Run `npm run prisma:check-drift` before release.
- Baseline legacy environments once with `npm run prisma:baseline-legacy`, then deploy normally.
- For zero-downtime releases, use expand/backfill/contract:
  - Add nullable/new columns and dual-write.
  - Backfill in batches.
  - Switch reads.
  - Remove old columns only after all old app versions are gone.
