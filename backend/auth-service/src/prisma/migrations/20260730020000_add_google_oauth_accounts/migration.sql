CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_organizationId_provider_providerAccountId_key"
    ON "OAuthAccount"("organizationId", "provider", "providerAccountId");

CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key"
    ON "OAuthAccount"("userId", "provider");

CREATE INDEX "OAuthAccount_organizationId_email_idx"
    ON "OAuthAccount"("organizationId", "email");

CREATE INDEX "OAuthAccount_userId_idx"
    ON "OAuthAccount"("userId");

ALTER TABLE "OAuthAccount"
    ADD CONSTRAINT "OAuthAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
