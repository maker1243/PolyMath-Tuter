import { joinRoom, subscribe } from "@/lib/collab-store";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const url = new URL(req.url);
  const pid = (url.searchParams.get("pid") ?? "").slice(0, 64);
  const name = (url.searchParams.get("name") ?? "익명").slice(0, 24);
  const color = (url.searchParams.get("color") ?? "bg-brand-500").slice(0, 40);

  if (!pid) {
    return new Response(JSON.stringify({ error: "pid required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  joinRoom(params.roomId, { id: pid, name, color });
  const me = await currentUser();
  if (me) {
    logActivity({ userId: me.id, type: "room_join", roomId: params.roomId });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let keepalive: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      // 서버 준비 완료 알림 (즉시 flush 되도록)
      send(JSON.stringify({ type: "ready", pid }));

      unsubscribe = subscribe(params.roomId, pid, send);

      // 프록시 타임아웃 방지용 keepalive 코멘트
      keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (keepalive) clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
