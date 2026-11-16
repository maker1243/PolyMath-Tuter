import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUserPrefs, setUserAiPrefs, type AiPrefs } from "@/lib/user-prefs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  return NextResponse.json({ prefs: getUserPrefs(me.id) });
}

export async function PUT(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as { aiSettings: AiPrefs | null };
  const next = setUserAiPrefs(me.id, body?.aiSettings ?? null);
  return NextResponse.json({ ok: true, prefs: next });
}
