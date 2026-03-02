-- DropTable (if exists)
DROP TABLE IF EXISTS "asset_tags";

-- CreateTable
CREATE TABLE "assets" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "coverImage" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetId_key" ON "assets"("assetId");

-- CreateIndex
CREATE INDEX "assets_workspaceId_idx" ON "assets"("workspaceId");

-- CreateIndex
CREATE INDEX "assets_createdById_idx" ON "assets"("createdById");
