import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logActivity, type ActivityType } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 신뢰 가능한 클라이언트 트리거용 (예: /quiz 완료). 서버 route 안에서 자동으로
 *  logActivity 하는 쪽이 우선, 이 라우트는 그 외 지점의 생명선. */
interface Body {
  type: ActivityType;
  meta?: Record<string, unknown>;
  roomId?: string;
}

// 허용된 타입만 — 임의 type 조작 방지
const ALLOWED: ActivityType[] = [
  "tutor_ask",
  "card_review",
  "card_created",
  "source_added",
  "quiz_completed",
  "math_drill",
  "vocab_drill",
  "hanja_drill",
  "typing_drill",
  "history_quiz",
];

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as Body;
  if (!body?.type || !ALLOWED.includes(body.type)) {
    return NextResponse.json(
      { error: "허용되지 않은 타입" },
      { status: 400 },
    );
  }
  logActivity({
    userId: me.id,
    type: body.type,
    meta: body.meta,
    roomId: body.roomId,
  });
  return NextResponse.json({ ok: true });
}
