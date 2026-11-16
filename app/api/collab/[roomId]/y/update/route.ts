import { NextResponse } from "next/server";
import { applyYUpdate } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
  update: string; // base64
}

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const body = (await req.json()) as Body;
  if (!body?.pid || typeof body.update !== "string") {
    return NextResponse.json({ error: "pid·update 필수" }, { status: 400 });
  }
  const result = applyYUpdate(params.roomId, body.pid.slice(0, 64), body.update);
  return NextResponse.json(result);
}
