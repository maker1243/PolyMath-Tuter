import { NextResponse } from "next/server";
import { buildTutorSystem, generate, resolveCredentials, type ProviderId } from "@/lib/providers";
import { demoTutorReply } from "@/lib/demo-responses";

export const runtime = "nodejs";

interface Body {
  level: "beginner" | "intermediate" | "advanced";
  context?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.messages?.length) {
      return NextResponse.json({ error: "messages 필수" }, { status: 400 });
    }

    const creds = resolveCredentials(body);
    if (!creds) {
      const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
      return NextResponse.json({
        text: demoTutorReply({
          context: body.context,
          lastUserMessage: lastUser?.content ?? "",
        }),
        demo: true,
      });
    }

    const text = await generate({
      ...creds,
      system: buildTutorSystem(body.level, body.context),
      messages: body.messages,
      maxTokens: 1024,
    });
    return NextResponse.json({ text, provider: creds.provider });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
