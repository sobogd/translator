-- AlterTable
ALTER TABLE "threads" ADD COLUMN     "ownerKey" TEXT;

-- CreateIndex
CREATE INDEX "threads_ownerKey_idx" ON "threads"("ownerKey");
