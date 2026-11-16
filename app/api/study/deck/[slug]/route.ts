import { NextResponse } from "next/server";
import { copyDeckToUser, getPublicDeck } from "@/lib/study-store";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 공개 덱 조회 — 로그인 불필요 */
export async function GET(
  _req: Request,
  { params: paramsP }: { params: Promise<{ slug: string }> },
) {
  const params = await paramsP;
  const deck = getPublicDeck(params.slug);
  if (!deck) {
    return NextResponse.json({ error: "덱 없음" }, { status: 404 });
  }
  return NextResponse.json({ deck });
}

/** 공개 덱을 내 덱으로 복제 — 로그인 필요 */
export async function POST(
  _req: Request,
  { params: paramsP }: { params: Promise<{ slug: string }> },
) {
  const params = await paramsP;
  const me = await currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const r = copyDeckToUser(params.slug, me.id);
  if (!r) {
    return NextResponse.json({ error: "덱 없음" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...r });
}
