-- Replace the partial unique indexes from 20260803010000_saas_management
-- with plain unique indexes: Postgres unique indexes already treat multiple
-- NULLs as distinct, so the `WHERE ... IS NOT NULL` filter was redundant and
-- diverged from what schema.prisma's `String? @unique` fields canonically
-- generate. Behavior is unchanged; this just reconciles the migration
-- history with schema.prisma so `prisma migrate diff` reports no drift.
DROP INDEX "Organization_domain_key";
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

DROP INDEX "Organization_domainVerificationToken_key";
CREATE UNIQUE INDEX "Organization_domainVerificationToken_key" ON "Organization"("domainVerificationToken");
