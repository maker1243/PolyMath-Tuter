import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportAll, isOwner } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 오너(= 가장 먼저 가입한 사용자) 만 전체 users/sessions 백업을 다운받을 수 있음.
 *  반환 JSON 에는 비밀번호 해시가 포함됨 — 안전하게 보관할 것. */
export async function GET() {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  if (!isOwner(me.id)) {
    return NextResponse.json(
      { error: "오너(최초 가입자) 만 백업할 수 있습니다" },
      { status: 403 },
    );
  }
  const backup = exportAll();
  const date = new Date(backup.exportedAt);
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  const filename = `polymath-auth-backup-${stamp}.json`;
  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
