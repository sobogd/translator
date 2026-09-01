-- Redesign: threads (title/context) -> chats (langA/langB).
-- Every existing thread predates multi-language support, so all data is RU<->ES.

-- 1. Add new columns as nullable first, backfill below, then tighten.
ALTER TABLE "threads" ADD COLUMN "langA" TEXT;
ALTER TABLE "threads" ADD COLUMN "langB" TEXT;
ALTER TABLE "threads" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- 2. Rows with NULL ownerKey predate the add_owner_key migration and are
--    already unreachable: every API route resolves a non-null owner and
--    filters by it. Drop them (cascades to their translations).
DELETE FROM "threads" WHERE "ownerKey" IS NULL;

-- 3. Consolidate: collapse every owner's threads into a single canonical
--    row (the oldest), re-pointing all of that owner's translations onto it.
DO $$
DECLARE
  r RECORD;
  canonical_id TEXT;
BEGIN
  FOR r IN SELECT "ownerKey" FROM "threads" GROUP BY "ownerKey" HAVING COUNT(*) > 1 LOOP
    SELECT id INTO canonical_id FROM "threads"
      WHERE "ownerKey" = r."ownerKey" ORDER BY "createdAt" ASC LIMIT 1;

    UPDATE "translations" SET "threadId" = canonical_id
      WHERE "threadId" IN (
        SELECT id FROM "threads" WHERE "ownerKey" = r."ownerKey" AND id <> canonical_id
      );

    DELETE FROM "threads" WHERE "ownerKey" = r."ownerKey" AND id <> canonical_id;
  END LOOP;
END $$;

-- 4. Populate the new columns. Every surviving row is the sole legacy
--    RU<->ES thread for its owner.
UPDATE "threads" SET "langA" = 'es', "langB" = 'ru';
UPDATE "threads" t SET "lastUsedAt" = COALESCE(
  (SELECT MAX("createdAt") FROM "translations" WHERE "threadId" = t.id),
  t."createdAt"
);

-- 5. Tighten constraints now that every row is populated.
ALTER TABLE "threads" ALTER COLUMN "langA" SET NOT NULL;
ALTER TABLE "threads" ALTER COLUMN "langB" SET NOT NULL;
ALTER TABLE "threads" ALTER COLUMN "lastUsedAt" SET NOT NULL;
ALTER TABLE "threads" ALTER COLUMN "lastUsedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "threads" ALTER COLUMN "ownerKey" SET NOT NULL;

-- 6. Drop obsolete columns.
ALTER TABLE "threads" DROP COLUMN "title";
ALTER TABLE "threads" DROP COLUMN "context";

-- 7. Rename table + FK column to match the new Chat model.
ALTER TABLE "threads" RENAME TO "chats";
ALTER TABLE "translations" RENAME COLUMN "threadId" TO "chatId";

-- 8. Rename constraints/indexes, add the new per-owner language-pair uniqueness.
ALTER INDEX "threads_pkey" RENAME TO "chats_pkey";
ALTER TABLE "translations" RENAME CONSTRAINT "translations_threadId_fkey" TO "translations_chatId_fkey";

DROP INDEX "threads_ownerKey_idx";
CREATE INDEX "chats_ownerKey_idx" ON "chats"("ownerKey");

DROP INDEX "translations_threadId_idx";
CREATE INDEX "translations_chatId_idx" ON "translations"("chatId");

CREATE UNIQUE INDEX "chats_ownerKey_langA_langB_key" ON "chats"("ownerKey", "langA", "langB");
