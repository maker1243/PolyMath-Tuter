import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  createUser,
  publicUser,
} from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
  password: string;
  displayName: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.email || !body?.password || !body?.displayName) {
    return NextResponse.json(
      { error: "email·password·displayName 필수" },
      { status: 400 },
    );
  }
  const result = createUser({
    email: body.email,
    password: body.password,
    displayName: body.displayName,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const sess = createSession(result.user.id);
  const res = NextResponse.json({ ok: true, user: publicUser(result.user) });
  res.cookies.set(SESSION_COOKIE, sess.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    // production 에서는 secure: true 가 바람직하지만 localhost 호환을 위해 생략
  });
  return res;
}
