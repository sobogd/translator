import { GoogleGenAI, Type } from "@google/genai";
import { Language } from "./languages";

export const MODEL = "gemini-2.5-flash"; // fast + ~10-20x cheaper; thinking disabled below

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function langLabel(lang: Language): string {
  return `${lang.nameNative} (${lang.nameRu})`;
}

export function textPrompt(langA: Language, langB: Language): string {
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

export function buildGenConfig(langA: Language, langB: Language) {
  return {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: buildResponseSchema(langA, langB),
    thinkingConfig: { thinkingBudget: 0 },
  };
}

export type GeminiResult = {
  source_lang: string;
  transcript: string;
  translation: string;
};

export type RecentTurn = { sourceLang: string; transcript: string; translation: string };

// Recent turns so the model disambiguates names/domain terms and stays
// consistent across a chat (e.g. "Foxy" is an animal's name, not "лиса").
export function contextBlock(recent: RecentTurn[]): string {
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

export async function translateText(
  langA: Language,
  langB: Language,
  text: string,
  recent: RecentTurn[] = [],
): Promise<GeminiResult> {
  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `${textPrompt(langA, langB)}${contextBlock(recent)}\n\nTEXT:\n${text}` }],
      },
    ],
    config: buildGenConfig(langA, langB),
  });
  return JSON.parse(response.text ?? "{}");
}

export async function translateAudio(
  langA: Language,
  langB: Language,
  audioBuf: Buffer,
  audioMime: string,
  recent: RecentTurn[] = [],
): Promise<GeminiResult> {
  const audioPrompt = `You are a professional interpreter between ${langLabel(langA)} and ${langLabel(langB)}.
The audio contains speech in either ${langLabel(langA)} or ${langLabel(langB)}.
1. Detect the spoken language (${langA.code} or ${langB.code}).
2. Transcribe the speech accurately (correct punctuation, no filler).
3. Translate it into the OTHER language:
   - if source is ${langLabel(langA)} -> translate to ${langLabel(langB)} (natural, fluent)
   - if source is ${langLabel(langB)} -> translate to ${langLabel(langA)} (natural, fluent)
Keep meaning, tone and register. Produce a high-quality, idiomatic translation,
not a literal word-for-word one. If audio is empty or unintelligible, return empty strings.`;
  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: audioPrompt + contextBlock(recent) },
          { inlineData: { mimeType: audioMime, data: audioBuf.toString("base64") } },
        ],
      },
    ],
    config: buildGenConfig(langA, langB),
  });
  return JSON.parse(response.text ?? "{}");
}
