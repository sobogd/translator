import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner, isAllowed } from "@/lib/auth";
import { getLanguage } from "@/lib/languages";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isAllowed(owner)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const chats = await prisma.chat.findMany({
      where: { ownerKey: owner },
      orderBy: { lastUsedAt: "desc" },
      include: { _count: { select: { translations: true } } },
    });
    const result = chats.map((chat) => ({
      id: chat.id,
      langA: chat.langA,
      langB: chat.langB,
      lastUsedAt: chat.lastUsedAt,
      createdAt: chat.createdAt,
      translationCount: chat._count.translations,
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isAllowed(owner)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";

    if (!getLanguage(from) || !getLanguage(to)) {
      return NextResponse.json({ error: "unknown language" }, { status: 400 });
    }
    if (from === to) {
      return NextResponse.json({ error: "languages must differ" }, { status: 400 });
    }

    const [langA, langB] = from < to ? [from, to] : [to, from];

    const chat = await prisma.chat.upsert({
      where: { ownerKey_langA_langB: { ownerKey: owner, langA, langB } },
      update: {},
      create: { ownerKey: owner, langA, langB },
    });

    return NextResponse.json(chat);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
