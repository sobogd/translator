import { prisma } from "./prisma";
import { ANONYMOUS_CREDIT_LIMIT, PLANS, type PlanId } from "./plans";
import type { Identity } from "./auth";

// Atomic conditional decrement: a single UPDATE with a WHERE guard on the
// current balance, so two concurrent requests can never both succeed past
// zero (no read-then-write race). Mirrors iq-rest's ai-quota.ts pattern.

async function getOrCreateAccount(email: string) {
  return prisma.account.upsert({
    where: { email },
    create: { email },
    update: {},
  });
}

// Lazily refills the credit balance once its period has elapsed. Cheap
// enough to call before every consume — no cron needed.
async function refillIfDue(email: string) {
  const account = await getOrCreateAccount(email);
  if (Date.now() < account.creditsResetAt.getTime()) return account;

  const plan = PLANS[account.plan as PlanId] ?? PLANS.FREE;
  const nextReset = new Date(Date.now() + plan.periodDays * 86_400_000);
  await prisma.account.updateMany({
    where: { email, creditsResetAt: account.creditsResetAt },
    data: { creditsBalance: plan.creditsPerPeriod, creditsResetAt: nextReset },
  });
  return prisma.account.findUniqueOrThrow({ where: { email } });
}

export async function getAccountUsage(email: string) {
  const account = await refillIfDue(email);
  const plan = PLANS[account.plan as PlanId] ?? PLANS.FREE;
  return { account, plan };
}

export async function consumeAccountCredits(email: string, cost: number): Promise<boolean> {
  await refillIfDue(email);
  const result = await prisma.account.updateMany({
    where: { email, creditsBalance: { gte: cost } },
    data: { creditsBalance: { decrement: cost } },
  });
  return result.count > 0;
}

export async function consumeAnonymousCredits(fingerprint: string, cost: number): Promise<boolean> {
  await prisma.anonymousCredit.upsert({
    where: { fingerprint },
    create: { fingerprint },
    update: {},
  });
  const result = await prisma.anonymousCredit.updateMany({
    where: { fingerprint, creditsUsed: { lte: ANONYMOUS_CREDIT_LIMIT - cost } },
    data: { creditsUsed: { increment: cost } },
  });
  return result.count > 0;
}

// identity.ownerKey is "fp:<fingerprint>" for anonymous identities (see
// resolveIdentity) — strip the prefix to get back the raw fingerprint.
function fingerprintOf(identity: Identity): string {
  return identity.ownerKey.slice(3);
}

export async function maxCharsForIdentity(identity: Identity): Promise<number> {
  if (identity.kind === "anonymous") return PLANS.FREE.maxCharsPerRequest;
  const { plan } = await getAccountUsage(identity.ownerKey);
  return plan.maxCharsPerRequest;
}

export async function consumeCreditsForIdentity(identity: Identity, cost: number): Promise<boolean> {
  if (identity.kind === "anonymous") return consumeAnonymousCredits(fingerprintOf(identity), cost);
  return consumeAccountCredits(identity.ownerKey, cost);
}
