import { prisma } from "./prisma";
import { FREE_TRIAL, PLANS, type PlanId } from "./plans";
import type { Identity } from "./auth";

// Two independent quotas: characters of text translation and seconds of STT
// audio. Consumption stays an atomic conditional decrement (single UPDATE
// with a WHERE guard on the balance) so two concurrent requests can never
// both succeed past zero — mirrors iq-rest's ai-quota.ts pattern.
//
// No subscription (plan not in PLANS) = the lifetime free-trial pool that the
// account was created with; it never refills. Active plans refill lazily
// once quotaResetAt has elapsed — cheap enough to run before every consume.

async function getOrCreateAccount(email: string) {
  return prisma.account.upsert({
    where: { email },
    create: { email },
    update: {},
  });
}

async function refillIfDue(email: string) {
  const account = await getOrCreateAccount(email);
  const plan = PLANS[account.plan as PlanId];
  if (!plan) return account; // free trial: lifetime pool, no refill
  if (Date.now() < account.quotaResetAt.getTime()) return account;

  const nextReset = new Date(Date.now() + 30 * 86_400_000);
  await prisma.account.updateMany({
    where: { email, quotaResetAt: account.quotaResetAt },
    data: {
      charsBalance: plan.charsPerMonth,
      secondsBalance: plan.minutesPerMonth * 60,
      quotaResetAt: nextReset,
    },
  });
  return prisma.account.findUniqueOrThrow({ where: { email } });
}

export async function getAccountUsage(email: string) {
  const account = await refillIfDue(email);
  const plan = PLANS[account.plan as PlanId] ?? null;
  return { account, plan };
}

// identity.ownerKey is "fp:<fingerprint>" for anonymous identities (see
// resolveIdentity) — strip the prefix to get back the raw fingerprint.
function fingerprintOf(identity: Identity): string {
  return identity.ownerKey.slice(3);
}

async function ensureAnonymousRow(fingerprint: string) {
  await prisma.anonymousCredit.upsert({
    where: { fingerprint },
    create: { fingerprint },
    update: {},
  });
}

export async function maxCharsForIdentity(identity: Identity): Promise<number> {
  if (identity.kind === "anonymous") return FREE_TRIAL.maxCharsPerRequest;
  const { plan } = await getAccountUsage(identity.ownerKey);
  return plan?.maxCharsPerRequest ?? FREE_TRIAL.maxCharsPerRequest;
}

export async function consumeChars(identity: Identity, chars: number): Promise<boolean> {
  const cost = Math.max(1, chars);
  if (identity.kind === "anonymous") {
    const fingerprint = fingerprintOf(identity);
    await ensureAnonymousRow(fingerprint);
    const result = await prisma.anonymousCredit.updateMany({
      where: { fingerprint, charsUsed: { lte: FREE_TRIAL.chars - cost } },
      data: { charsUsed: { increment: cost } },
    });
    return result.count > 0;
  }
  await refillIfDue(identity.ownerKey);
  const result = await prisma.account.updateMany({
    where: { email: identity.ownerKey, charsBalance: { gte: cost } },
    data: { charsBalance: { decrement: cost } },
  });
  return result.count > 0;
}

export async function consumeSeconds(identity: Identity, seconds: number): Promise<boolean> {
  const cost = Math.max(1, Math.ceil(seconds));
  if (identity.kind === "anonymous") {
    const fingerprint = fingerprintOf(identity);
    await ensureAnonymousRow(fingerprint);
    const result = await prisma.anonymousCredit.updateMany({
      where: { fingerprint, secondsUsed: { lte: FREE_TRIAL.seconds - cost } },
      data: { secondsUsed: { increment: cost } },
    });
    return result.count > 0;
  }
  await refillIfDue(identity.ownerKey);
  const result = await prisma.account.updateMany({
    where: { email: identity.ownerKey, secondsBalance: { gte: cost } },
    data: { secondsBalance: { decrement: cost } },
  });
  return result.count > 0;
}
