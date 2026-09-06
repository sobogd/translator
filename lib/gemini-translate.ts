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

// ---------------------------------------------------------------------------
// Image translation: OCR already split the photo into text blocks with boxes
// (lib/image-ocr.ts -> translator-ocr sidecar). The model only sees the text
// — numbered segments in, an aligned array of translations out. No image
// tokens, no coordinate guessing: geometry stays with the OCR layer.
// ---------------------------------------------------------------------------

// Blocks come back keyed by their own id (1-based, as sent), never by array
// position: the model occasionally skips a segment, and with a plain array a
// skipped entry silently shifts every later translation onto the wrong box.
function imageBlocksSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      blocks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            translation: { type: Type.STRING },
          },
          required: ["id", "translation"],
        },
      },
    },
    required: ["blocks"],
  };
}

// How many segments fit in one request. Flash-Lite started dropping entries on
// ~30-segment payloads; chunking to a quarter of that makes drops rare, and
// any survivor is asked again in the next round.
const IMAGE_BLOCK_CHUNK = 15;
const IMAGE_BLOCK_ROUNDS = 2;

async function translateSegmentBatch(
  targetLang: Language,
  sourceLang: Language | null | undefined,
  segments: { id: number; text: string }[],
): Promise<Map<number, string>> {
  const fromClause = sourceLang ? ` The segments are written in ${langLabel(sourceLang)}.` : "";
  const prompt = `You are a professional interpreter translating text found in a photo into ${langLabel(targetLang)}.${fromClause}
Below is a numbered list of text segments from that photo, one per line: [id] text.
Translate EVERY segment into ${langLabel(targetLang)} — natural, fluent, idiomatic, not literal; keep meaning, tone and register.
Return a JSON object with a single "blocks" array. For each segment you translated add one object {"id": <the segment's id>, "translation": "<translation>"}.
Never merge segments and never invent ids: only ids from the list above. Do not echo the source text, do not add notes.`;

  const numbered = segments.map((s) => `[${s.id}] ${s.text}`).join("\n");
  const chars = segments.reduce((n, s) => n + s.text.length, 0);
  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nSEGMENTS:\n${numbered}` }] }],
    config: genConfig(imageBlocksSchema(), outputBudget(chars)),
  });
  const parsed = JSON.parse(response.text ?? "{}") as { blocks?: { id?: unknown; translation?: unknown }[] };
  const out = new Map<number, string>();
  for (const b of Array.isArray(parsed.blocks) ? parsed.blocks : []) {
    if (typeof b.id === "number" && Number.isInteger(b.id)) {
      const translation = typeof b.translation === "string" ? b.translation.trim() : "";
      if (translation) out.set(b.id, translation);
    }
  }
  return out;
}

/**
 * Translate every block text. Resolves with exactly as many entries as
 * `texts`, index-aligned (a missing translation is an empty string, never a
 * shifted one): segments are sent in small id-keyed batches and any the model
 * skipped are requested again, so one dropped entry does not fail the photo.
 */
export async function translateImageBlocks(
  targetLang: Language,
  texts: string[],
  sourceLang?: Language | null,
): Promise<string[]> {
  const clean: string[] = [];
  for (const t of texts) {
    const trimmed = t.trim();
    if (trimmed) clean.push(trimmed);
  }
  if (clean.length === 0) return [];

  const result: string[] = new Array(clean.length).fill("");
  const missing = new Set<number>(clean.map((_, i) => i + 1)); // 1-based ids

  for (let round = 0; round < IMAGE_BLOCK_ROUNDS && missing.size > 0; round++) {
    const ids = [...missing];
    for (let from = 0; from < ids.length; from += IMAGE_BLOCK_CHUNK) {
      const chunk = ids.slice(from, from + IMAGE_BLOCK_CHUNK);
      const segments = chunk.map((id) => ({ id, text: clean[id - 1] }));
      const got = await translateSegmentBatch(targetLang, sourceLang, segments);
      for (const id of chunk) {
        const translation = got.get(id);
        if (translation !== undefined) {
          result[id - 1] = translation;
          missing.delete(id);
        }
      }
    }
  }

  if (missing.size > 0) {
    console.warn(`[translate-image] ${missing.size} block(s) left untranslated after retries: ${[...missing].join(",")}`);
  }
  return result;
}

// A photo's first turn on a fresh topic has no locked source language, but
// the topic/translation rows need one. One tiny text-only call answers just
// that — no translation, no image tokens. Returns an ISO 639-1 code or null
// when the model can't tell.
export async function detectImageTextLanguage(texts: string[]): Promise<string | null> {
  const sample = texts
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
  if (!sample) return null;

  const prompt = `Detect the language of the text below. It is a list of text pieces found in one photo, usually all in the same language.
Answer with a JSON object {"source_lang": "ISO 639-1 code"} choosing ONLY from: ${LANGUAGES.map((l) => l.code).join(", ")}.
If the text is empty, gibberish or mixed beyond one dominant language, return "".`;
  const schema = {
    type: Type.OBJECT,
    properties: { source_lang: { type: Type.STRING } },
    required: ["source_lang"],
  };

  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nTEXT:\n${sample}` }] }],
    config: genConfig(schema, 2048),
  });
  const parsed = JSON.parse(response.text ?? "{}") as { source_lang?: unknown };
  const code = typeof parsed.source_lang === "string" ? parsed.source_lang.trim().toLowerCase() : "";
  return code ? code : null;
}
