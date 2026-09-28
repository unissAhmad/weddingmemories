-- Storage moves from Cloudflare R2 to Cloudinary.
-- Renames keep existing rows valid (Prisma's generated drop/add would fail on NOT NULL).

-- Event: cover image is now a Cloudinary public_id
ALTER TABLE "Event" RENAME COLUMN "coverKey" TO "coverPublicId";

-- Photo: originals live in Cloudinary; derivatives are on-the-fly transformations
ALTER TABLE "Photo" RENAME COLUMN "originalKey" TO "publicId";
ALTER TABLE "Photo"
  DROP COLUMN "uploadId",
  DROP COLUMN "displayKey",
  DROP COLUMN "thumbKey",
  ADD COLUMN "format" TEXT;

-- DownloadJob: ZIPs are streamed on demand, so there is no build status or stored file
ALTER TABLE "DownloadJob"
  DROP COLUMN "status",
  DROP COLUMN "zipKeys",
  DROP COLUMN "doneCount",
  DROP COLUMN "error",
  DROP COLUMN "finishedAt",
  ADD COLUMN "photoIds" TEXT[];

DROP TYPE "JobStatus";
