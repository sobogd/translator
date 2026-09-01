import { NextRequest, NextResponse } from "next/server";
import { getLanguage } from "@/lib/languages";
import { consumeAnonymousCredits } from "@/lib/credits";
import { creditsForText, PLANS } from "@/lib/plans";
import { translateText } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 30;

// Unauthenticated landing-page demo widget. No chat, no persisted history —
// each call is a one-off translation, gated by a client-side fingerprint
// against a small lifetime credit pool (see lib/plans.ts).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const fromCode = typeof body.from === "string" ? body.from : "";
    const toCode = typeof body.to === "string" ? body.to : "";

    if (!fingerprint) return NextResponse.json({ error: "no fingerprint" }, { status: 400 });
    if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

    const langA = getLanguage(fromCode);
    const langB = getLanguage(toCode);
    if (!langA || !langB) return NextResponse.json({ error: "unknown language" }, { status: 400 });

    if (text.length > PLANS.FREE.maxCharsPerRequest) {
      return NextResponse.json({ error: "text too long" }, { status: 413 });
    }

    const cost = creditsForText(text.length);
    const ok = await consumeAnonymousCredits(fingerprint, cost);
    if (!ok) return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

    const result = await translateText(langA, langB, text);
    if (!result.translation) {
      return NextResponse.json({ error: "could not translate" }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
