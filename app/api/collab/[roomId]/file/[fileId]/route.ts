import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFile } from "@/lib/collab-store";
import { FILES_DIR } from "@/lib/collab-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string; fileId: string }> },
) {
  const params = await paramsP;
  const file = getFile(params.roomId, params.fileId);
  if (!file) {
    return new Response("not found", { status: 404 });
  }
  let buf: Buffer;
  try {
    buf = readFileSync(join(FILES_DIR, file.storedPath));
  } catch {
    return new Response("stored file missing", { status: 410 });
  }
  // ASCII 가 아닌 파일명을 안전하게 encode
  const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(file.name);
  // Convert Buffer to Uint8Array to satisfy BodyInit typing on Response
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
