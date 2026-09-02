import type { Account } from "@prisma/client";
import { prisma } from "./prisma";
import { FALLBACK_PERIOD_MS, FREE_TRIAL, PLANS, type Plan, type PlanId } from "./plans";
import type { Identity } from "./auth";

// Two independent quotas: characters of text translation and seconds of STT
// audio. Consumption stays an atomic conditional decrement (single UPDATE
// with a WHERE guard on the balance) so two concurrent requests can never
// both succeed past zero — mirrors iq-rest's ai-quota.ts pattern.
//
// No entitled plan = the lifetime free pool the account (or the anonymous
// fingerprint) was created with; it never refills. An entitled plan refills
// lazily once quotaResetAt has elapsed.
//
// "Entitled" is the load-bearing word: a plan id alone is not enough, the
// subscription behind it must be ACTIVE. Refilling on the plan id alone meant
// a customer whose card stopped working (PAST_DUE) or whose subscription went
// `unpaid` kept collecting a fresh monthly quota for as long as Stripe left
// the subscription alive.

const ACTIVE = "ACTIVE";

/** The plan an account may actually spend against right now, or null. */
export function entitledPlan(account: Account): Plan | null {
  if (account.subscriptionStatus !== ACTIVE) return null;
  return PLANS[account.plan as PlanId] ?? null;
}

// Read first, write only when the row is genuinely missing: this runs on
// every /api/quota poll (one per open tab every 10s) and an unconditional
// upsert made that a write.
async function getOrCreateAccount(email: string): Promise<Account> {
  const found = await prisma.account.findUnique({ where: { email } });
  if (found) return found;
  return prisma.account.upsert({ where: { email }, create: { email }, update: {} });
}

async function refillIfDue(account: Account): Promise<Account> {
  const plan = entitledPlan(account);
  if (!plan) return account; // free pool: lifetime, no refill
  if (Date.now() < account.quotaResetAt.getTime()) return account;

  const nextReset = new Date(Date.now() + FALLBACK_PERIOD_MS);
  const data = {
    charsBalance: plan.charsPerMonth,
    secondsBalance: plan.minutesPerMonth * 60,
    quotaResetAt: nextReset,
  };
  // Guarded on the timestamp we read, so two concurrent requests refill once.
  const res = await prisma.account.updateMany({
    where: { email: account.email, quotaResetAt: account.quotaResetAt },
    data,
  });
  // Lost the race: whoever won already wrote the same numbers, and re-reading
  // is one query cheaper than being wrong about the balance.
  if (res.count === 0) return prisma.account.findUniqueOrThrow({ where: { email: account.email } });
  return { ...account, ...data };
}

export async function getAccountUsage(email: string) {
  const account = await refillIfDue(await getOrCreateAccount(email));
  return { account, plan: entitledPlan(account) };
}

// identity.quotaKey is "fp:<fingerprint>" for anonymous identities (see
// resolveIdentity) — strip the prefix to get back the raw fingerprint. It is
// deliberately NOT ownerKey: ownership moved to the anonymous id cookie, while
// the pool stays keyed on the request's own IP/UA/language so clearing cookies
// does not hand out a second free trial.
function fingerprintOf(identity: Identity): string {
  return identity.quotaKey.slice(3);
}

async function ensureAnonymousRow(fingerprint: string) {
  await prisma.anonymousCredit.upsert({
    where: { fingerprint },
    create: { fingerprint },
    update: {},
  });
}

export type ChargeResult = "ok" | "too_long" | "insufficient";

// Per-request length cap and the charge itself in ONE pass over the account.
// They used to be two exported calls, and each of them independently upserted
// the account row and ran the refill — four round trips (two of them writes)
// against the same row for every single translation.
export async function chargeChars(identity: Identity, chars: number): Promise<ChargeResult> {
  const cost = Math.max(1, chars);

  if (identity.kind === "anonymous") {
    if (chars > FREE_TRIAL.maxCharsPerRequest) return "too_long";
    const fingerprint = fingerprintOf(identity);
    await ensureAnonymousRow(fingerprint);
    const result = await prisma.anonymousCredit.updateMany({
      where: { fingerprint, charsUsed: { lte: FREE_TRIAL.chars - cost } },
      data: { charsUsed: { increment: cost } },
    });
    return result.count > 0 ? "ok" : "insufficient";
  }

  const { plan } = await getAccountUsage(identity.ownerKey);
  const maxChars = plan?.maxCharsPerRequest ?? FREE_TRIAL.maxCharsPerRequest;
  if (chars > maxChars) return "too_long";

  const result = await prisma.account.updateMany({
    where: { email: identity.ownerKey, charsBalance: { gte: cost } },
    data: { charsBalance: { decrement: cost } },
  });
  return result.count > 0 ? "ok" : "insufficient";
}

export async function chargeSeconds(identity: Identity, seconds: number): Promise<ChargeResult> {
  const cost = Math.max(1, Math.ceil(seconds));

  if (identity.kind === "anonymous") {
    const fingerprint = fingerprintOf(identity);
    await ensureAnonymousRow(fingerprint);
    const result = await prisma.anonymousCredit.updateMany({
      where: { fingerprint, secondsUsed: { lte: FREE_TRIAL.seconds - cost } },
      data: { secondsUsed: { increment: cost } },
    });
    return result.count > 0 ? "ok" : "insufficient";
  }

  await getAccountUsage(identity.ownerKey);
  const result = await prisma.account.updateMany({
    where: { email: identity.ownerKey, secondsBalance: { gte: cost } },
    data: { secondsBalance: { decrement: cost } },
  });
  return result.count > 0 ? "ok" : "insufficient";
}

// Voice charges its two legs apart (seconds before the STT, characters after
// it), so every failure between them has to hand the seconds back — otherwise
// an empty transcript or an out-of-characters account silently ate them.
export async function refundChars(identity: Identity, chars: number): Promise<void> {
  const amount = Math.max(1, chars);
  try {
    if (identity.kind === "anonymous") {
      await prisma.anonymousCredit.updateMany({
        where: { fingerprint: fingerprintOf(identity), charsUsed: { gte: amount } },
        data: { charsUsed: { decrement: amount } },
      });
      return;
    }
    await prisma.account.updateMany({
      where: { email: identity.ownerKey },
      data: { charsBalance: { increment: amount } },
    });
  } catch {
    // See refundSeconds.
  }
}

export async function refundSeconds(identity: Identity, seconds: number): Promise<void> {
  const amount = Math.max(1, Math.ceil(seconds));
  try {
    if (identity.kind === "anonymous") {
      await prisma.anonymousCredit.updateMany({
        where: { fingerprint: fingerprintOf(identity), secondsUsed: { gte: amount } },
        data: { secondsUsed: { decrement: amount } },
      });
      return;
    }
    await prisma.account.updateMany({
      where: { email: identity.ownerKey },
      data: { secondsBalance: { increment: amount } },
    });
  } catch {
    // A failed refund must not turn a handled error into a 500 — the caller is
    // already on its way out with a real message for the user.
  }
}

export async function maxCharsForIdentity(identity: Identity): Promise<number> {
  if (identity.kind === "anonymous") return FREE_TRIAL.maxCharsPerRequest;
  const { plan } = await getAccountUsage(identity.ownerKey);
  return plan?.maxCharsPerRequest ?? FREE_TRIAL.maxCharsPerRequest;
}
