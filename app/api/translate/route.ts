import { GoogleGenAI, Type } from "@google/genai";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3Client, s3Bucket, s3Key, getPublicUrl } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.5-pro"; // max quality; switch to gemini-2.5-flash for speed

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

type GeminiResult = {
  source_lang: "ru" | "es";
  transcript: string;
  translation: string;
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let result: GeminiResult;
    let mode: "audio" | "text";
    let audioBuf: Buffer | null = null;
    let audioMime = "audio/wav";

    if (contentType.includes("multipart/form-data")) {
      // ---- audio path ----
      mode = "audio";
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "no audio" }, { status: 400 });
      }
      audioBuf = Buffer.from(await file.arrayBuffer());
      audioMime = file.type || "audio/wav";

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: AUDIO_PROMPT },
              { inlineData: { mimeType: audioMime, data: audioBuf.toString("base64") } },
            ],
          },
        ],
        config: { temperature: 0.2, responseMimeType: "application/json", responseSchema },
      });
      result = JSON.parse(response.text ?? "{}");
    } else {
      // ---- text path ----
      mode = "text";
      const body = await req.json();
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "no text" }, { status: 400 });
      }

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { role: "user", parts: [{ text: `${TEXT_PROMPT}\n\nTEXT:\n${text}` }] },
        ],
        config: { temperature: 0.2, responseMimeType: "application/json", responseSchema },
      });
      result = JSON.parse(response.text ?? "{}");
    }

    if (!result.translation) {
      return NextResponse.json({ error: "Не удалось распознать" }, { status: 422 });
    }

    // persist row first so we can build the audio key from its id
    const row = await prisma.translation.create({
      data: {
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
