/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `assets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "skills" TEXT;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "coverGenerationError" TEXT,
ADD COLUMN     "coverGenerationFinishedAt" TIMESTAMP(3),
ADD COLUMN     "coverGenerationProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coverGenerationStartedAt" TIMESTAMP(3),
ADD COLUMN     "coverGenerationStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "coverGenerationStyle" TEXT,
ADD COLUMN     "coverGenerationTaskId" TEXT,
ADD COLUMN     "coverReferenceImage" TEXT,
ADD COLUMN     "coverStylePool" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "generationProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "generationStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "shareExpiresAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "asset_folder_tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_folder_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_call_logs" (
    "id" TEXT NOT NULL,
    "modelCustomId" TEXT NOT NULL,
    "apiType" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "username" TEXT,
    "channelId" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "isSuccess" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_folder_tags_workspaceId_idx" ON "asset_folder_tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_folder_tags_workspaceId_name_key" ON "asset_folder_tags"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "api_call_logs_userId_idx" ON "api_call_logs"("userId");

-- CreateIndex
CREATE INDEX "api_call_logs_modelCustomId_idx" ON "api_call_logs"("modelCustomId");

-- CreateIndex
CREATE INDEX "api_call_logs_apiType_idx" ON "api_call_logs"("apiType");

-- CreateIndex
CREATE INDEX "api_call_logs_callType_idx" ON "api_call_logs"("callType");

-- CreateIndex
CREATE INDEX "api_call_logs_createdAt_idx" ON "api_call_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "assets_shareToken_key" ON "assets"("shareToken");
