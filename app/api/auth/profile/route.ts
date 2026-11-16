import { NextResponse } from "next/server";
import { updateDisplayName, publicUser } from "@/lib/auth-store";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  displayName?: string;
}

// 디스플레이 이름 변경 — 간단히 users.json 를 직접 수정
export async function PATCH(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  const body = (await req.json()) as Body;
  const name = (body.displayName ?? "").trim().slice(0, 40);
  if (!name) {
    return NextResponse.json(
      { error: "표시 이름은 비울 수 없습니다" },
      { status: 400 },
    );
  }
  const user = updateDisplayName(me.id, name);
  if (!user) return NextResponse.json({ error: "사용자 없음" }, { status: 404 });
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
