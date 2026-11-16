import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  createSource,
  deleteSource,
  listSources,
  publishSource,
  unpublishSource,
  type SourceKind,
} from "@/lib/study-store";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  return NextResponse.json({ sources: listSources(me.id) });
}

interface PostBody {
  action?: "create" | "publish" | "unpublish";
  // create
  title?: string;
  content?: string;
  kind?: SourceKind;
  // publish/unpublish
  sourceId?: string;
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as PostBody;
  const action = body.action ?? "create";

  if (action === "publish") {
    if (!body.sourceId) {
      return NextResponse.json({ error: "sourceId 필수" }, { status: 400 });
    }
    const src = publishSource(me.id, body.sourceId, me.displayName);
    if (!src)
      return NextResponse.json(
        { error: "자료 없음 또는 권한 없음" },
        { status: 403 },
      );
    return NextResponse.json({
      ok: true,
      source: src,
      slug: src.publicSlug,
    });
  }
  if (action === "unpublish") {
    if (!body.sourceId) {
      return NextResponse.json({ error: "sourceId 필수" }, { status: 400 });
    }
    const src = unpublishSource(me.id, body.sourceId);
    if (!src)
      return NextResponse.json(
        { error: "자료 없음 또는 권한 없음" },
        { status: 403 },
      );
    return NextResponse.json({ ok: true, source: src });
  }

  // default: create
  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "title·content 필수" },
      { status: 400 },
    );
  }
  const src = createSource({
    userId: me.id,
    title: body.title,
    content: body.content,
    kind: body.kind ?? "note",
  });
  logActivity({
    userId: me.id,
    type: "source_added",
    meta: { kind: src.kind, length: src.content.length },
  });
  return NextResponse.json({ ok: true, source: src });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
  const ok = deleteSource(me.id, id);
  if (!ok) return NextResponse.json({ error: "자료 없음" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
