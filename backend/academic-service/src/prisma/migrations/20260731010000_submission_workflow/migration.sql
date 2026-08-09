CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

ALTER TABLE "Submission"
  ADD COLUMN "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SubmissionAttachment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Submission_organizationId_assignmentId_studentId_isLatest_idx" ON "Submission"("organizationId", "assignmentId", "studentId", "isLatest");
CREATE UNIQUE INDEX "SubmissionAttachment_organizationId_submissionId_fileAssetId_key" ON "SubmissionAttachment"("organizationId", "submissionId", "fileAssetId");
CREATE INDEX "SubmissionAttachment_organizationId_submissionId_idx" ON "SubmissionAttachment"("organizationId", "submissionId");

ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
