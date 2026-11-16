/**
 * 외부 이미지 생성 유틸.
 * - OpenAI DALL-E 3 (유료, 키 필요)
 * - Google Imagen 3 (유료, Gemini 키 필요)
 * - Pollinations.ai (무료, 키 불필요 — 폴백·데모용)
 *
 * AI 가 답변 안에 `![설명](image-gen:프롬프트)` 형태로 쓰면
 * 서버가 이 모듈로 실제 이미지를 생성하고 data URL / https URL 로 치환합니다.
 */

export type ImageProvider = "openai" | "google" | "pollinations";

export interface ImageGenRequest {
  provider: ImageProvider;
  prompt: string;
  apiKey?: string;
  size?: "square" | "portrait" | "landscape";
}

export interface ImageGenResult {
  url: string; // data:image/... 또는 https://...
  provider: ImageProvider;
}

const SIZE_MAP = {
  openai: { square: "1024x1024", portrait: "1024x1792", landscape: "1792x1024" },
  pollinations: { square: "768x768", portrait: "768x1024", landscape: "1024x768" },
};

export async function generateImage(
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  switch (req.provider) {
    case "openai":
      return openAiImage(req);
    case "google":
      return googleImage(req);
    case "pollinations":
      return pollinationsImage(req);
  }
}

async function openAiImage(req: ImageGenRequest): Promise<ImageGenResult> {
  if (!req.apiKey) throw new Error("OpenAI 이미지 생성에 API 키가 필요합니다.");
  const size = SIZE_MAP.openai[req.size ?? "square"];
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: req.prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI 이미지 생성 실패 (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const b64 = data.data?.[0]?.b64_json;
  if (b64) {
    return { provider: "openai", url: `data:image/png;base64,${b64}` };
  }
  const url = data.data?.[0]?.url;
  if (url) return { provider: "openai", url };
  throw new Error("OpenAI 이미지 응답이 비어 있습니다.");
}

async function googleImage(req: ImageGenRequest): Promise<ImageGenResult> {
  if (!req.apiKey) throw new Error("Google Imagen 에 API 키가 필요합니다.");
  // Imagen 3 via Gemini API (유료 — Vertex AI 호환 엔드포인트)
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=" +
    encodeURIComponent(req.apiKey.trim());
  const aspect =
    req.size === "landscape"
      ? "16:9"
      : req.size === "portrait"
        ? "9:16"
        : "1:1";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: req.prompt }],
      parameters: { sampleCount: 1, aspectRatio: aspect },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Imagen 생성 실패 (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  const p = data.predictions?.[0];
  if (!p?.bytesBase64Encoded) {
    throw new Error("Imagen 응답에 이미지가 없습니다.");
  }
  const mime = p.mimeType ?? "image/png";
  return {
    provider: "google",
    url: `data:${mime};base64,${p.bytesBase64Encoded}`,
  };
}

async function pollinationsImage(
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  // Pollinations: 완전 무료, 키 불필요. URL 자체가 이미지.
  const size = SIZE_MAP.pollinations[req.size ?? "square"];
  const [w, h] = size.split("x");
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(req.prompt)}` +
    `?width=${w}&height=${h}&nologo=true&enhance=true`;
  return { provider: "pollinations", url };
}

/**
 * AI 답변 텍스트에서 `![alt](image-gen:prompt)` 패턴을 찾아
 * 실제 생성된 이미지 URL 로 치환합니다.
 * - 공급자·키가 없으면 pollinations 로 폴백
 * - 생성 실패 시 원문 유지 + 에러 주석
 */
export async function expandImageDirectives(
  text: string,
  settings: {
    provider: ImageProvider;
    apiKey?: string;
  },
  options?: { max?: number },
): Promise<string> {
  const max = options?.max ?? 3;
  const re = /!\[([^\]]*)\]\(image-gen:([^)]+)\)/g;
  const matches: Array<{ match: string; alt: string; prompt: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ match: m[0], alt: m[1], prompt: m[2].trim() });
    if (matches.length >= max) break;
  }
  if (matches.length === 0) return text;

  const replacements = new Map<string, string>();
  for (const { match, alt, prompt } of matches) {
    try {
      const result = await generateImage({
        provider: settings.provider,
        prompt,
        apiKey: settings.apiKey,
      });
      replacements.set(match, `![${alt || prompt}](${result.url})`);
    } catch (err) {
      // 유료 공급자 실패 → pollinations 폴백 (키 불필요)
      try {
        const fb = await generateImage({ provider: "pollinations", prompt });
        replacements.set(match, `![${alt || prompt}](${fb.url})`);
      } catch (err2) {
        const msg = err instanceof Error ? err.message : String(err);
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        replacements.set(
          match,
          `\n> ⚠️ 이미지 생성 실패 — ${msg} / 폴백도 실패 — ${msg2}\n`,
        );
      }
    }
  }
  let out = text;
  for (const [k, v] of replacements) {
    out = out.split(k).join(v);
  }
  return out;
}
