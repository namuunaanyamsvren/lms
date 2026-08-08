CREATE TYPE "UserAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'GRANDPARENT', 'OTHER');
CREATE TYPE "GuardianStatus" AS ENUM ('INVITED', 'PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

ALTER TABLE "User"
  ADD COLUMN "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "profileImageKey" TEXT,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'mn',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ulaanbaatar',
  ADD COLUMN "notificationPreferences" JSONB NOT NULL DEFAULT '{}';

UPDATE "User"
SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"UserAccountStatus"
                    ELSE 'DEACTIVATED'::"UserAccountStatus" END;

DROP INDEX IF EXISTS "User_username_idx";
DROP INDEX IF EXISTS "User_phone_idx";
CREATE UNIQUE INDEX "User_organizationId_username_key" ON "User"("organizationId", "username");
CREATE UNIQUE INDEX "User_organizationId_phone_key" ON "User"("organizationId", "phone");
CREATE UNIQUE INDEX "User_organizationId_studentId_key" ON "User"("organizationId", "studentId");
CREATE UNIQUE INDEX "User_organizationId_employeeId_key" ON "User"("organizationId", "employeeId");
CREATE INDEX "User_organizationId_role_status_idx" ON "User"("organizationId", "role", "status");

ALTER TABLE "Guardian"
  ADD COLUMN "relationship" "GuardianRelationship" NOT NULL DEFAULT 'LEGAL_GUARDIAN',
  ADD COLUMN "status" "GuardianStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY['VIEW_SCHEDULE', 'VIEW_GRADES', 'VIEW_ATTENDANCE']::TEXT[],
  ADD COLUMN "invitedById" TEXT,
  ADD COLUMN "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "respondedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Guardian_organizationId_idx";
CREATE INDEX "Guardian_organizationId_status_idx" ON "Guardian"("organizationId", "status");
