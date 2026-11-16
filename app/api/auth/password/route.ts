import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  changePassword,
  createSession,
} from "@/lib/auth-store";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  oldPassword: string;
  newPassword: string;
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  const body = (await req.json()) as Body;
  if (!body?.oldPassword || !body?.newPassword) {
    return NextResponse.json(
      { error: "oldPassword·newPassword 필수" },
      { status: 400 },
    );
  }
  const r = changePassword(me.id, body.oldPassword, body.newPassword);
  if ("error" in r) {
    return NextResponse.json(r, { status: 400 });
  }
  // 모든 세션 무효화 후 새 세션 발급 → 쿠키 갱신 (지금 쓰고 있는 창은 유지)
  const sess = createSession(me.id);
  const _old = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sess.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
