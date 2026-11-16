import { NextResponse } from "next/server";
import { postTyping, type TypingKind } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
  name: string;
  color: string;
  kind: TypingKind;
}

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const body = (await req.json()) as Body;
  if (!body?.pid || (body.kind !== "chat" && body.kind !== "code")) {
    return NextResponse.json({ error: "pid·kind 필수" }, { status: 400 });
  }
  postTyping(params.roomId, {
    pid: body.pid.slice(0, 64),
    name: (body.name ?? "익명").slice(0, 24),
    color: (body.color ?? "bg-brand-500").slice(0, 40),
    kind: body.kind,
  });
  return NextResponse.json({ ok: true });
}
