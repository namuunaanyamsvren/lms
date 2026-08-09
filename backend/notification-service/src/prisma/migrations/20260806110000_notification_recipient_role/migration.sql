ALTER TABLE "NotificationRecipient"
  ADD COLUMN IF NOT EXISTS "role" TEXT;

CREATE INDEX IF NOT EXISTS "NotificationRecipient_organizationId_role_idx"
  ON "NotificationRecipient"("organizationId", "role");
