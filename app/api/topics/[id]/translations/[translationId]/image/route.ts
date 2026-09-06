import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { readTranslatedImage } from "@/lib/translated-image";

export const runtime = "nodejs";

// Serves the composed translation image of one chat turn. Auth is the same
// as the topic routes: whoever owns the topic may load its images, so the
// <img> in the chat history just works with the session/anonymous cookie.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; translationId: string }> },
) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id, translationId } = await params;
    const translation = await prisma.translation.findUnique({ where: { id: translationId } });
    if (!translation || translation.topicId !== id || !translation.imageUrl) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const topic = await prisma.topic.findUnique({ where: { id } });
    if (!topic || topic.ownerKey !== identity.ownerKey) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const buf = await readTranslatedImage(id, translationId);
    if (!buf) return NextResponse.json({ error: "not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    console.error("[translated image] request failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
