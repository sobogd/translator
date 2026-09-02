import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { hasValidPass, requiresTurnstile } from "@/lib/turnstile";
import { getLanguage } from "@/lib/languages";
import { chargeChars, refundChars } from "@/lib/credits";
import { translateText, translatePair } from "@/lib/gemini-translate";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// nginx allows 25 MB on this vhost because voice uploads need the room. A text
// translation never does, and the body is parsed in full before text.length can
// be looked at — so the cheap guard has to come off the header first.
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Quotas bound how much gets translated, never how fast: 500 free characters
  // spent one character at a time is 500 Gemini calls, each paying the fixed
  // prompt overhead again.
  if (!allowRequest("translate", identity.quotaKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Anonymous traffic must carry a valid Turnstile pass before anything
  // reaches Gemini — checked ahead of credit consumption so a rejected
  // request never burns quota.
  if (requiresTurnstile(identity) && !hasValidPass(req)) {
    return NextResponse.json({ error: "turnstile_required" }, { status: 403 });
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "text_too_long" }, { status: 413 });
  }

  let charged = 0;
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const topicId = typeof body.topicId === "string" ? body.topicId : "";
    if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });
    if (!topicId) return NextResponse.json({ error: "no topicId" }, { status: 400 });

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic || topic.ownerKey !== identity.ownerKey) {
      return NextResponse.json({ error: "topic not found" }, { status: 404 });
    }

    const targetLang = getLanguage(topic.targetLang);
    const sourceLang = topic.sourceLang ? (getLanguage(topic.sourceLang) ?? null) : null;
    if (!targetLang || (topic.sourceLang && !sourceLang)) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    // One pass over the account: the per-request length cap and the charge used
    // to be two calls, each re-reading and re-writing the same row.
    const charge = await chargeChars(identity, text.length);
    if (charge === "too_long") {
      return NextResponse.json({ error: "text_too_long" }, { status: 413 });
    }
    if (charge === "insufficient") {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    charged = text.length;

    // last 6 turns, oldest first, for conversational consistency
    const recent = (
      await prisma.translation.findMany({
        where: { topicId },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
    )
      .reverse()
      .map((t) => ({
        sourceLang: t.sourceLang,
        transcript: t.transcript,
        translation: t.translation,
      }));

    // Once the pair is locked (a source got set on an earlier message), a
    // reply can come from either side — translating it always toward the
    // fixed targetLang would mangle a reply written in that same language.
    // Detect which of the two known languages this message is in and
    // translate to the other; the first message (sourceLang still null)
    // keeps the plain open-detect path, which locks the pair below.
    const result = sourceLang
      ? await translatePair(sourceLang, targetLang, text, recent)
      : await translateText(null, targetLang, text, recent);
    if (!result.translation) {
      // Nothing was produced, so nothing should have been paid for.
      await refundChars(identity, charged);
      charged = 0;
      return NextResponse.json({ error: "not_recognized" }, { status: 422 });
    }

    const row = await prisma.translation.create({
      data: {
        topicId,
        sourceLang: result.source_lang,
        transcript: result.transcript,
        translation: result.translation,
      },
    });

    await prisma.topic.update({
      where: { id: topicId },
      data: {
        lastUsedAt: new Date(),
        ...(topic.sourceLang ? {} : { sourceLang: result.source_lang }),
        ...(topic.title ? {} : { title: result.transcript.slice(0, 40) }),
      },
    });

    return NextResponse.json({ ...result, id: row.id });
  } catch (err: unknown) {
    if (charged) await refundChars(identity, charged);
    // The raw message used to go back to the browser, which meant Prisma
    // errors handed out table and column names — and the widget prints an
    // unrecognised code verbatim.
    console.error("[translate] failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
