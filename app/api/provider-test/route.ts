import { NextResponse } from "next/server";
import {
  generate,
  PROVIDERS,
  type GeminiAuthMode,
  type ProviderId,
} from "@/lib/providers";

export const runtime = "nodejs";

interface Body {
  provider: ProviderId;
  apiKey: string;
  model?: string;
  geminiAuth?: GeminiAuthMode;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.apiKey?.trim()) {
      return NextResponse.json({ ok: false, error: "apiKey 필수" }, { status: 400 });
    }
    if (!(body.provider in PROVIDERS)) {
      return NextResponse.json(
        { ok: false, error: `알 수 없는 provider: ${body.provider}` },
        { status: 400 },
      );
    }

    const text = await generate({
      provider: body.provider,
      apiKey: body.apiKey.trim(),
      model: body.model,
      geminiAuth: body.geminiAuth,
      system: "You are a terse health check. Reply with exactly: OK",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 20,
    });

    return NextResponse.json({ ok: true, sample: text.slice(0, 120).trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
