ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'TRIAL';
ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "OrgStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

CREATE TABLE IF NOT EXISTS "PlatformPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(19,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'MNT',
  "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
  "maxUsers" INTEGER NOT NULL DEFAULT 100,
  "maxCourses" INTEGER NOT NULL DEFAULT 50,
  "featuresJson" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPlan_slug_key" ON "PlatformPlan"("slug");
CREATE INDEX IF NOT EXISTS "PlatformPlan_isActive_idx" ON "PlatformPlan"("isActive");

CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "organizationId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT,
  "previousValue" TEXT,
  "newValue" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Organization_status_deletedAt_idx" ON "Organization"("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "Organization_createdAt_idx" ON "Organization"("createdAt");
CREATE INDEX IF NOT EXISTS "OrgSettings_organizationId_idx" ON "OrgSettings"("organizationId");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_organizationId_createdAt_idx" ON "PlatformAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_actorUserId_createdAt_idx" ON "PlatformAuditLog"("actorUserId", "createdAt");
