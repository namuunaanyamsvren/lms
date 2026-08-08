BEGIN;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Add the new token-rotation columns as nullable so existing rows can be
-- migrated before the required constraints are enabled.
ALTER TABLE "RefreshToken"
    ADD COLUMN "sessionId" TEXT,
    ADD COLUMN "familyId" TEXT,
    ADD COLUMN "tokenHash" TEXT,
    ADD COLUMN "replacedById" TEXT,
    ADD COLUMN "usedAt" TIMESTAMP(3),
    ADD COLUMN "revokedAt" TIMESTAMP(3);

-- Preserve every legacy refresh token by assigning it a dedicated session and
-- token family. Existing UUID token IDs are safe to reuse across these separate
-- tables and make the migration deterministic.
INSERT INTO "Session" (
    "id",
    "userId",
    "tokenFamilyId",
    "deviceName",
    "createdAt",
    "lastUsedAt",
    "expiresAt",
    "revokedAt",
    "revokeReason"
)
SELECT
    "id",
    "userId",
    "id",
    'Legacy session',
    "createdAt",
    "createdAt",
    "expiresAt",
    CASE WHEN "revoked" THEN "createdAt" ELSE NULL END,
    CASE WHEN "revoked" THEN 'Migrated legacy revocation' ELSE NULL END
FROM "RefreshToken";

-- PostgreSQL's built-in sha256(bytea) keeps raw refresh tokens out of the new
-- lookup column without requiring a database extension.
UPDATE "RefreshToken"
SET
    "sessionId" = "id",
    "familyId" = "id",
    "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex'),
    "revokedAt" = CASE WHEN "revoked" THEN "createdAt" ELSE NULL END;

ALTER TABLE "RefreshToken"
    ALTER COLUMN "sessionId" SET NOT NULL,
    ALTER COLUMN "familyId" SET NOT NULL,
    ALTER COLUMN "tokenHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenFamilyId_key" ON "Session"("tokenFamilyId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- AddForeignKey
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_replacedById_fkey"
    FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
