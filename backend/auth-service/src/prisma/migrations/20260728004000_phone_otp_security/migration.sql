ALTER TABLE "VerificationToken"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;

CREATE INDEX "VerificationToken_userId_type_usedAt_expiresAt_idx"
ON "VerificationToken"("userId", "type", "usedAt", "expiresAt");
