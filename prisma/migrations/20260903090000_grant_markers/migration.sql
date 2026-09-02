-- One-grant-per-paid-period markers (see lib/plans.ts planRank and the
-- quotaFor() rule in app/api/stripe/webhook/route.ts).
ALTER TABLE "accounts" ADD COLUMN "grantedPlan" TEXT;
ALTER TABLE "accounts" ADD COLUMN "grantedPeriodEnd" TIMESTAMP(3);
