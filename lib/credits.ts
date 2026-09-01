import { prisma } from "./prisma";
import { ANONYMOUS_CREDIT_LIMIT, PLANS, type PlanId } from "./plans";

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
