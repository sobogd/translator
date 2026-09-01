import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getLanguage } from "@/lib/languages";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const topics = await prisma.topic.findMany({
      where: { ownerKey: identity.ownerKey },
      orderBy: { lastUsedAt: "desc" },
      include: { _count: { select: { translations: true } } },
    });
    const result = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      sourceLang: topic.sourceLang,
      targetLang: topic.targetLang,
      lastUsedAt: topic.lastUsedAt,
      createdAt: topic.createdAt,
      translationCount: topic._count.translations,
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Always creates a new topic — topics are independent sessions, not keyed
// by language pair.
export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
    if (!getLanguage(targetLang)) {
      return NextResponse.json({ error: "unknown language" }, { status: 400 });
    }

    const topic = await prisma.topic.create({
      data: { ownerKey: identity.ownerKey, targetLang },
    });

    return NextResponse.json(topic);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
