import { NextResponse } from "next/server";
import { hasClaudeKey } from "@/lib/claude";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    claude: hasClaudeKey() ? "live" : "demo",
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  });
}
