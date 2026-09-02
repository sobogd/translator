import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getLanguage, type Language } from "@/lib/languages";
import { consumeSeconds } from "@/lib/credits";
import { transcribeAudio } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

// 16 kHz mono 16-bit PCM WAV with a fixed 44-byte header (see lib/recorder.ts).
function wavDurationSeconds(buf: Buffer): number {
  return Math.max(0, (buf.length - 44) / 32000);
}

// Transcription only — the composer fills its textarea from the result so
// the user can edit/validate before actually translating (see /api/translate).
export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("audio");
    const topicId = String(form.get("topicId") || "");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "no audio" }, { status: 400 });
    }
    const audioBuf = Buffer.from(await file.arrayBuffer());
    const audioMime = file.type || "audio/wav";

    let sourceLang: Language | null = null;
    if (topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic || topic.ownerKey !== identity.ownerKey) {
        return NextResponse.json({ error: "topic not found" }, { status: 404 });
      }
      sourceLang = topic.sourceLang ? (getLanguage(topic.sourceLang) ?? null) : null;
    }

    const hasCredits = await consumeSeconds(identity, wavDurationSeconds(audioBuf));
    if (!hasCredits) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }

    const result = await transcribeAudio(sourceLang, audioBuf, audioMime);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
