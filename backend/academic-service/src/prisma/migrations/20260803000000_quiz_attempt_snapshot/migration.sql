-- Existing attempts predate secure immutable snapshots. Keep the migration deployable,
-- then require snapshots for every newly-created attempt at the application boundary.
ALTER TABLE "QuizAttempt" ADD COLUMN "questionSnapshotJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "QuizAttempt" ALTER COLUMN "questionSnapshotJson" DROP DEFAULT;
