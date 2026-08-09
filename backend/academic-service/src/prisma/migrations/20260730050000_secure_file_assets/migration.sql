CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "scanStatus" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileAsset_organizationId_storageKey_key"
  ON "FileAsset"("organizationId", "storageKey");
CREATE INDEX "FileAsset_organizationId_ownerUserId_createdAt_idx"
  ON "FileAsset"("organizationId", "ownerUserId", "createdAt");
CREATE INDEX "FileAsset_organizationId_sha256_idx"
  ON "FileAsset"("organizationId", "sha256");
