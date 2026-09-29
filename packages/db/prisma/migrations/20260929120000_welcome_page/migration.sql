-- Welcome page: greeting, message, venue, and a set of showcase photos chosen by the couple.

ALTER TABLE "Event"
  ADD COLUMN "greeting" TEXT,
  ADD COLUMN "welcomeMessage" TEXT,
  ADD COLUMN "venue" TEXT;

CREATE TABLE "ShowcasePhoto" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowcasePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShowcasePhoto_eventId_position_idx" ON "ShowcasePhoto"("eventId", "position");

ALTER TABLE "ShowcasePhoto" ADD CONSTRAINT "ShowcasePhoto_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An existing cover image becomes the first welcome photo, so nothing is lost.
INSERT INTO "ShowcasePhoto" ("id", "eventId", "publicId", "position")
SELECT gen_random_uuid()::text, "id", "coverPublicId", 0
FROM "Event"
WHERE "coverPublicId" IS NOT NULL;

ALTER TABLE "Event" DROP COLUMN "coverPublicId";
