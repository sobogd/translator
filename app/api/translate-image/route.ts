import { NextRequest, NextResponse } from "next/server";
import { resolveIdentity } from "@/lib/auth";
import { hasValidPass, requiresTurnstile } from "@/lib/turnstile";
import { getLanguage } from "@/lib/languages";
import { chargeChars, refundChars } from "@/lib/credits";
import { allowRequest } from "@/lib/rate-limit";
import { ocrImage, OcrError } from "@/lib/image-ocr";
import { translateImageBlocks } from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

// Image translation: photo in -> OCR sidecar (text + pixel boxes) -> one
// text-only Gemini call for per-block translations -> blocks with normalized
// geometry back to the client, which pastes the translated text into the
// image itself. Charged by the total length of the detected source text, the
// same currency as /api/translate — the OCR leg is free on our side.
//
// Unlike the conversation routes there is no Topic here: a photo is not a
// topic turn, and the response (boxes + translations) is consumed by the
// caller's image-rendering code, not by the chat history.

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // matches sidecar OCR_MAX_BYTES
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

export async function POST(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!allowRequest("translate", identity.quotaKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Anonymous traffic must carry a valid Turnstile pass before anything
  // reaches the OCR sidecar or Gemini.
  if (requiresTurnstile(identity) && !hasValidPass(req)) {
    return NextResponse.json({ error: "turnstile_required" }, { status: 403 });
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE_BYTES + 4096) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  let charged = 0;
  try {
    const form = await req.formData();
    const file = form.get("image");
    const targetLangCode = String(form.get("targetLang") || "");
    const sourceLangCode = String(form.get("sourceLang") || "");
    const recLang = String(form.get("recLang") || "").trim() || undefined;

    if (!(file instanceof Blob) || !file.type || !ALLOWED_MIME[file.type]) {
      return NextResponse.json({ error: "bad image (jpeg/png/webp only)" }, { status: 400 });
    }
    const targetLang = getLanguage(targetLangCode);
    const sourceLang = sourceLangCode ? getLanguage(sourceLangCode) ?? null : null;
    if (!targetLang || (sourceLangCode && !sourceLang)) {
      return NextResponse.json({ error: "no targetLang" }, { status: 400 });
    }

    const imageBuf = Buffer.from(await file.arrayBuffer());
    if (imageBuf.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "image_too_large" }, { status: 413 });
    }

    const ocr = await ocrImage(imageBuf, ALLOWED_MIME[file.type], recLang);

    // Keep only blocks that actually carry text (the sidecar already filters
    // by confidence) — filter FIRST so texts and blocks stay index-aligned
    // for the translation pass below.
    const kept = ocr.blocks.filter((b) => b.text.trim().length > 0);
    const texts = kept.map((b) => b.text.trim());
    if (texts.length === 0) {
      return NextResponse.json({ error: "no text found" }, { status: 422 });
    }
    const detectedChars = texts.reduce((n, t) => n + t.length, 0);

    const charge = await chargeChars(identity, detectedChars);
    if (charge === "too_long") {
      return NextResponse.json({ error: "text_too_long" }, { status: 413 });
    }
    if (charge === "insufficient") {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    charged = detectedChars;

    const translations = await translateImageBlocks(targetLang, texts, sourceLang);
    if (translations.length !== texts.length) {
      // Model returned a mismatched count — nothing was translated, refund.
      await refundChars(identity, charged);
      charged = 0;
      return NextResponse.json({ error: "not_recognized" }, { status: 422 });
    }
    if (translations.every((t) => !t)) {
      await refundChars(identity, charged);
      charged = 0;
      return NextResponse.json({ error: "not_recognized" }, { status: 422 });
    }

    // Keep geometry normalized 0..1 against the *processed* image (width/
    // height below); the client scales to its own copy of the photo.
    const blocks = kept.map((b, i) => {
      const [x0, y0, x1, y1] = b.box;
      return {
        id: i,
        text: b.text.trim(),
        translation: translations[i] ?? "",
        confidence: b.confidence,
        // [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] in box order — use for rotated text.
        polygon: b.polygon.map(([x, y]) => [x / ocr.width, y / ocr.height]),
        box: [x0 / ocr.width, y0 / ocr.height, x1 / ocr.width, y1 / ocr.height],
      };
    });

    return NextResponse.json({
      width: ocr.width,
      height: ocr.height,
      recLang: ocr.recLang,
      chargedChars: detectedChars,
      blocks,
    });
  } catch (err: unknown) {
    if (charged) await refundChars(identity, charged);
    if (err instanceof OcrError) {
      console.error("[translate-image] ocr failed", err.code, err.message);
      // Forward the sidecar's 4xx (bad rec_lang / oversized / unreadable
      // image); anything else means the sidecar itself is down.
      if (err.status >= 400 && err.status < 500) {
        return NextResponse.json({ error: "bad_image_request" }, { status: err.status });
      }
      return NextResponse.json({ error: "ocr_unavailable" }, { status: 503 });
    }
    console.error("[translate-image] failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
