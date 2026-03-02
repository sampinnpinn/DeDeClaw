-- CreateTable
CREATE TABLE "asset_tags" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_tags_workspaceId_idx" ON "asset_tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tags_workspaceId_name_key" ON "asset_tags"("workspaceId", "name");
