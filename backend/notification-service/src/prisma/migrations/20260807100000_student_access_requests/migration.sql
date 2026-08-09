CREATE TYPE "StudentAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "StudentAccessRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterOrganizationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requesterEmail" TEXT,
  "requesterName" TEXT,
  "note" TEXT,
  "status" "StudentAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewerNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentAccessRequest_organizationId_requesterUserId_key"
  ON "StudentAccessRequest"("organizationId", "requesterUserId");

CREATE INDEX "StudentAccessRequest_organizationId_status_createdAt_idx"
  ON "StudentAccessRequest"("organizationId", "status", "createdAt");

CREATE INDEX "StudentAccessRequest_requesterOrganizationId_requesterUserId_status_idx"
  ON "StudentAccessRequest"("requesterOrganizationId", "requesterUserId", "status");
