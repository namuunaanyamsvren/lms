ALTER TABLE "UserAccount" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "UserAccount_organizationId_deletedAt_idx"
  ON "UserAccount"("organizationId", "deletedAt");
