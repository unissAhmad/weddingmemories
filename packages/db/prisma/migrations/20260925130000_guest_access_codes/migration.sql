-- AlterEnum
ALTER TYPE "ContactType" ADD VALUE 'ACCESS_CODE';

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "accessCodeEnc" TEXT,
ADD COLUMN     "accessCodeLookup" TEXT,
ALTER COLUMN "contact" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Guest_eventId_accessCodeLookup_key" ON "Guest"("eventId", "accessCodeLookup");

