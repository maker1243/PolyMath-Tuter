import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";
import { deleteMessage, postMessage } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  pid: string;
  name: string;
  color: string;
  text: string;
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } },
) {
  const body = (await req.json()) as Body;
  if (!body?.pid || !body?.text?.trim()) {
    return NextResponse.json({ error: "pid 및 text 필수" }, { status: 400 });
  }
  const message = postMessage(params.roomId, {
    pid: body.pid.slice(0, 64),
    name: (body.name ?? "익명").slice(0, 24),
    color: (body.color ?? "bg-brand-500").slice(0, 40),
    text: body.text,
  });
  if (!message) {
    return NextResponse.json({ error: "빈 메시지" }, { status: 400 });
  }
  const me = currentUser();
  if (me) {
    logActivity({ userId: me.id, type: "message_sent", roomId: params.roomId });
  }
  return NextResponse.json({ ok: true, message });
}

interface DeleteBody {
  messageId: string;
  pid: string;
}

export async function DELETE(
  req: Request,
  { params }: { params: { roomId: string } },
) {
  const body = (await req.json()) as DeleteBody;
  if (!body?.messageId || !body?.pid) {
    return NextResponse.json(
      { error: "messageId·pid 필수" },
      { status: 400 },
    );
  }
  const msg = deleteMessage(params.roomId, {
    messageId: body.messageId,
    pid: body.pid.slice(0, 64),
  });
  if (!msg) {
    return NextResponse.json(
      { error: "메시지 없음 또는 삭제 권한 없음" },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, message: msg });
}
