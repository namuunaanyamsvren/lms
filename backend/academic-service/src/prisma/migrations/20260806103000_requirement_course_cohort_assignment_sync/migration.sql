-- Requirement v0.1 alignment: course commercial metadata, cohort snapshot
-- metadata, enrollment lifecycle state, and GitHub/re-submit submission fields.

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "durationWeeks" INTEGER,
  ADD COLUMN IF NOT EXISTS "price" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'MNT';

ALTER TABLE "Cohort"
  ADD COLUMN IF NOT EXISTS "seatLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "scheduleJson" JSONB,
  ADD COLUMN IF NOT EXISTS "courseSnapshot" JSONB;

UPDATE "Cohort" cohort
SET "courseSnapshot" = jsonb_build_object(
  'courseId', course.id,
  'code', course.code,
  'title', course.title,
  'description', course.description,
  'level', course.level,
  'durationWeeks', course."durationWeeks",
  'price', course.price,
  'currency', course.currency,
  'capturedAt', NOW()
)
FROM "Course" course
WHERE cohort."courseId" = course.id
  AND cohort."courseSnapshot" IS NULL;

ALTER TABLE "Enrollment"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "repoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "resubmitRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resubmitReason" TEXT;

CREATE INDEX IF NOT EXISTS "Course_organizationId_currency_idx" ON "Course"("organizationId", "currency");
CREATE INDEX IF NOT EXISTS "Cohort_organizationId_status_idx" ON "Cohort"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Enrollment_organizationId_status_idx" ON "Enrollment"("organizationId", "status");
