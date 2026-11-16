import { NextResponse } from "next/server";
import { listRoomSummaries } from "@/lib/collab-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rooms: listRoomSummaries() });
}
