import { SOCRATIC_TUTOR_SYSTEM, DIRECT_TUTOR_SYSTEM } from "./claude";
import Anthropic from "@anthropic-ai/sdk";

export type ProviderId = "claude" | "gemini" | "groq";

export interface ProviderModel {
  id: string;
  label: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  consoleUrl: string;
  defaultModel: string;
  models: ProviderModel[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: "claude",
    label: "Claude (Anthropic)",
    description: "Anthropic 의 Claude 5 패밀리. 소크라테스식 디버깅의 레퍼런스.",
    consoleUrl: "https://console.anthropic.com/",
    defaultModel: "claude-sonnet-5-5",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (추천)" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini (Google)",
    description: "Google 의 Gemini. 긴 컨텍스트 윈도우가 강점.",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-1.5-flash-latest",
    models: [
      { id: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash Latest (호환성 ↑)" },
      { id: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro Latest" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (실험)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-flash-latest", label: "Gemini Flash Latest" },
      { id: "gemini-pro-latest", label: "Gemini Pro Latest" },
    ],
  },
  groq: {
    id: "groq",
    label: "Groq",
    description: "오픈 모델(Llama / Gemma / GPT-OSS) 을 초고속 추론으로 서빙.",
    consoleUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (추천)" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { id: "llama-3.3-70b-specdec", label: "Llama 3.3 70B SpecDec" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B IT" },
    ],
  },
};

export type GeminiAuthMode = "auto" | "key" | "bearer";

export interface GenerationRequest {
  provider: ProviderId;
  apiKey: string;
  model?: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  geminiAuth?: GeminiAuthMode;
}

export async function generate(req: GenerationRequest): Promise<string> {
  switch (req.provider) {
    case "claude":
      return claudeGenerate(req);
    case "gemini":
      return geminiGenerate(req);
    case "groq":
      return groqGenerate(req);
  }
}

export async function* generateStream(
  req: GenerationRequest,
): AsyncGenerator<string> {
  switch (req.provider) {
    case "claude":
      yield* claudeStream(req);
      return;
    case "gemini":
      yield* geminiStream(req);
      return;
    case "groq":
      yield* groqStream(req);
      return;
  }
}

// ---------- Claude ----------

