-- Replace Telegram/device identity with Google-login identity.
-- ownerKey stops being "telegram:<id>" / "device:<uuid>" and becomes the
-- verified Google email going forward.

-- 1. Session table for the new Google-login sessions.
CREATE TABLE "sessions" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_email_idx" ON "sessions"("email");

-- 2. Data: keep only the chat with the most translations (that's the real
--    primary user), reassign it to the admin's Google account, drop the rest
--    (their translations cascade with them). Data-driven so it doesn't
--    hardcode which legacy ownerKey that turns out to be.
DO $$
DECLARE
  keep_owner TEXT;
BEGIN
  SELECT c."ownerKey" INTO keep_owner
  FROM "chats" c
  JOIN "translations" t ON t."chatId" = c.id
  GROUP BY c."ownerKey"
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF keep_owner IS NOT NULL THEN
    DELETE FROM "chats" WHERE "ownerKey" <> keep_owner;
    UPDATE "chats" SET "ownerKey" = 'support@iq-rest.com' WHERE "ownerKey" = keep_owner;
  END IF;
END $$;
