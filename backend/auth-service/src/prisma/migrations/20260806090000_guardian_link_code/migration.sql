ALTER TABLE "UserAccount"
  ADD COLUMN "guardianLinkCode" TEXT;

CREATE UNIQUE INDEX "UserAccount_organizationId_guardianLinkCode_key" ON "UserAccount"("organizationId", "guardianLinkCode");