async function claudeGenerate(req: GenerationRequest): Promise<string> {
  const client = new Anthropic({ apiKey: req.apiKey });
  const res = await client.messages.create({
    model: req.model ?? PROVIDERS.claude.defaultModel,
    max_tokens: req.maxTokens ?? 1024,
    system: req.system,
    messages: req.messages,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

async function* claudeStream(req: GenerationRequest): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: req.apiKey });
  const stream = client.messages.stream({
    model: req.model ?? PROVIDERS.claude.defaultModel,
    max_tokens: req.maxTokens ?? 1024,
    system: req.system,
    messages: req.messages,
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ---------- Gemini ----------

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

function toGeminiBody(req: GenerationRequest, inlineSystem: boolean) {
  const contents: GeminiContent[] = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const base = {
    contents,
    generationConfig: { maxOutputTokens: req.maxTokens ?? 1024 },
  };

  if (inlineSystem) {
    // 구형 모델/권한 폴백: 첫 user 메시지 앞에 시스템 지시를 병합
    if (contents.length && contents[0].role === "user") {
      contents[0] = {
        role: "user",
        parts: [{ text: `${req.system}\n\n---\n\n${contents[0].parts[0].text}` }],
      };
    } else {
      contents.unshift({ role: "user", parts: [{ text: req.system }] });
    }
    return base;
  }

  return {
    ...base,
    systemInstruction: { parts: [{ text: req.system }] },
  };
}

/** 모델 ID 정규화: 사용자가 `models/foo` 로 넣어도 받아들임. */
function geminiModelId(raw: string | undefined): string {
  const id = (raw ?? PROVIDERS.gemini.defaultModel).trim();
  return id.replace(/^models\//, "");
}

/**
 * Gemini 는 두 가지 인증 방식을 지원합니다:
 *  1) API Key (AIza… 형식) → `?key=<key>` 쿼리 파라미터
 *  2) OAuth 2.0 Bearer 토큰 (AQ.Ab… / ya29. 등) → `Authorization: Bearer <token>` 헤더
 * 입력된 문자열의 형태를 보고 자동으로 적절한 방식을 고릅니다.
 */
export function geminiAuthKind(apiKey: string): "key" | "bearer" {
  const trimmed = apiKey.trim();
  if (/^AIza[A-Za-z0-9_-]{20,}$/.test(trimmed)) return "key";
  return "bearer";
}

function geminiUrlFor(
  model: string,
  method: "generateContent" | "streamGenerateContent",
  apiKey: string,
  mode: "key" | "bearer",
  extra?: Record<string, string>,
): string {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
  const params = new URLSearchParams(extra ?? {});
  if (mode === "key") params.set("key", apiKey);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

function geminiHeadersFor(apiKey: string, mode: "key" | "bearer"): HeadersInit {
  const base: HeadersInit = { "Content-Type": "application/json" };
  if (mode === "bearer") {
    return { ...base, Authorization: `Bearer ${apiKey.trim()}` };
  }
  return base;
}

async function tryGeminiCall(
  req: GenerationRequest,
  method: "generateContent" | "streamGenerateContent",
  mode: "key" | "bearer",
  extra?: Record<string, string>,
): Promise<Response> {
  const model = geminiModelId(req.model);
  const url = geminiUrlFor(model, method, req.apiKey, mode, extra);
  const headers = geminiHeadersFor(req.apiKey, mode);

  // 1차: systemInstruction 사용
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(toGeminiBody(req, false)),
  });
  if (res.ok) return res;

  // systemInstruction 미지원 모델 → 인라인 폴백
  const errText = await res.text();
  if (res.status === 400 && /system.?instruction|not.*support/i.test(errText)) {
    const retry = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(toGeminiBody(req, true)),
    });
    if (retry.ok) return retry;
    return new Response(await retry.text(), { status: retry.status });
  }

  return new Response(errText, { status: res.status });
}

async function geminiFetch(
  req: GenerationRequest,
  method: "generateContent" | "streamGenerateContent",
  extra?: Record<string, string>,
) {
  const forced = req.geminiAuth && req.geminiAuth !== "auto" ? req.geminiAuth : null;
  const primary: "key" | "bearer" = forced ?? geminiAuthKind(req.apiKey);
  const secondary: "key" | "bearer" = primary === "key" ? "bearer" : "key";

  let res = await tryGeminiCall(req, method, primary, extra);
  if (res.ok) return res;

  // 자동 모드: 401/403 이면 반대 인증 방식으로 재시도
  if (!forced && (res.status === 401 || res.status === 403)) {
    const retry = await tryGeminiCall(req, method, secondary, extra);
    if (retry.ok) return retry;
    res = retry; // 두 번째 응답을 최종 에러 소스로 사용
  }

  const errText = await res.text();
  const model = geminiModelId(req.model);

  if (res.status === 404) {
    throw new Error(
      `Gemini 모델 "${model}" 을(를) 사용할 수 없습니다. 설정에서 "모델 가져오기" 로 사용 가능한 모델을 확인해 주세요. (원문: ${errText})`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Gemini 인증 실패 (${res.status}). 자동 모드가 API Key / Bearer 두 방식 모두 거부되었습니다 — 키 자체가 비활성 또는 블록되었을 가능성이 높습니다. 설정에서 "인증 방식"을 명시적으로 지정하거나 새 키를 발급받아 주세요. (원문: ${errText})`,
    );
  }

  throw new Error(`Gemini: ${res.status} ${errText}`);
}

async function geminiGenerate(req: GenerationRequest): Promise<string> {
  const res = await geminiFetch(req, "generateContent");
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? ""
  );
}

async function* geminiStream(req: GenerationRequest): AsyncGenerator<string> {
  const res = await geminiFetch(req, "streamGenerateContent", { alt: "sse" });
  if (!res.body) throw new Error("Gemini: 응답 바디 없음");

  for await (const line of readSseLines(res.body)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const chunk =
        parsed.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      if (chunk) yield chunk;
    } catch {
      /* skip malformed chunk */
    }
  }
}

// ---------- Groq (OpenAI-compatible) ----------

function toGroqBody(req: GenerationRequest, stream: boolean) {
  return {
    model: req.model ?? PROVIDERS.groq.defaultModel,
    max_tokens: req.maxTokens ?? 1024,
    stream,
    messages: [
      { role: "system", content: req.system },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
}

async function groqFetch(req: GenerationRequest, stream: boolean) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey.trim()}`,
    },
    body: JSON.stringify(toGroqBody(req, stream)),
  });
  if (res.ok) return res;

  const errText = await res.text();
  const parsedMsg = extractGroqErrorMessage(errText);
  const model = req.model ?? PROVIDERS.groq.defaultModel;

  if (res.status === 401) {
    throw new Error(
      `Groq 인증 실패 (401). API 키가 유효하지 않거나 만료되었습니다. 키는 \`gsk_\` 로 시작해야 합니다. https://console.groq.com/keys 에서 발급·확인해 주세요. (원문: ${parsedMsg})`,
    );
  }
  if (res.status === 404 || (res.status === 400 && /model/i.test(parsedMsg))) {
    throw new Error(
      `Groq 모델 "${model}" 을(를) 사용할 수 없습니다. 폐지되었거나 이름이 바뀌었을 수 있습니다. 설정에서 "모델 가져오기" 로 사용 가능한 목록을 확인해 주세요. (원문: ${parsedMsg})`,
    );
  }
  if (res.status === 429) {
    throw new Error(
      `Groq 요청 제한에 걸렸습니다 (429). 잠시 후 다시 시도하거나 모델을 바꿔보세요. (원문: ${parsedMsg})`,
    );
  }
  throw new Error(`Groq: ${res.status} ${parsedMsg}`);
}

function extractGroqErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message ?? raw;
  } catch {
    return raw;
  }
}

async function groqGenerate(req: GenerationRequest): Promise<string> {
  const res = await groqFetch(req, false);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function* groqStream(req: GenerationRequest): AsyncGenerator<string> {
  const res = await groqFetch(req, true);
  if (!res.body) throw new Error("Groq: 응답 바디 없음");

  for await (const line of readSseLines(res.body)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const chunk = parsed.choices?.[0]?.delta?.content ?? "";
      if (chunk) yield chunk;
    } catch {
      /* skip */
    }
  }
}

// ---------- SSE helper ----------

async function* readSseLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      for (const line of evt.split("\n")) {
        yield line;
      }
    }
  }
}

// ---------- Helpers ----------

export function buildTutorSystem(
  level: "beginner" | "intermediate" | "advanced",
  context?: string,
  revealMode?: "socratic" | "direct",
) {
  const base =
    revealMode === "direct" ? DIRECT_TUTOR_SYSTEM : SOCRATIC_TUTOR_SYSTEM;
  return `${base}\n\n학습자 수준: ${level}${
    context ? `\n\n세션 컨텍스트:\n${context}` : ""
  }`;
}

/** 요청 바디에서 provider/apiKey/model 을 꺼내 서버 측 env 로 폴백. */
export function resolveCredentials(body: {
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: GeminiAuthMode;
}): {
  provider: ProviderId;
  apiKey: string;
  model?: string;
  geminiAuth?: GeminiAuthMode;
} | null {
  const provider = body.provider ?? "claude";
  const envKey = provider === "claude" ? process.env.ANTHROPIC_API_KEY : undefined;
  const apiKey = body.apiKey?.trim() || envKey?.trim();
  if (!apiKey) return null;
  return { provider, apiKey, model: body.model, geminiAuth: body.geminiAuth };
}
