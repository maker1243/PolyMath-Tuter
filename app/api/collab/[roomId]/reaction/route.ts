import { NextResponse } from "next/server";
import { reactToMessage } from "@/lib/collab-store";
import { recordFeedback, type FeedbackCategory } from "@/lib/ai-feedback-store";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  messageId: string;
  pid: string;
  rating: "up" | "down" | "clear";
  reason?: string;
  category?: FeedbackCategory;
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } },
) {
  const body = (await req.json()) as Body;
  if (!body?.messageId || !body?.pid || !body?.rating) {
    return NextResponse.json(
      { error: "messageId·pid·rating 필수" },
      { status: 400 },
    );
  }
  const msg = reactToMessage(params.roomId, {
    messageId: body.messageId,
    pid: body.pid.slice(0, 64),
    rating: body.rating,
  });
  if (!msg) return NextResponse.json({ error: "메시지 없음" }, { status: 404 });

  // AI 메시지에 대한 clear 아닌 평가는 영구 피드백 로그에도 기록
  if (msg.role === "ai" && (body.rating === "up" || body.rating === "down")) {
    const me = currentUser();
    // 서버에서 메시지 payload 파싱 — "_(⚡ claude · 호스트 지갑: X)_" 라벨 추출
    const providerMatch = msg.text.match(/⚡\s+(\w+)/);
    recordFeedback({
      userId: me?.id ?? null,
      pid: body.pid,
      roomId: params.roomId,
      messageId: body.messageId,
      rating: body.rating,
      reason: body.reason,
      category: body.category,
      answerPreview: msg.text.slice(0, 500),
      provider: providerMatch?.[1],
    });
  }
  return NextResponse.json({ ok: true, message: msg });
}
