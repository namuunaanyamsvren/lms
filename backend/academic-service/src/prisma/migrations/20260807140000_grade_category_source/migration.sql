DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GradeCategorySource') THEN
    CREATE TYPE "GradeCategorySource" AS ENUM ('MANUAL', 'ATTENDANCE');
  END IF;
END $$;

ALTER TABLE "GradeCategory"
  ADD COLUMN IF NOT EXISTS "source" "GradeCategorySource" NOT NULL DEFAULT 'MANUAL';
