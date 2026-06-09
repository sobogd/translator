import { GoogleGenAI, Type } from "@google/genai";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3Client, s3Bucket, s3Key, getPublicUrl } from "@/lib/s3";
import { resolveOwner } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.5-flash"; // fast + ~10-20x cheaper; thinking disabled below

const AUDIO_PROMPT = `You are a professional RU<->ES interpreter.
The audio contains speech in either Russian or Spanish.
1. Detect the spoken language (ru or es).
2. Transcribe the speech accurately (correct punctuation, no filler).
3. Translate it into the OTHER language:
   - if source is Russian -> translate to Spanish (Spain, natural, fluent)
   - if source is Spanish -> translate to Russian (natural, fluent)
Keep meaning, tone and register. Produce a high-quality, idiomatic translation,
not a literal word-for-word one. If audio is empty or unintelligible, return empty strings.`;

const TEXT_PROMPT = `You are a professional RU<->ES interpreter.
The user provides a text in either Russian or Spanish.
1. Detect the language (ru or es).
2. Echo it back as the transcript (correct obvious typos/punctuation, no filler).
3. Translate it into the OTHER language:
   - if source is Russian -> translate to Spanish (Spain, natural, fluent)
   - if source is Spanish -> translate to Russian (natural, fluent)
Keep meaning, tone and register. Produce a high-quality, idiomatic translation,
not a literal word-for-word one. If the text is empty, return empty strings.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    source_lang: { type: Type.STRING, enum: ["ru", "es"] },
    transcript: { type: Type.STRING },
    translation: { type: Type.STRING },
  },
  required: ["source_lang", "transcript", "translation"],
};

const genConfig = {
  temperature: 0.2,
  responseMimeType: "application/json",
  responseSchema,
  thinkingConfig: { thinkingBudget: 0 },
};

type GeminiResult = {
  source_lang: "ru" | "es";
  transcript: string;
  translation: string;
};

type RecentTurn = { sourceLang: string; transcript: string; translation: string };

// Topic + recent turns so the model disambiguates names/domain terms and stays
// consistent across a thread (e.g. "Foxy" is an animal's name, not "лиса").
function contextBlock(context: string, recent: RecentTurn[]): string {
  if (!context && recent.length === 0) return "";
  let block =
    "\n\nThis is part of an ongoing translation conversation. Use the TOPIC and " +
    "RECENT TURNS below to disambiguate proper names, domain terms and entities " +
    "(a word may be someone's/something's name, not its literal meaning) and to " +
    "stay consistent with earlier turns.";
  if (context) block += `\n\nTOPIC / CONTEXT:\n${context}`;
  if (recent.length) {
    const lines = recent
      .map((t) => `- (${t.sourceLang}) "${t.transcript}" => "${t.translation}"`)
      .join("\n");
    block += `\n\nRECENT TURNS (oldest first):\n${lines}`;
  }
  return block;
}

export async function POST(req: NextRequest) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    let result: GeminiResult;
    let mode: "audio" | "text";
    let threadId = "";
    let audioBuf: Buffer | null = null;
    let audioMime = "audio/wav";
    let userText = "";

    if (contentType.includes("multipart/form-data")) {
      mode = "audio";
      const form = await req.formData();
      const file = form.get("audio");
      threadId = String(form.get("threadId") || "");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "no audio" }, { status: 400 });
      }
      audioBuf = Buffer.from(await file.arrayBuffer());
      audioMime = file.type || "audio/wav";
    } else {
      mode = "text";
      const body = await req.json();
      userText = typeof body.text === "string" ? body.text.trim() : "";
      threadId = typeof body.threadId === "string" ? body.threadId : "";
      if (!userText) {
        return NextResponse.json({ error: "no text" }, { status: 400 });
      }
    }

    if (!threadId) {
      return NextResponse.json({ error: "no threadId" }, { status: 400 });
    }

    const thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread || thread.ownerKey !== owner) {
      return NextResponse.json({ error: "thread not found" }, { status: 404 });
    }

    // last 6 turns, oldest first, for conversational consistency
    const recent = (
      await prisma.translation.findMany({
        where: { threadId },
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

    const ctx = contextBlock(thread.context, recent);

    if (mode === "audio" && audioBuf) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: AUDIO_PROMPT + ctx },
              { inlineData: { mimeType: audioMime, data: audioBuf.toString("base64") } },
            ],
          },
        ],
        config: genConfig,
      });
      result = JSON.parse(response.text ?? "{}");
    } else {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { role: "user", parts: [{ text: `${TEXT_PROMPT}${ctx}\n\nTEXT:\n${userText}` }] },
        ],
        config: genConfig,
      });
      result = JSON.parse(response.text ?? "{}");
    }

    if (!result.translation) {
      return NextResponse.json({ error: "Не удалось распознать" }, { status: 422 });
    }

    const row = await prisma.translation.create({
      data: {
        threadId,
        mode,
        sourceLang: result.source_lang,
        transcript: result.transcript,
        translation: result.translation,
      },
    });

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
