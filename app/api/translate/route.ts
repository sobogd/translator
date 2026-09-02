import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getLanguage } from "@/lib/languages";
import { consumeChars, maxCharsForIdentity } from "@/lib/credits";
import { translateText, translatePair } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
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
      return NextResponse.json({ error: "unknown topic languages" }, { status: 500 });
    }

    const maxChars = await maxCharsForIdentity(identity);
    if (text.length > maxChars) {
      return NextResponse.json({ error: "text too long for your plan" }, { status: 413 });
    }
    const hasCredits = await consumeChars(identity, text.length);
    if (!hasCredits) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }

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
      return NextResponse.json({ error: "Не удалось распознать" }, { status: 422 });
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
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
