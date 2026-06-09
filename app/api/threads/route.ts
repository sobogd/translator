import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const threads = await prisma.thread.findMany({
      where: { ownerKey: owner },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { translations: true } } },
    });
    return NextResponse.json(threads);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "no title" }, { status: 400 });
    }
    const thread = await prisma.thread.create({
      data: { title, context, ownerKey: owner },
    });
    return NextResponse.json(thread);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
