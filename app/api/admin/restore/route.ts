import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { importAll, isOwner, type AuthBackup } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  backup: AuthBackup;
  mode?: "merge" | "replace";
}

/** 오너 전용. 백업 JSON 을 업로드해서 users/sessions 를 복원. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  // 복원은 "아직 아무도 없는 상태" 를 포함해서 "현재 오너" 가 하는 경우만 허용.
  // 만약 users 가 비어있다면 어떤 로그인 사용자도 올 수 없으므로 자동으로 통과.
  // 이미 유저가 있다면 isOwner 로 제한.
  if (!isOwner(me.id)) {
    return NextResponse.json(
      { error: "오너(최초 가입자) 만 복원할 수 있습니다" },
      { status: 403 },
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "잘못된 JSON 본문" },
      { status: 400 },
    );
  }
  if (!body?.backup || body.backup.version !== 1) {
    return NextResponse.json(
      { error: "지원하지 않는 백업 형식 (version !== 1)" },
      { status: 400 },
    );
  }
  const mode = body.mode === "replace" ? "replace" : "merge";
  try {
    const result = importAll(body.backup, mode);
    return NextResponse.json({ ok: true, mode, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
