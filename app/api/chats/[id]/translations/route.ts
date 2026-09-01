import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner, isAllowed } from "@/lib/auth";

export const runtime = "nodejs";

// Clear all translations of a chat (keep the chat itself).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = resolveOwner(req);
    if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isAllowed(owner)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { id } = await params;
    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat || chat.ownerKey !== owner) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.translation.deleteMany({ where: { chatId: id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
