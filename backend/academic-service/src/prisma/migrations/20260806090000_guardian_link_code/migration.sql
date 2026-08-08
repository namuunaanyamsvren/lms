ALTER TABLE "User"
  ADD COLUMN "guardianLinkCode" TEXT;

CREATE UNIQUE INDEX "User_organizationId_guardianLinkCode_key" ON "User"("organizationId", "guardianLinkCode");
