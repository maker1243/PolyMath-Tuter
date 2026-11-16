import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  listUserFeedback,
  userFeedbackStats,
} from "@/lib/ai-feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/feedback → 로그인 사용자의 AI 피드백 집계 + 최근 10개
 */
export async function GET() {
  const me = currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  return NextResponse.json({
    stats: userFeedbackStats(me.id),
    recent: listUserFeedback(me.id, { limit: 10 }),
  });
}
