ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_enrollmentId_fkey'
  ) THEN
    ALTER TABLE "Certificate"
      ADD CONSTRAINT "Certificate_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Certificate_enrollmentId_idx" ON "Certificate"("enrollmentId");

-- A regular unique index treats NULL as distinct per-row, so the existing
-- (organizationId, studentId, courseId, revokedAt) unique constraint never
-- actually blocked two simultaneously-active certificates (both revokedAt
-- NULL) for the same student+course. This partial index enforces "at most one
-- active certificate per student+course" at the DB level; issueCertificate()
-- catches the resulting unique-violation and returns the existing row instead
-- of erroring.
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_active_unique"
  ON "Certificate" ("organizationId", "studentId", "courseId")
  WHERE "revokedAt" IS NULL;
