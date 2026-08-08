ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "unlockRule" TEXT NOT NULL DEFAULT 'SCHEDULED';

CREATE TABLE IF NOT EXISTS "CourseVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseVersion_organizationId_courseId_version_key"
  ON "CourseVersion"("organizationId", "courseId", "version");

CREATE INDEX IF NOT EXISTS "CourseVersion_organizationId_courseId_publishedAt_idx"
  ON "CourseVersion"("organizationId", "courseId", "publishedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CourseVersion_courseId_fkey'
  ) THEN
    ALTER TABLE "CourseVersion"
      ADD CONSTRAINT "CourseVersion_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
