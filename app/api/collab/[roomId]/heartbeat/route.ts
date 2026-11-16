import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } },
) {
  const body = (await req.json()) as Body;
  if (!body?.pid) {
    return NextResponse.json({ error: "pid 필수" }, { status: 400 });
  }
  heartbeat(params.roomId, body.pid);
  return NextResponse.json({ ok: true });
}
