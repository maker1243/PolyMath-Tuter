import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import { addFile } from "@/lib/collab-store";
import { FILES_DIR } from "@/lib/collab-persist";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "multipart/form-data 필요" },
      { status: 400 },
    );
  }
  const pid = String(form.get("pid") ?? "").slice(0, 64);
  const file = form.get("file");
  if (!pid || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "pid·file 필수" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `파일 용량 초과 (최대 ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }
  const originalName = ((file as File).name ?? "파일").slice(0, 200);
  const contentType = file.type || "application/octet-stream";
  const buf = Buffer.from(await file.arrayBuffer());

  // 저장 경로 — 디렉토리당 roomId
  const roomDir = join(FILES_DIR, params.roomId);
  mkdirSync(roomDir, { recursive: true });
  const ext = extname(originalName).slice(0, 20);
  const storedName = `${Date.now()}-${randomUUID()}${ext}`;
  const absPath = join(roomDir, storedName);
  writeFileSync(absPath, buf);

  const me = await currentUser();
  if (me) {
    logActivity({
      userId: me.id,
      type: "file_upload",
      roomId: params.roomId,
      meta: { name: originalName, size: buf.length },
    });
  }
  const stored = addFile(params.roomId, {
    pid,
    name: originalName,
    size: buf.length,
    contentType,
    storedPath: join(params.roomId, storedName), // FILES_DIR 상대 경로
  });

  return NextResponse.json({ ok: true, file: stored });
}
