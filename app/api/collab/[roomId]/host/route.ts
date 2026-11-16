import { NextResponse } from "next/server";
import {
  deleteRoom,
  kickParticipant,
  renameRoom,
  resetCodeToInitial,
  setHostWallet,
} from "@/lib/collab-store";
import type { ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 호스트 전용 액션 통합 엔드포인트.
 * action: "kick" | "rename" | "delete" | "reset-code" | "wallet-open" | "wallet-close"
 */
interface Body {
  action:
    | "kick"
    | "rename"
    | "delete"
    | "reset-code"
    | "wallet-open"
    | "wallet-close";
  byPid: string;
  // kick
  targetPid?: string;
  // rename
  name?: string | null;
  // wallet-open
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
}

export async function POST(
  req: Request,
  { params: paramsP }: { params: Promise<{ roomId: string }> },
) {
  const params = await paramsP;
  const body = (await req.json()) as Body;
  if (!body?.byPid || !body?.action) {
    return NextResponse.json({ error: "byPid·action 필수" }, { status: 400 });
  }
  switch (body.action) {
    case "kick": {
      if (!body.targetPid) {
        return NextResponse.json({ error: "targetPid 필수" }, { status: 400 });
      }
      const r = kickParticipant(params.roomId, body.byPid, body.targetPid);
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    case "rename": {
      const r = renameRoom(
        params.roomId,
        body.byPid,
        body.name === undefined ? null : body.name,
      );
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      const r = deleteRoom(params.roomId, body.byPid);
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    case "reset-code": {
      const r = resetCodeToInitial(params.roomId, body.byPid);
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    case "wallet-open": {
      if (!body.provider || !body.apiKey) {
        return NextResponse.json(
          { error: "provider·apiKey 필수" },
          { status: 400 },
        );
      }
      const r = setHostWallet(params.roomId, body.byPid, {
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
        geminiAuth: body.geminiAuth,
      });
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    case "wallet-close": {
      const r = setHostWallet(params.roomId, body.byPid, null);
      if (!r.ok) return NextResponse.json(r, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  }
}
