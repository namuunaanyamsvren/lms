-- CreateEnum
CREATE TYPE "ConsentFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsentAcknowledgementStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'DECLINED');

-- CreateTable
CREATE TABLE "ConsentForm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConsentFormStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAcknowledgement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consentFormId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "status" "ConsentAcknowledgementStatus" NOT NULL DEFAULT 'PENDING',
    "signatureName" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentForm_organizationId_status_idx" ON "ConsentForm"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ConsentAcknowledgement_organizationId_status_idx" ON "ConsentAcknowledgement"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ConsentAcknowledgement_studentUserId_idx" ON "ConsentAcknowledgement"("studentUserId");

-- CreateIndex
CREATE INDEX "ConsentAcknowledgement_parentUserId_idx" ON "ConsentAcknowledgement"("parentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentAcknowledgement_consentFormId_studentUserId_parentU_key" ON "ConsentAcknowledgement"("consentFormId", "studentUserId", "parentUserId");

-- AddForeignKey
ALTER TABLE "ConsentForm" ADD CONSTRAINT "ConsentForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcknowledgement" ADD CONSTRAINT "ConsentAcknowledgement_consentFormId_fkey" FOREIGN KEY ("consentFormId") REFERENCES "ConsentForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcknowledgement" ADD CONSTRAINT "ConsentAcknowledgement_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcknowledgement" ADD CONSTRAINT "ConsentAcknowledgement_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
