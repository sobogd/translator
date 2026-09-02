import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { hasValidPass, requiresTurnstile } from "@/lib/turnstile";
import { getLanguage } from "@/lib/languages";
import { chargeChars, chargeSeconds, refundChars, refundSeconds } from "@/lib/credits";
import { transcribeAudio, translateText, translatePair } from "@/lib/gemini-translate";
import { allowRequest } from "@/lib/rate-limit";
import { MAX_AUDIO_BYTES, parseWav } from "@/lib/wav";

export const runtime = "nodejs";
export const maxDuration = 60;

// One-shot voice flow: audio in -> STT -> translate -> saved turn. Charges
// seconds for the STT leg and characters for the translation of the transcript
// (same split the pricing math assumes). Both legs are refunded if the request
// dies between them — the seconds used to be gone for good on an empty
// transcript or an out-of-characters account.
export async function POST(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  if (declared > MAX_AUDIO_BYTES + 4096) {
    return NextResponse.json({ error: "audio_too_long" }, { status: 413 });
  }

  let seconds = 0;
  let chars = 0;
  try {
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
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const audioBuf = Buffer.from(await file.arrayBuffer());
    if (audioBuf.length > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "audio_too_long" }, { status: 413 });
    }
    // Duration comes from the container, not from the byte count, and the mime
    // type we hand Gemini is ours, not the uploader's.
    const wav = parseWav(audioBuf);
    if (!wav) return NextResponse.json({ error: "bad_audio" }, { status: 400 });

    if ((await chargeSeconds(identity, wav.seconds)) !== "ok") {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    seconds = wav.seconds;

    const stt = await transcribeAudio(sourceLang, audioBuf, "audio/wav");
    const transcript = (stt.transcript ?? "").trim();
    if (!transcript) {
      await refundSeconds(identity, seconds);
      seconds = 0;
      return NextResponse.json({ error: "not_recognized" }, { status: 422 });
    }

    const charge = await chargeChars(identity, transcript.length);
    if (charge !== "ok") {
      await refundSeconds(identity, seconds);
      seconds = 0;
      return charge === "too_long"
        ? NextResponse.json({ error: "text_too_long" }, { status: 413 })
        : NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    chars = transcript.length;

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
      await refundSeconds(identity, seconds);
      await refundChars(identity, chars);
      seconds = 0;
      chars = 0;
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
    if (seconds) await refundSeconds(identity, seconds);
    if (chars) await refundChars(identity, chars);
    console.error("[translate-voice] failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
