-- AlterTable
-- updatedAt is set by Prisma Client on every write, not the database.
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
-- 20260730000000_notification_pipeline declared this index under a name
-- longer than Postgres's 63-byte identifier limit; Postgres silently
-- truncated it at creation time, leaving the on-disk name out of sync with
-- what schema.prisma (and Prisma's own truncation) expects.
ALTER INDEX "NotificationEventPreference_organizationId_preferenceId_eventTy" RENAME TO "NotificationEventPreference_organizationId_preferenceId_eve_key";
