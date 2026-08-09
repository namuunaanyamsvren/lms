ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TABLE "Organization"
  ADD COLUMN "domainVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "domainVerificationToken" TEXT,
  ADD COLUMN "faviconUrl" TEXT;
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain") WHERE "domain" IS NOT NULL;
CREATE UNIQUE INDEX "Organization_domainVerificationToken_key" ON "Organization"("domainVerificationToken") WHERE "domainVerificationToken" IS NOT NULL;
ALTER TABLE "OrgSettings"
  ADD COLUMN "emailFromName" TEXT,
  ADD COLUMN "academicYear" TEXT,
  ADD COLUMN "semester" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ulaanbaatar',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'mn-MN',
  ADD COLUMN "gradingScaleJson" TEXT,
  ADD COLUMN "attendanceRuleJson" TEXT,
  ADD COLUMN "passwordPolicyJson" TEXT,
  ADD COLUMN "invitationCodeHash" TEXT,
  ADD COLUMN "allowedEmailDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
