import { GoogleGenAI, Type } from "@google/genai";
import { Language, LANGUAGES, getLanguage } from "./languages";

export const MODEL = "gemini-2.5-flash"; // fast + ~10-20x cheaper; thinking disabled below

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function langLabel(lang: Language): string {
  return `${lang.nameNative} (${lang.nameRu})`;
}

export type GeminiResult = {
  source_lang: string;
  transcript: string;
  translation: string;
};

export type RecentTurn = { sourceLang: string; transcript: string; translation: string };

// Recent turns so the model disambiguates names/domain terms and stays
// consistent across a topic (e.g. "Foxy" is an animal's name, not "лиса").
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

function fixedSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      transcript: { type: Type.STRING },
      translation: { type: Type.STRING },
    },
    required: ["transcript", "translation"],
  };
}

function detectSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      source_lang: { type: Type.STRING },
      transcript: { type: Type.STRING },
      translation: { type: Type.STRING },
    },
    required: ["source_lang", "transcript", "translation"],
  };
}

function genConfig(schema: object) {
  return {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: schema,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

export async function translateText(
  sourceLang: Language | null,
  targetLang: Language,
  text: string,
  recent: RecentTurn[] = [],
): Promise<GeminiResult> {
  const prompt = sourceLang
    ? `You are a professional interpreter translating from ${langLabel(sourceLang)} to ${langLabel(targetLang)}.
1. Echo the input back as the transcript (correct obvious typos/punctuation, no filler).
2. Translate it into ${langLabel(targetLang)} — natural, fluent, idiomatic, not literal.
Keep meaning, tone and register. If the text is empty, return empty strings.`
    : `You are a professional interpreter. Translate the user's text into ${langLabel(targetLang)}.
1. Detect the source language (ISO 639-1 code).
2. Echo the input back as the transcript (correct obvious typos/punctuation, no filler).
3. Translate it into ${langLabel(targetLang)} — natural, fluent, idiomatic, not literal.
Keep meaning, tone and register. If the text is empty, return empty strings.`;

  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [{ text: `${prompt}${contextBlock(recent)}\n\nTEXT:\n${text}` }] },
    ],
    config: genConfig(sourceLang ? fixedSchema() : detectSchema()),
  });
  const parsed = JSON.parse(response.text ?? "{}");
  return {
    source_lang: sourceLang ? sourceLang.code : parsed.source_lang,
    transcript: parsed.transcript ?? "",
    translation: parsed.translation ?? "",
  };
}

export type TranscribeResult = { source_lang: string; transcript: string };

export async function transcribeAudio(
  sourceLang: Language | null,
  audioBuf: Buffer,
  audioMime: string,
): Promise<TranscribeResult> {
  const prompt = sourceLang
    ? `Transcribe the speech in this audio. The speaker is using ${langLabel(sourceLang)}.
Correct obvious punctuation, no filler. If the audio is empty or unintelligible, return an empty transcript.`
    : `Transcribe the speech in this audio, in its own language (any of: ${LANGUAGES.map((l) => l.code).join(", ")}).
Detect the spoken language (ISO 639-1 code) and correct obvious punctuation, no filler.
If the audio is empty or unintelligible, return an empty transcript.`;

  const schema = sourceLang
    ? { type: Type.OBJECT, properties: { transcript: { type: Type.STRING } }, required: ["transcript"] }
    : {
        type: Type.OBJECT,
        properties: { source_lang: { type: Type.STRING }, transcript: { type: Type.STRING } },
        required: ["source_lang", "transcript"],
      };

  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType: audioMime, data: audioBuf.toString("base64") } }],
      },
    ],
    config: genConfig(schema),
  });
  const parsed = JSON.parse(response.text ?? "{}");
  const detected = sourceLang ? sourceLang.code : parsed.source_lang;
  return {
    source_lang: getLanguage(detected) ? detected : sourceLang?.code ?? "en",
    transcript: parsed.transcript ?? "",
  };
}
