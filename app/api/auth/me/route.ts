import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isOwner } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json(
    { user, isOwner: isOwner(user.id) },
    { status: 200 },
  );
}
