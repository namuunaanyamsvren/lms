CREATE TABLE "CertificateTemplate" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Certificate of Completion', "issuerName" TEXT NOT NULL,
  "signatureName" TEXT, "accentColor" TEXT NOT NULL DEFAULT '#4E00AB', "logoUrl" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Certificate" DROP COLUMN "certificateUrl",
  ADD COLUMN "templateId" TEXT, ADD COLUMN "verificationCode" TEXT,
  ADD COLUMN "storageKey" TEXT, ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "courseTitle" TEXT, ADD COLUMN "issuedByUserId" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3), ADD COLUMN "revokedByUserId" TEXT,
  ADD COLUMN "revocationReason" TEXT, ADD COLUMN "reissuedFromId" TEXT;
UPDATE "Certificate" SET "verificationCode" = UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 12)),
  "storageKey" = 'legacy/' || "id" || '.pdf', "recipientName" = 'Certificate holder', "courseTitle" = 'Course';
ALTER TABLE "Certificate" ALTER COLUMN "verificationCode" SET NOT NULL,
  ALTER COLUMN "storageKey" SET NOT NULL, ALTER COLUMN "recipientName" SET NOT NULL,
  ALTER COLUMN "courseTitle" SET NOT NULL;
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");
CREATE INDEX "Certificate_organizationId_verificationCode_idx" ON "Certificate"("organizationId", "verificationCode");
CREATE UNIQUE INDEX "Certificate_one_active_per_course_idx" ON "Certificate"("organizationId", "studentId", "courseId") WHERE "revokedAt" IS NULL;
CREATE INDEX "CertificateTemplate_organizationId_isActive_idx" ON "CertificateTemplate"("organizationId", "isActive");
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
