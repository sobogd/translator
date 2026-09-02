-- Credits -> split quotas (chars of text + seconds of audio).
ALTER TABLE "accounts" ADD COLUMN "charsBalance" INTEGER NOT NULL DEFAULT 4000;
ALTER TABLE "accounts" ADD COLUMN "secondsBalance" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "accounts" ADD COLUMN "quotaResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: subscribers get their new plan allowance immediately; everyone
-- else gets the lifetime free-trial pool.
UPDATE "accounts" SET
  "charsBalance" = CASE "plan"
    WHEN 'STARTER' THEN 1500000
    WHEN 'PRO' THEN 3000000
    WHEN 'ULTIMATE' THEN 8000000
    ELSE 4000 END,
  "secondsBalance" = CASE "plan"
    WHEN 'STARTER' THEN 15000
    WHEN 'PRO' THEN 36000
    WHEN 'ULTIMATE' THEN 90000
    ELSE 120 END,
  "quotaResetAt" = "creditsResetAt";

ALTER TABLE "accounts" DROP COLUMN "creditsBalance";
ALTER TABLE "accounts" DROP COLUMN "creditsResetAt";

ALTER TABLE "anonymous_credits" ADD COLUMN "charsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "anonymous_credits" ADD COLUMN "secondsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "anonymous_credits" DROP COLUMN "creditsUsed";
