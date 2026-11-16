import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { summarizeUser } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * 통합 활동 엔드포인트.
 * - GET /api/activity           → JSON 요약 (대시보드용)
 * - GET /api/activity?format=csv → UTF-8 BOM CSV (다운로드용)
 */
export async function GET(req: Request) {
  const me = currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const summary = summarizeUser(me.id);

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  if (format === "csv") {
    const header = ["id", "type", "roomId", "meta", "at_iso", "at_ms"];
    const rows = summary.recent.map((a) => [
      a.id,
      a.type,
      a.roomId ?? "",
      a.meta ? JSON.stringify(a.meta) : "",
      new Date(a.at).toISOString(),
      String(a.at),
    ]);
    const csv = [
      header.join(","),
      ...rows.map((r) => r.map(csvEscape).join(",")),
    ].join("\n");
    const filename = `polymath-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    const body = "﻿" + csv;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ summary, user: me });
}
