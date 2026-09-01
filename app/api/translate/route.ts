import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3Client, s3Bucket, s3Key, getPublicUrl } from "@/lib/s3";
import { resolveIdentity } from "@/lib/auth";
import { getLanguage } from "@/lib/languages";
import { consumeCreditsForIdentity, maxCharsForIdentity } from "@/lib/credits";
import { creditsForAudio, creditsForText } from "@/lib/plans";
import { translateAudio, translateText } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

// 16 kHz mono 16-bit PCM WAV with a fixed 44-byte header (see lib/recorder.ts).
function wavDurationSeconds(buf: Buffer): number {
  return Math.max(0, (buf.length - 44) / 32000);
}

export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    let mode: "audio" | "text";
    let chatId = "";
    let audioBuf: Buffer | null = null;
    let audioMime = "audio/wav";
    let userText = "";

    if (contentType.includes("multipart/form-data")) {
      mode = "audio";
      const form = await req.formData();
      const file = form.get("audio");
      chatId = String(form.get("chatId") || "");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "no audio" }, { status: 400 });
      }
      audioBuf = Buffer.from(await file.arrayBuffer());
      audioMime = file.type || "audio/wav";
    } else {
      mode = "text";
      const body = await req.json();
      userText = typeof body.text === "string" ? body.text.trim() : "";
      chatId = typeof body.chatId === "string" ? body.chatId : "";
      if (!userText) {
        return NextResponse.json({ error: "no text" }, { status: 400 });
      }
    }

    if (!chatId) {
      return NextResponse.json({ error: "no chatId" }, { status: 400 });
    }

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.ownerKey !== identity.ownerKey) {
      return NextResponse.json({ error: "chat not found" }, { status: 404 });
    }

    const langA = getLanguage(chat.langA);
    const langB = getLanguage(chat.langB);
    if (!langA || !langB) {
      return NextResponse.json({ error: "unknown chat languages" }, { status: 500 });
    }

    const maxChars = await maxCharsForIdentity(identity);
    if (mode === "text" && userText.length > maxChars) {
      return NextResponse.json({ error: "text too long for your plan" }, { status: 413 });
    }
    const cost =
      mode === "audio" && audioBuf ? creditsForAudio(wavDurationSeconds(audioBuf)) : creditsForText(userText.length);
    const hasCredits = await consumeCreditsForIdentity(identity, cost);
    if (!hasCredits) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }

    // last 6 turns, oldest first, for conversational consistency
    const recent = (
      await prisma.translation.findMany({
        where: { chatId },
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

    const result =
      mode === "audio" && audioBuf
        ? await translateAudio(langA, langB, audioBuf, audioMime, recent)
        : await translateText(langA, langB, userText, recent);

    if (!result.translation) {
      return NextResponse.json({ error: "Не удалось распознать" }, { status: 422 });
    }

    const row = await prisma.translation.create({
      data: {
        chatId,
        mode,
        sourceLang: result.source_lang,
        transcript: result.transcript,
        translation: result.translation,
      },
    });

    await prisma.chat.update({ where: { id: chatId }, data: { lastUsedAt: new Date() } });

    let audioUrl: string | null = null;
    if (audioBuf) {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const key = s3Key("audio", yyyy, mm, `${row.id}.wav`);
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: s3Bucket(),
          Key: key,
          Body: audioBuf,
          ContentType: audioMime,
        }),
      );
      audioUrl = getPublicUrl(key);
      await prisma.translation.update({ where: { id: row.id }, data: { audioUrl } });
    }

    return NextResponse.json({ ...result, id: row.id, audioUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
