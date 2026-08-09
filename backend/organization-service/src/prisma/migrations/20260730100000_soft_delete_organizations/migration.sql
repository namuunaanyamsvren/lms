ALTER TABLE "Organization" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Organization_status_deletedAt_idx"
  ON "Organization"("status", "deletedAt");
