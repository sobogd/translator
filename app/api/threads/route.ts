import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const threads = await prisma.thread.findMany({
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
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "no title" }, { status: 400 });
    }
    const thread = await prisma.thread.create({ data: { title, context } });
    return NextResponse.json(thread);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
