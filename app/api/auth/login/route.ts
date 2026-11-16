import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  publicUser,
  verifyPassword,
} from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
  password: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "email·password 필수" }, { status: 400 });
  }
  const user = verifyPassword(body.email, body.password);
  if (!user) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다" },
      { status: 401 },
    );
  }
  const sess = createSession(user.id);
  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, sess.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
