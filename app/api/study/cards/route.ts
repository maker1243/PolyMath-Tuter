import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  createCard,
  deleteCard,
  listCards,
  reviewCard,
  studyStats,
  type Rating,
} from "@/lib/study-store";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/study/cards           — 전체 카드 + stats
 * GET /api/study/cards?due=1     — 오늘 due 카드만
 * GET /api/study/cards?source=X  — 자료별
 */
export async function GET(req: Request) {
  const me = currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const url = new URL(req.url);
  const dueOnly = url.searchParams.get("due") === "1";
  const sourceId = url.searchParams.get("source") ?? undefined;
  return NextResponse.json({
    cards: listCards(me.id, { dueOnly, sourceId }),
    stats: studyStats(me.id),
  });
}

interface PostBody {
  action?: "create" | "review";
  // create
  front?: string;
  back?: string;
  sourceId?: string;
  tags?: string[];
  // review
  cardId?: string;
  rating?: Rating;
}

export async function POST(req: Request) {
  const me = currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as PostBody;
  const action = body.action ?? "create";

  if (action === "review") {
    if (!body.cardId || !body.rating) {
      return NextResponse.json(
        { error: "cardId·rating 필수" },
        { status: 400 },
      );
    }
    const card = reviewCard(me.id, body.cardId, body.rating);
    if (!card) {
      return NextResponse.json({ error: "카드 없음" }, { status: 404 });
    }
    logActivity({
      userId: me.id,
      type: "card_review",
      meta: { cardId: body.cardId, rating: body.rating, reps: card.reps },
    });
    return NextResponse.json({ ok: true, card });
  }

  // default: create
  if (!body.front?.trim() || !body.back?.trim()) {
    return NextResponse.json(
      { error: "front·back 필수" },
      { status: 400 },
    );
  }
  const card = createCard({
    userId: me.id,
    sourceId: body.sourceId,
    front: body.front,
    back: body.back,
    tags: body.tags,
  });
  if (!card) {
    return NextResponse.json(
      { error: "카드 생성 실패" },
      { status: 400 },
    );
  }
  logActivity({
    userId: me.id,
    type: "card_created",
    meta: { sourceId: body.sourceId },
  });
  return NextResponse.json({ ok: true, card });
}

export async function DELETE(req: Request) {
  const me = currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
  const ok = deleteCard(me.id, id);
  if (!ok) return NextResponse.json({ error: "카드 없음" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
