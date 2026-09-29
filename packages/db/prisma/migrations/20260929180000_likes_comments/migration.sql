-- CreateTable
CREATE TABLE "PhotoLike" (
    "photoId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoLike_pkey" PRIMARY KEY ("photoId","guestId")
);

-- CreateTable
CREATE TABLE "PhotoComment" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoLike_photoId_createdAt_idx" ON "PhotoLike"("photoId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoComment_photoId_createdAt_idx" ON "PhotoComment"("photoId", "createdAt");

-- AddForeignKey
ALTER TABLE "PhotoLike" ADD CONSTRAINT "PhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoLike" ADD CONSTRAINT "PhotoLike_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

