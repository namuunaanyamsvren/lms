ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "cohortId" TEXT,
  ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER,
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accessRestricted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "qpayInvoiceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPayload" JSONB;

CREATE INDEX IF NOT EXISTS "Invoice_organizationId_studentId_idx" ON "Invoice"("organizationId", "studentId");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_enrollmentId_idx" ON "Invoice"("organizationId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_status_dueDate_idx" ON "Invoice"("organizationId", "status", "dueDate");
