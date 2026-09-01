-- Redesign: chats (langA/langB, one per owner+language-pair) -> topics
-- (independent sessions, sourceLang auto-detected/lockable, targetLang explicit).

-- 1. Add new columns as nullable first, backfill below, then tighten.
ALTER TABLE "chats" ADD COLUMN "title" TEXT;
ALTER TABLE "chats" ADD COLUMN "sourceLang" TEXT;
ALTER TABLE "chats" ADD COLUMN "targetLang" TEXT;

-- 2. Backfill: the old model was a symmetric pair, so direction is
--    arbitrary here — it locks in normally on each topic's next translation.
UPDATE "chats" SET "sourceLang" = "langA", "targetLang" = "langB";

-- 3. Tighten targetLang now that every row is populated (sourceLang stays
--    nullable — that's the new "auto-detect pending" state).
ALTER TABLE "chats" ALTER COLUMN "targetLang" SET NOT NULL;

-- 4. Drop obsolete columns + the per-language-pair uniqueness (topics are
--    independent sessions now, many per owner regardless of language pair).
DROP INDEX "chats_ownerKey_langA_langB_key";
ALTER TABLE "chats" DROP COLUMN "langA";
ALTER TABLE "chats" DROP COLUMN "langB";

-- 5. Rename table + FK column to match the new Topic model.
ALTER TABLE "chats" RENAME TO "topics";
ALTER TABLE "translations" RENAME COLUMN "chatId" TO "topicId";

-- 6. Rename constraints/indexes.
ALTER INDEX "chats_pkey" RENAME TO "topics_pkey";
ALTER TABLE "translations" RENAME CONSTRAINT "translations_chatId_fkey" TO "translations_topicId_fkey";

DROP INDEX "chats_ownerKey_idx";
CREATE INDEX "topics_ownerKey_idx" ON "topics"("ownerKey");

DROP INDEX "translations_chatId_idx";
CREATE INDEX "translations_topicId_idx" ON "translations"("topicId");

-- 7. Drop obsolete translation columns: mode is always "text" now (voice
--    input is transcribe-then-edit, not a separate translate path), and
--    audioUrl's playback feature was removed (recordings are ephemeral).
ALTER TABLE "translations" DROP COLUMN "mode";
ALTER TABLE "translations" DROP COLUMN "audioUrl";
