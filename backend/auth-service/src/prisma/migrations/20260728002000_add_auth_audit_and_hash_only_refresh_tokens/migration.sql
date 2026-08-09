-- Raw refresh tokens are no longer persisted. The preceding secure-session
-- migration backfilled tokenHash before this sensitive legacy column is removed.
ALTER TABLE "RefreshToken" DROP COLUMN "token";

-- CreateEnum
CREATE TYPE "AuthAuditEventType" AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'ACCOUNT_LOCKED',
    'LOGOUT',
    'LOGOUT_ALL',
    'TOKEN_REFRESH',
    'TOKEN_REUSE_DETECTED',
    'SESSION_REVOKED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'PASSWORD_CHANGED',
    'EMAIL_VERIFIED',
    'PHONE_VERIFIED'
);

-- CreateTable
CREATE TABLE "AuthAuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "eventType" "AuthAuditEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx"
    ON "Session"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_userId_createdAt_idx"
    ON "AuthAuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_organizationId_createdAt_idx"
    ON "AuthAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_eventType_createdAt_idx"
    ON "AuthAuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_createdAt_idx"
    ON "AuthAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthAuditEvent"
    ADD CONSTRAINT "AuthAuditEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
