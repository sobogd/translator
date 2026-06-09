import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await params;
    const thread = await prisma.thread.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!thread || thread.ownerKey !== owner) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(thread);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await params;
    const thread = await prisma.thread.findUnique({ where: { id } });
    if (!thread || thread.ownerKey !== owner) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.thread.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
