import { NextResponse } from "next/server";
import { postRun } from "@/lib/collab-store";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
  name: string;
  color: string;
  language: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const body = (await req.json()) as Body;
  if (!body?.pid || typeof body.durationMs !== "number") {
    return NextResponse.json({ error: "pid·durationMs 필수" }, { status: 400 });
  }
  const me = await currentUser();
  if (me) {
    logActivity({
      userId: me.id,
      type: "code_run",
      roomId: params.roomId,
      meta: { ok: !(body.stderr?.trim()?.length ?? 0) },
    });
  }
  const run = postRun(params.roomId, {
    pid: body.pid.slice(0, 64),
    name: (body.name ?? "익명").slice(0, 24),
    color: (body.color ?? "bg-brand-500").slice(0, 40),
    language: body.language ?? "javascript",
    stdout: body.stdout ?? "",
    stderr: body.stderr ?? "",
    durationMs: body.durationMs,
  });
  return NextResponse.json({ ok: true, run });
}
