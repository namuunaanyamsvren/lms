DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuizScoringPolicy') THEN
    CREATE TYPE "QuizScoringPolicy" AS ENUM ('HIGHEST', 'LATEST');
  END IF;
END $$;

ALTER TABLE "Quiz"
  ADD COLUMN IF NOT EXISTS "scoringPolicy" "QuizScoringPolicy" NOT NULL DEFAULT 'LATEST';
