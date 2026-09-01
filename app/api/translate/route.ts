import { GoogleGenAI, Type } from "@google/genai";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3Client, s3Bucket, s3Key, getPublicUrl } from "@/lib/s3";
import { resolveOwner, isAllowed } from "@/lib/auth";
import { getLanguage, Language } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.5-flash"; // fast + ~10-20x cheaper; thinking disabled below

function langLabel(lang: Language): string {
  return `${lang.nameNative} (${lang.nameRu})`;
}

function audioPrompt(langA: Language, langB: Language): string {
  return `You are a professional interpreter between ${langLabel(langA)} and ${langLabel(langB)}.
The audio contains speech in either ${langLabel(langA)} or ${langLabel(langB)}.
1. Detect the spoken language (${langA.code} or ${langB.code}).
2. Transcribe the speech accurately (correct punctuation, no filler).
3. Translate it into the OTHER language:
   - if source is ${langLabel(langA)} -> translate to ${langLabel(langB)} (natural, fluent)
   - if source is ${langLabel(langB)} -> translate to ${langLabel(langA)} (natural, fluent)
Keep meaning, tone and register. Produce a high-quality, idiomatic translation,
not a literal word-for-word one. If audio is empty or unintelligible, return empty strings.`;
}

function textPrompt(langA: Language, langB: Language): string {
  return `You are a professional interpreter between ${langLabel(langA)} and ${langLabel(langB)}.
The user provides a text in either ${langLabel(langA)} or ${langLabel(langB)}.
1. Detect the language (${langA.code} or ${langB.code}).
2. Echo it back as the transcript (correct obvious typos/punctuation, no filler).
3. Translate it into the OTHER language:
   - if source is ${langLabel(langA)} -> translate to ${langLabel(langB)} (natural, fluent)
   - if source is ${langLabel(langB)} -> translate to ${langLabel(langA)} (natural, fluent)
Keep meaning, tone and register. Produce a high-quality, idiomatic translation,
not a literal word-for-word one. If the text is empty, return empty strings.`;
}

function buildResponseSchema(langA: Language, langB: Language) {
  return {
    type: Type.OBJECT,
    properties: {
      source_lang: { type: Type.STRING, enum: [langA.code, langB.code] },
      transcript: { type: Type.STRING },
      translation: { type: Type.STRING },
    },
    required: ["source_lang", "transcript", "translation"],
  };
}

function buildGenConfig(langA: Language, langB: Language) {
  return {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: buildResponseSchema(langA, langB),
    thinkingConfig: { thinkingBudget: 0 },
  };
}

type GeminiResult = {
  source_lang: string;
  transcript: string;
  translation: string;
};

type RecentTurn = { sourceLang: string; transcript: string; translation: string };

// Recent turns so the model disambiguates names/domain terms and stays
// consistent across a chat (e.g. "Foxy" is an animal's name, not "лиса").
function contextBlock(recent: RecentTurn[]): string {
  if (recent.length === 0) return "";
  const lines = recent
    .map((t) => `- (${t.sourceLang}) "${t.transcript}" => "${t.translation}"`)
    .join("\n");
  return (
    "\n\nThis is part of an ongoing translation conversation. Use the RECENT TURNS " +
    "below to disambiguate proper names, domain terms and entities (a word may be " +
    "someone's/something's name, not its literal meaning) and to stay consistent " +
    `with earlier turns.\n\nRECENT TURNS (oldest first):\n${lines}`
  );
}

export async function POST(req: NextRequest) {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isAllowed(owner)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const contentType = req.headers.get("content-type") || "";
    let result: GeminiResult;
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
    if (!chat || chat.ownerKey !== owner) {
      return NextResponse.json({ error: "chat not found" }, { status: 404 });
    }

    const langA = getLanguage(chat.langA);
    const langB = getLanguage(chat.langB);
    if (!langA || !langB) {
      return NextResponse.json({ error: "unknown chat languages" }, { status: 500 });
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

    const ctx = contextBlock(recent);
    const genConfig = buildGenConfig(langA, langB);

    if (mode === "audio" && audioBuf) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: audioPrompt(langA, langB) + ctx },
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
          {
            role: "user",
            parts: [{ text: `${textPrompt(langA, langB)}${ctx}\n\nTEXT:\n${userText}` }],
          },
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
