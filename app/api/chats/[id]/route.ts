import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await params;
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!chat || chat.ownerKey !== identity.ownerKey) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(chat);
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
    const identity = await resolveIdentity(req);
    if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await params;
    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat || chat.ownerKey !== identity.ownerKey) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.chat.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
