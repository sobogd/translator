-- CreateTable
CREATE TABLE "analytics_salt" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rotatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_salt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_new" (
    "id" TEXT NOT NULL,
    "visitKey" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT,
    "os" TEXT,
    "country" TEXT NOT NULL DEFAULT 'XX',
    "region" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "lang" TEXT,
    "theme" TEXT,
    "from" TEXT,
    "ref" TEXT,
    "email" TEXT,
    "mergeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events_new" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topicId" TEXT,
    "locale" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_new_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_new_visitKey_key" ON "sessions_new"("visitKey");

-- CreateIndex
CREATE INDEX "sessions_new_firstAt_idx" ON "sessions_new"("firstAt");

-- CreateIndex
CREATE INDEX "sessions_new_email_idx" ON "sessions_new"("email");

-- CreateIndex
CREATE INDEX "sessions_new_hash_lastAt_idx" ON "sessions_new"("hash", "lastAt");

-- CreateIndex
CREATE INDEX "sessions_new_lastAt_idx" ON "sessions_new"("lastAt");

-- CreateIndex
CREATE INDEX "events_new_sessionId_at_idx" ON "events_new"("sessionId", "at");

-- CreateIndex
CREATE INDEX "events_new_page_action_at_idx" ON "events_new"("page", "action", "at");

-- CreateIndex
CREATE INDEX "events_new_topicId_at_idx" ON "events_new"("topicId", "at");

-- CreateIndex
CREATE INDEX "events_new_at_idx" ON "events_new"("at");

-- AddForeignKey
ALTER TABLE "events_new" ADD CONSTRAINT "events_new_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
