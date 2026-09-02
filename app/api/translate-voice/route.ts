import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getLanguage } from "@/lib/languages";
import { consumeChars, consumeSeconds } from "@/lib/credits";
import { transcribeAudio, translateText, translatePair } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

// 16 kHz mono 16-bit PCM WAV with a fixed 44-byte header (see lib/recorder.ts).
function wavDurationSeconds(buf: Buffer): number {
  return Math.max(0, (buf.length - 44) / 32000);
}

// One-shot voice flow: audio in → STT → translate → saved turn. Replaces the
// old two-step transcribe-then-edit path — the composer sends the recording
// straight here. Charges seconds for the STT leg and characters for the
// translation of the transcript (same split the pricing math assumes).
export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("audio");
    const topicId = String(form.get("topicId") || "");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "no audio" }, { status: 400 });
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

    const audioBuf = Buffer.from(await file.arrayBuffer());
    const audioMime = file.type || "audio/wav";

    const hasSeconds = await consumeSeconds(identity, wavDurationSeconds(audioBuf));
    if (!hasSeconds) return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

    const stt = await transcribeAudio(sourceLang, audioBuf, audioMime);
    const transcript = (stt.transcript ?? "").trim();
    if (!transcript) return NextResponse.json({ error: "Не удалось распознать" }, { status: 422 });

    const hasChars = await consumeChars(identity, transcript.length);
    if (!hasChars) return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

    // last 6 turns, oldest first, for conversational consistency
    const recent = (
      await prisma.translation.findMany({ where: { topicId }, orderBy: { createdAt: "desc" }, take: 6 })
    )
      .reverse()
      .map((t) => ({ sourceLang: t.sourceLang, transcript: t.transcript, translation: t.translation }));

    const result = sourceLang
      ? await translatePair(sourceLang, targetLang, transcript, recent)
      : await translateText(null, targetLang, transcript, recent);
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
