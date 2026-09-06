import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { hasValidPass, requiresTurnstile } from "@/lib/turnstile";
import { getLanguage } from "@/lib/languages";
import { chargeChars, refundChars } from "@/lib/credits";
import { allowRequest } from "@/lib/rate-limit";
import { ocrImage, OcrError } from "@/lib/image-ocr";
import {
  translateImageBlocks,
  detectImageTextLanguage,
} from "@/lib/gemini-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

// Image translation: photo in -> OCR sidecar (text + pixel boxes) -> one
// text-only Gemini call for per-block translations -> blocks with normalized
// geometry back to the client, which pastes the translated text into the
// image itself. Charged by the total length of the detected source text, the
// same currency as /api/translate — the OCR leg is free on our side.
//
// Two modes:
//  * topicId given (widget flow) — behaves like /api/translate-voice: reads
//    the pair from the topic, locks sourceLang/title on the first turn and
//    persists a translation row so the turn lands in the chat history. The
//    response still carries the block geometry for the caller.
//  * topicId absent (external-server flow) — stateless: targetLang is
//    required and the response is the blocks payload only.

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
    const topicId = String(form.get("topicId") || "");
    const targetLangCode = String(form.get("targetLang") || "");
    const sourceLangCode = String(form.get("sourceLang") || "");
    const recLang = String(form.get("recLang") || "").trim() || undefined;

    if (!(file instanceof Blob) || !file.type || !ALLOWED_MIME[file.type]) {
      return NextResponse.json({ error: "bad_image" }, { status: 400 });
    }

    // Resolve the pair. A topicId wins (its locked pair decides, exactly like
    // voice); otherwise the caller must declare targetLang (and may hint
    // sourceLang) — the stateless mode used by external renderers.
    let topic: { id: string; ownerKey: string; sourceLang: string | null; targetLang: string; title: string | null } | null = null;
    let targetLang = getLanguage(targetLangCode);
    let sourceLang: ReturnType<typeof getLanguage> | null = sourceLangCode ? getLanguage(sourceLangCode) ?? null : null;
    let lockSource = false; // first turn on a fresh topic: detect + persist source

    if (topicId) {
      topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic || topic.ownerKey !== identity.ownerKey) {
        return NextResponse.json({ error: "topic not found" }, { status: 404 });
      }
      targetLang = getLanguage(topic.targetLang);
      sourceLang = topic.sourceLang ? getLanguage(topic.sourceLang) ?? null : null;
      lockSource = !topic.sourceLang;
      if (!targetLang) {
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
    } else if (!targetLang) {
      return NextResponse.json({ error: "no targetLang" }, { status: 400 });
    }

    const imageBuf = Buffer.from(await file.arrayBuffer());
    if (imageBuf.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "image_too_large" }, { status: 413 });
    }

    const ocr = await ocrImage(imageBuf, ALLOWED_MIME[file.type], recLang);

    // Filter FIRST so texts and blocks stay index-aligned for the translation
    // pass below (the sidecar already filters by confidence).
    const kept = ocr.blocks.filter((b) => b.text.trim().length > 0);
    const texts = kept.map((b) => b.text.trim());
    if (texts.length === 0) {
      return NextResponse.json({ error: "not_recognized" }, { status: 422 });
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

    // Fresh topic, no locked source yet: identify the language once so the
    // pair locks like it does for a text/voice first message. Blocks were
    // OCR'd by a script-specific engine; the model gets the actual text.
    if (lockSource) {
      const code = await detectImageTextLanguage(texts);
      const detected = code ? getLanguage(code) : undefined;
      if (!detected) {
        await refundChars(identity, charged);
        charged = 0;
        return NextResponse.json({ error: "not_recognized" }, { status: 422 });
      }
      sourceLang = detected;
    }

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

    // Normalized 0..1 geometry against the *processed* image (width/height
    // below); the client scales to its own copy of the photo.
    const blocks = kept.map((b, i) => {
      const [x0, y0, x1, y1] = b.box;
      return {
        id: i,
        text: b.text.trim(),
        translation: translations[i] ?? "",
        confidence: b.confidence,
        polygon: b.polygon.map(([x, y]) => [x / ocr.width, y / ocr.height]),
        box: [x0 / ocr.width, y0 / ocr.height, x1 / ocr.width, y1 / ocr.height],
      };
    });

    const payload: Record<string, unknown> = {
      width: ocr.width,
      height: ocr.height,
      recLang: ocr.recLang,
      chargedChars: detectedChars,
      blocks,
    };

    if (topic) {
      // Persist one conversation turn so the image send shows up in the chat
      // history like text/voice sends do. Transcript and translation are the
      // block texts joined line-by-line, so the lines stay aligned 1:1.
      const transcript = texts.join("\n");
      const row = await prisma.translation.create({
        data: {
          topicId: topic.id,
          sourceLang: (sourceLang?.code ?? topic.sourceLang ?? "und") as string,
          transcript,
          translation: translations.join("\n"),
        },
      });
      await prisma.topic.update({
        where: { id: topic.id },
        data: {
          lastUsedAt: new Date(),
          ...(topic.sourceLang || !sourceLang ? {} : { sourceLang: sourceLang.code }),
          ...(topic.title ? {} : { title: transcript.slice(0, 40) }),
        },
      });
      payload.id = row.id;
    }

    return NextResponse.json(payload);
  } catch (err: unknown) {
    if (charged) await refundChars(identity, charged);
    if (err instanceof OcrError) {
      console.error("[translate-image] ocr failed", err.code, err.message);
      // Forward the sidecar's 4xx (bad rec_lang / oversized / unreadable
      // image); anything else means the sidecar itself is down.
      if (err.status >= 400 && err.status < 500) {
        return NextResponse.json({ error: "bad_image" }, { status: err.status });
      }
      return NextResponse.json({ error: "ocr_unavailable" }, { status: 503 });
    }
    console.error("[translate-image] failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
