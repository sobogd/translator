import { prisma } from "./prisma";
import { getServerSessionEmail } from "./auth";
import { getAccountUsage } from "./credits";
import { FREE_TRIAL } from "./plans";

export type Quota = {
  kind: "anonymous" | "account";
  email?: string;
  plan: string;
  planName?: string | null;
  chars: number;
  seconds: number;
};

// SSR twin of GET /api/quota: computes the remaining quota during the server
// render so the header badge paints with data instead of waiting for a client
// fetch. Signed-in users resolve via the session cookie; anonymous visitors
// via the iqt_fp cookie the fingerprint lib mirrors (absent on the very first
// visit — the badge then fills in from the client poll).
export async function getServerQuota(): Promise<Quota | null> {
  const email = await getServerSessionEmail();
  if (email) {
    const { account, plan } = await getAccountUsage(email);
    return {
      kind: "account",
      email: account.email,
      plan: plan?.id ?? "FREE",
      planName: plan?.name ?? null,
      chars: Math.max(0, account.charsBalance),
      seconds: Math.max(0, account.secondsBalance),
    };
  }
  const { cookies } = await import("next/headers");
  const fingerprint = (await cookies()).get("iqt_fp")?.value?.trim();
  if (!fingerprint) return null;
  const row = await prisma.anonymousCredit.findUnique({ where: { fingerprint } });
  return {
    kind: "anonymous",
    plan: "FREE",
    chars: Math.max(0, FREE_TRIAL.chars - (row?.charsUsed ?? 0)),
    seconds: Math.max(0, FREE_TRIAL.seconds - (row?.secondsUsed ?? 0)),
  };
}
