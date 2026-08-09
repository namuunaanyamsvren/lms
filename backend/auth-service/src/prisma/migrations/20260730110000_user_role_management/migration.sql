-- Add FINANCE without replacing the enum, preserving existing role values.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE';

CREATE TYPE "UserAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

ALTER TABLE "UserAccount"
  ADD COLUMN "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "profileImageKey" TEXT,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'mn',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ulaanbaatar',
  ADD COLUMN "notificationPreferences" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "invitedById" TEXT;

UPDATE "UserAccount"
SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"UserAccountStatus"
                    ELSE 'DEACTIVATED'::"UserAccountStatus" END;

DROP INDEX IF EXISTS "UserAccount_username_idx";
DROP INDEX IF EXISTS "UserAccount_phone_idx";

CREATE UNIQUE INDEX "UserAccount_organizationId_username_key"
  ON "UserAccount"("organizationId", "username");
CREATE UNIQUE INDEX "UserAccount_organizationId_phone_key"
  ON "UserAccount"("organizationId", "phone");
CREATE UNIQUE INDEX "UserAccount_organizationId_studentId_key"
  ON "UserAccount"("organizationId", "studentId");
CREATE UNIQUE INDEX "UserAccount_organizationId_employeeId_key"
  ON "UserAccount"("organizationId", "employeeId");
CREATE INDEX "UserAccount_organizationId_role_status_idx"
  ON "UserAccount"("organizationId", "role", "status");
