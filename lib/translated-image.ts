import { promises as fs } from "node:fs";
import path from "node:path";

// Composed photo translations are stored on the app's own disk under
// var/translated/<topicId>/<translationId>.jpg — same var/ dir the analytics
// ingest spool uses (gitignored, survives deploys on the single prod box) —
// and served back by an authed API route (see app/api/topics/[id]/
// translations/[translationId]/image/route.ts). Not S3: the bucket's public
// read behaviour was never established, and these are private per-topic
// images anyway.

const ROOT = path.join(process.cwd(), "var", "translated");

// Prisma cuid's are [a-z0-9]+; enforce anyway so a topic/translation id can
// never become a path traversal.
const SAFE_ID = /^[a-z0-9]+$/i;

function fileFor(topicId: string, translationId: string): string {
  if (!SAFE_ID.test(topicId) || !SAFE_ID.test(translationId)) {
    throw new Error("unsafe id in translated-image path");
  }
  return path.join(ROOT, topicId, `${translationId}.jpg`);
}

/** Relative URL the client <img> loads; the GET route re-checks ownership. */
export function translatedImageUrl(topicId: string, translationId: string): string {
  return `/api/topics/${topicId}/translations/${translationId}/image`;
}

export async function saveTranslatedImage(
  topicId: string,
  translationId: string,
  jpeg: Buffer,
): Promise<void> {
  const file = fileFor(topicId, translationId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, jpeg);
}

export async function readTranslatedImage(topicId: string, translationId: string): Promise<Buffer | null> {
  const file = fileFor(topicId, translationId);
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}
