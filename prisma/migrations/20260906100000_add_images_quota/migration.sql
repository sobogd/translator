-- Photo translation is billed per image, not per character (see
-- FREE_TRIAL/FREE_ACCOUNT/PLANS in lib/plans.ts). Free pools are lifetime and
-- sized to ~$0.02/person; subscribers get their plan's monthly allowance.
ALTER TABLE "accounts" ADD COLUMN "imagesBalance" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "anonymous_credits" ADD COLUMN "imagesUsed" INTEGER NOT NULL DEFAULT 0;

-- Backfill: active subscribers get their plan's monthly image allowance,
-- everyone else the lifetime free-account pool (10).
UPDATE "accounts" SET "imagesBalance" = CASE "plan"
  WHEN 'STARTER' THEN 400
  WHEN 'PRO' THEN 700
  WHEN 'ULTIMATE' THEN 1500
  ELSE 10 END;
