-- Soft-delete markers preserve academic history while excluding retired
-- tenants, identity projections and courses from active queries.
ALTER TABLE "Organization" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Organization_organizationId_deletedAt_idx"
  ON "Organization"("organizationId", "deletedAt");
CREATE INDEX "User_organizationId_deletedAt_idx"
  ON "User"("organizationId", "deletedAt");
CREATE INDEX "Course_organizationId_deletedAt_idx"
  ON "Course"("organizationId", "deletedAt");

-- Preserve legacy rows for an explicit, audited reconciliation instead of
-- destructively dropping financial or notification history. These tables are
-- deliberately removed from Prisma Client; new writes go only to the
-- billing/notification services.
ALTER TABLE "Payment" RENAME TO "_legacy_Payment_20260730";
ALTER TABLE "Invoice" RENAME TO "_legacy_Invoice_20260730";
ALTER TABLE "Notification" RENAME TO "_legacy_Notification_20260730";
