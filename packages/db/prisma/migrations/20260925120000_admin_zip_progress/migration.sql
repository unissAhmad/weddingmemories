-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DownloadJob" ADD COLUMN     "doneCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "photoCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalBytes" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");

