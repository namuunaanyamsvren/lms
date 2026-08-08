DO $$
BEGIN
  CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "targetRoles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[],
  ADD COLUMN IF NOT EXISTS "targetUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "Announcement_organizationId_status_idx"
  ON "Announcement"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_scheduledAt_idx"
  ON "Announcement"("organizationId", "scheduledAt");

CREATE TABLE IF NOT EXISTS "AnnouncementAttachment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnnouncementReadReceipt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnnouncementAttachment_organizationId_announcementId_idx"
  ON "AnnouncementAttachment"("organizationId", "announcementId");
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementReadReceipt_organizationId_announcementId_userId_key"
  ON "AnnouncementReadReceipt"("organizationId", "announcementId", "userId");
CREATE INDEX IF NOT EXISTS "AnnouncementReadReceipt_organizationId_announcementId_idx"
  ON "AnnouncementReadReceipt"("organizationId", "announcementId");
CREATE INDEX IF NOT EXISTS "AnnouncementReadReceipt_organizationId_userId_idx"
  ON "AnnouncementReadReceipt"("organizationId", "userId");

DO $$
BEGIN
  ALTER TABLE "AnnouncementAttachment"
    ADD CONSTRAINT "AnnouncementAttachment_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AnnouncementReadReceipt"
    ADD CONSTRAINT "AnnouncementReadReceipt_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
