-- Align staff workflow request tables with the Prisma schema used by the
-- document and scholarship request controllers.

ALTER TYPE "DocumentRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ScholarshipRequestStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "ScholarshipRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "DocumentRequest"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "fileName" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "DocumentRequest"
  ALTER COLUMN "documentType" DROP DEFAULT;

ALTER TABLE "ScholarshipRequest"
  ADD COLUMN IF NOT EXISTS "applicationData" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "DocumentRequestHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "previousStatus" "DocumentRequestStatus",
  "newStatus" "DocumentRequestStatus" NOT NULL,
  "note" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentRequestHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScholarshipRequestHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "previousStatus" "ScholarshipRequestStatus",
  "newStatus" "ScholarshipRequestStatus" NOT NULL,
  "note" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScholarshipRequestHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DocumentRequestHistory_requestId_fkey'
  ) THEN
    ALTER TABLE "DocumentRequestHistory"
      ADD CONSTRAINT "DocumentRequestHistory_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ScholarshipRequestHistory_requestId_fkey'
  ) THEN
    ALTER TABLE "ScholarshipRequestHistory"
      ADD CONSTRAINT "ScholarshipRequestHistory_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "ScholarshipRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DocumentRequest_organizationId_status_idx" ON "DocumentRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ScholarshipRequest_organizationId_status_idx" ON "ScholarshipRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "DocumentRequestHistory_organizationId_requestId_idx" ON "DocumentRequestHistory"("organizationId", "requestId");
CREATE INDEX IF NOT EXISTS "DocumentRequestHistory_organizationId_changedBy_idx" ON "DocumentRequestHistory"("organizationId", "changedBy");
CREATE INDEX IF NOT EXISTS "ScholarshipRequestHistory_organizationId_requestId_idx" ON "ScholarshipRequestHistory"("organizationId", "requestId");
CREATE INDEX IF NOT EXISTS "ScholarshipRequestHistory_organizationId_changedBy_idx" ON "ScholarshipRequestHistory"("organizationId", "changedBy");
