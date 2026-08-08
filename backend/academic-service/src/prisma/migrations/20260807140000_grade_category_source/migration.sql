CREATE TYPE "GradeCategorySource" AS ENUM ('MANUAL', 'ATTENDANCE');

ALTER TABLE "GradeCategory"
  ADD COLUMN IF NOT EXISTS "source" "GradeCategorySource" NOT NULL DEFAULT 'MANUAL';
