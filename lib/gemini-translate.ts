import { GoogleGenAI, Type } from "@google/genai";
import { Language, LANGUAGES, getLanguage } from "./languages";

// 2.5 Flash retires 2026-10-16 — 3.5 Flash-Lite is the same $0.30/$2.50 per
// 1M token price point, so FREE_TRIAL's cost math doesn't need to change.
export const MODEL = "gemini-3.5-flash-lite";

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

// The recent-turns block is resent with every request and is not charged to
// anyone's quota — only the new message is. Six turns of a 100 000-character
// PRO message would therefore put 600 000 uncharged characters into the
// prompt. Cap the block and keep the newest turns, which are the ones that
// actually carry the naming/consistency context.
const CONTEXT_MAX_CHARS = 2000;

// Output is not charged either, and the schema constrains the SHAPE of the
// answer, not its length: text that talks the model into producing as much as
// it can (the input is attacker-supplied by definition here) is billed to us at
// the output rate. Budget it from the input instead, generously enough that a
// real translation plus its echoed transcript always fits: ~1 token per
// character in the worst script, times two for transcript + translation, plus
// slack for the JSON envelope.
const MAX_OUTPUT_TOKENS = 65536;
const MIN_OUTPUT_TOKENS = 2048;
/** Fixed budget for speech-to-text: a minute of speech is ~150 words. */
const TRANSCRIBE_OUTPUT_TOKENS = 8192;

function outputBudget(inputChars: number): number {
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.ceil(inputChars * 3) + 1024));
}

// Recent turns so the model disambiguates names/domain terms and stays
// consistent across a topic (e.g. "Foxy" is an animal's name, not "лиса").
export function contextBlock(recent: RecentTurn[]): string {
  if (recent.length === 0) return "";
  // Newest first while budgeting, oldest first in the prompt.
  const kept: string[] = [];
  let budget = CONTEXT_MAX_CHARS;
  for (let i = recent.length - 1; i >= 0; i--) {
    const t = recent[i];
    const line = `- (${t.sourceLang}) "${t.transcript}" => "${t.translation}"`;
    if (line.length > budget) break;
    budget -= line.length;
    kept.unshift(line);
  }
  if (kept.length === 0) return "";
  const lines = kept.join("\n");
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

function genConfig(schema: object, maxOutputTokens: number) {
  return {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: schema,
    maxOutputTokens,
    // 2.5 Flash let thinkingBudget:0 turn thinking off entirely; 3.5
    // Flash-Lite 400s on that (INVALID_ARGUMENT) — its default thinkingLevel
    // is already "minimal", which is what we want anyway, so just omit it.
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
    config: genConfig(sourceLang ? fixedSchema() : detectSchema(), outputBudget(text.length)),
  });
  const parsed = JSON.parse(response.text ?? "{}");
  return {
    source_lang: sourceLang ? sourceLang.code : parsed.source_lang,
    transcript: parsed.transcript ?? "",
    translation: parsed.translation ?? "",
  };
}

// Once a topic's two-person pair is locked (see the schema comment on
// Topic.sourceLang and the /api/translate route), every later message can
// come from either side — translating it always toward the topic's fixed
// targetLang would mangle a reply written in that same targetLang. Detects
// which of the two known languages the text is in and translates to the
// other one, so either person can type in their own language turn by turn.
function pairSchema(langA: Language, langB: Language) {
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

export async function translatePair(
  langA: Language,
  langB: Language,
  text: string,
  recent: RecentTurn[] = [],
): Promise<GeminiResult> {
  const prompt = `You are interpreting a two-person conversation. One person writes in ${langLabel(langA)}, the other in ${langLabel(langB)} — every message is in exactly one of these two languages, never a third.
1. Detect which of the two the text is in (source_lang: "${langA.code}" or "${langB.code}").
2. Echo the input back as the transcript (correct obvious typos/punctuation, no filler).
3. Translate it into the OTHER language of the pair — natural, fluent, idiomatic, not literal.
Keep meaning, tone and register. If the text is empty, return empty strings.`;

  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [{ text: `${prompt}${contextBlock(recent)}\n\nTEXT:\n${text}` }] },
    ],
    config: genConfig(pairSchema(langA, langB), outputBudget(text.length)),
  });
  const parsed = JSON.parse(response.text ?? "{}");
  const source_lang = parsed.source_lang === langB.code ? langB.code : langA.code;
  return {
    source_lang,
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
    config: genConfig(schema, TRANSCRIBE_OUTPUT_TOKENS),
  });
  const parsed = JSON.parse(response.text ?? "{}");
  const detected = sourceLang ? sourceLang.code : parsed.source_lang;
  return {
    source_lang: getLanguage(detected) ? detected : sourceLang?.code ?? "en",
    transcript: parsed.transcript ?? "",
  };
}
