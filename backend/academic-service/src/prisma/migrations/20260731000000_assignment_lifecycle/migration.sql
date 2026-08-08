CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Assignment"
  ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "allowLateSubmission" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lateDeadline" TIMESTAMP(3),
  ADD COLUMN "latePenaltyPercentPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Submission"
  ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "daysLate" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Grade"
  ADD COLUMN "latePenaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "AssignmentAttachment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_organizationId_status_idx" ON "Assignment"("organizationId", "status");
CREATE INDEX "Assignment_organizationId_deletedAt_idx" ON "Assignment"("organizationId", "deletedAt");
CREATE UNIQUE INDEX "AssignmentAttachment_organizationId_assignmentId_fileAssetId_key" ON "AssignmentAttachment"("organizationId", "assignmentId", "fileAssetId");
CREATE INDEX "AssignmentAttachment_organizationId_assignmentId_idx" ON "AssignmentAttachment"("organizationId", "assignmentId");

ALTER TABLE "AssignmentAttachment" ADD CONSTRAINT "AssignmentAttachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentAttachment" ADD CONSTRAINT "AssignmentAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
