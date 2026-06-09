-- AlterTable
ALTER TABLE "translations" ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translations_threadId_idx" ON "translations"("threadId");

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
