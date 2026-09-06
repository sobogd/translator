// Typed client for the translator-ocr sidecar (services/ocr, its own PM2
// process on 127.0.0.1). Raw image bytes in, text lines + pixel geometry out.
// The sidecar downscales internally (OCR_MAX_SIDE) and returns boxes in the
// *processed* image's pixel space together with its width/height — callers
// normalize by those dimensions, so the original file size never matters.

export type OcrBox = [number, number, number, number]; // x0 y0 x1 y1 (px, processed space)
export type OcrPolygon = [number, number][]; // 4 corner points (px, processed space)

export type OcrBlock = {
  text: string;
  confidence: number;
  polygon: OcrPolygon;
  box: OcrBox;
};

export type OcrImageResult = {
  width: number; // processed width the coordinates refer to
  height: number;
  recLang: string;
  elapseS: number;
  blocks: OcrBlock[];
};

/** Sidecar unreachable or answered non-2xx. status: its HTTP status or 0. */
export class OcrError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "OcrError";
  }
}

const OCR_SIDECAR_URL = process.env.OCR_SIDECAR_URL ?? "http://127.0.0.1:8701";
const OCR_TIMEOUT_MS = 30_000;

export async function ocrImage(buf: Buffer, mime: string, recLang?: string): Promise<OcrImageResult> {
  const url = new URL(`${OCR_SIDECAR_URL}/ocr`);
  if (recLang) url.searchParams.set("rec_lang", recLang);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": mime, "content-length": String(buf.length) },
      body: buf as unknown as BodyInit,
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new OcrError(
      `ocr sidecar ${timedOut ? "timed out" : "unreachable"}: ${String(err)}`,
      0,
      timedOut ? "ocr_timeout" : "ocr_unavailable",
    );
  }

  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (typeof body.detail === "string") code = body.detail;
    } catch {
      // non-JSON error body — keep the generic code
    }
    throw new OcrError(`ocr sidecar error ${res.status}`, res.status, code);
  }

  const data = (await res.json().catch(() => null)) as OcrImageResult | null;
  if (!data || !Array.isArray(data.blocks) || typeof data.width !== "number" || typeof data.height !== "number") {
    throw new OcrError("ocr sidecar returned a malformed payload", 0, "ocr_bad_response");
  }
  return data;
}
