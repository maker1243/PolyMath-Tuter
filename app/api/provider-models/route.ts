import { NextResponse } from "next/server";
import {
  geminiAuthKind,
  type GeminiAuthMode,
  type ProviderId,
} from "@/lib/providers";

export const runtime = "nodejs";

interface Body {
  provider: ProviderId;
  apiKey: string;
  geminiAuth?: GeminiAuthMode;
}

interface ModelOut {
  id: string;
  label: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.apiKey?.trim()) {
      return NextResponse.json({ error: "apiKey 필수" }, { status: 400 });
    }

    const apiKey = body.apiKey.trim();
    let models: ModelOut[] = [];

    if (body.provider === "gemini") {
      models = await listGeminiModels(apiKey, body.geminiAuth);
    } else if (body.provider === "groq") {
      models = await listGroqModels(apiKey);
    } else if (body.provider === "claude") {
      models = await listClaudeModels(apiKey);
    } else {
      return NextResponse.json({ error: "알 수 없는 provider" }, { status: 400 });
    }

    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function listGeminiModels(
  apiKey: string,
  authMode: GeminiAuthMode = "auto",
): Promise<ModelOut[]> {
  const tryMode = async (mode: "key" | "bearer") => {
    const params = new URLSearchParams({ pageSize: "200" });
    const headers: HeadersInit = {};
    if (mode === "bearer") headers.Authorization = `Bearer ${apiKey}`;
    else params.set("key", apiKey);
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?${params.toString()}`,
      { headers },
    );
  };

  const forced = authMode !== "auto" ? authMode : null;
  const primary: "key" | "bearer" = forced ?? geminiAuthKind(apiKey);
  let res = await tryMode(primary);
  if (!res.ok && !forced && (res.status === 401 || res.status === 403)) {
    const secondary = primary === "key" ? "bearer" : "key";
    res = await tryMode(secondary);
  }
  if (!res.ok) throw new Error(`Gemini models: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  const items = data.models ?? [];
  return items
    .filter(
      (m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent") ||
        (m.supportedGenerationMethods ?? []).includes("streamGenerateContent"),
    )
    .map((m) => {
      const id = (m.name ?? "").replace(/^models\//, "");
      return { id, label: m.displayName ? `${m.displayName} · ${id}` : id };
    })
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listGroqModels(apiKey: string): Promise<ModelOut[]> {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      msg = parsed.error?.message ?? raw;
    } catch {
      /* keep raw */
    }
    if (res.status === 401) {
      throw new Error(
        `Groq 인증 실패 (401): API 키가 유효하지 않습니다. \`gsk_\` 로 시작하는 키를 https://console.groq.com/keys 에서 발급받아 주세요. (원문: ${msg})`,
      );
    }
    throw new Error(`Groq models: ${res.status} ${msg}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  };
  return (data.data ?? [])
    .map((m) => ({
      id: m.id ?? "",
      label: m.owned_by ? `${m.id} · ${m.owned_by}` : m.id ?? "",
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listClaudeModels(apiKey: string): Promise<ModelOut[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Claude models: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id?: string; display_name?: string }>;
  };
  return (data.data ?? [])
    .map((m) => ({
      id: m.id ?? "",
      label: m.display_name ? `${m.display_name} · ${m.id}` : m.id ?? "",
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}
