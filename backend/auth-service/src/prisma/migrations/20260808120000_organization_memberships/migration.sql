CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMembership_organizationId_userId_key"
  ON "OrganizationMembership"("organizationId", "userId");

CREATE INDEX IF NOT EXISTS "OrganizationMembership_userId_status_idx"
  ON "OrganizationMembership"("userId", "status");

CREATE INDEX IF NOT EXISTS "OrganizationMembership_organizationId_role_status_idx"
  ON "OrganizationMembership"("organizationId", "role", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMembership_userId_fkey'
  ) THEN
    ALTER TABLE "OrganizationMembership"
      ADD CONSTRAINT "OrganizationMembership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "OrganizationMembership" (
  "id", "organizationId", "userId", "role", "status", "source", "approvedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "organizationId",
  "id",
  "role",
  "status",
  'PRIMARY_ACCOUNT',
  "createdAt",
  "createdAt",
  "updatedAt"
FROM "UserAccount"
WHERE "deletedAt" IS NULL
ON CONFLICT ("organizationId", "userId") DO NOTHING;
