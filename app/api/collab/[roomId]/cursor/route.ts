import { NextResponse } from "next/server";
import { updateCursor } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
  name: string;
  color: string;
  line: number;
  col: number;
}

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const body = (await req.json()) as Body;
  if (!body?.pid || typeof body.line !== "number" || typeof body.col !== "number") {
    return NextResponse.json({ error: "pid·line·col 필수" }, { status: 400 });
  }
  updateCursor(params.roomId, {
    pid: body.pid.slice(0, 64),
    name: (body.name ?? "익명").slice(0, 24),
    color: (body.color ?? "bg-brand-500").slice(0, 40),
    line: body.line,
    col: body.col,
  });
  return NextResponse.json({ ok: true });
}
