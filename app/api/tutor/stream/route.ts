import {
  buildTutorSystem,
  generateStream,
  resolveCredentials,
  type ProviderId,
} from "@/lib/providers";
import { demoTutorChunks } from "@/lib/demo-responses";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";
import { expandImageDirectives, type ImageProvider } from "@/lib/image-gen";
import { parseYouTubeId } from "@/lib/youtube";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs";

interface Body {
  level: "beginner" | "intermediate" | "advanced";
  context?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  revealMode?: "socratic" | "direct";
  imageEnabled?: boolean;
  imageProvider?: ImageProvider;
  imageKey?: string;
}

const IMAGE_HINT = `

## 외부 이미지 (활성화됨)
사진·일러스트·커스텀 장면이 **꼭 필요하면** \`![설명](image-gen:영문 프롬프트)\` 형태로 쓰세요. 서버가 실제 이미지로 치환합니다.
- 다이어그램·수식·흐름은 mermaid/svg 블럭 우선 (훨씬 빠르고 저렴)
- image-gen 은 답변당 **최대 1~2개**만. 프롬프트는 영문·구체적으로.`;

const YOUTUBE_HINT = `

## YouTube 영상 자막 (자동 포함)
사용자가 공유한 YouTube 링크의 **공개 자막이 아래에 자동으로 포함**되어 있습니다.
- "자막을 못 본다" 거나 "링크 접근 불가" 라고 말하지 **마세요** — 이미 자막이 있어요
- 자막을 바탕으로 바로 요약·어휘 추출·질문에 답하세요
- 타임스탬프 [MM:SS] 는 사용자가 원하면 인용 가능`;

/**
 * 메시지 히스토리를 토큰 예산 안에 맞게 자르기.
 * - 가장 최근 메시지부터 포함해 상한에 도달하면 중단
 * - 첫 포함 메시지가 user 가 되도록 보장 (role 쌍 맞춤)
 * - 각 메시지 본문도 길면 잘림 (user 2000, assistant 3000자)
 */
function trimMessagesForTokenBudget(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxChars: number,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (messages.length === 0) return messages;
  const picked: Array<{ role: "user" | "assistant"; content: string }> = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const cap = m.role === "user" ? 2000 : 3000;
    const content = m.content.length > cap ? m.content.slice(0, cap) + "\n…(이하 생략)" : m.content;
    const size = content.length;
    if (total + size > maxChars && picked.length > 0) break;
    picked.unshift({ role: m.role, content });
    total += size;
  }
  // 첫 메시지는 user 여야 함 (Claude/Groq 요구)
  while (picked.length > 0 && picked[0].role !== "user") {
    picked.shift();
  }
  // 그래도 비면 마지막 user 메시지만 유지
  if (picked.length === 0) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) picked.push({ role: lastUser.role, content: lastUser.content.slice(0, 2000) });
  }
  return picked;
}

/** 메시지에서 모든 YouTube URL 을 찾아 자막을 가져와 컨텍스트 블록으로 반환. */
async function extractYoutubeContext(
  messages: Array<{ role: string; content: string }>,
): Promise<{
  contextBlock: string;
  meta: Array<{ videoId: string; lineCount: number; lang: string }>;
}> {
  // 마지막 user 메시지 1~2개에서만 찾기 (오래된 메시지는 이미 처리됨)
  const recent = [...messages]
    .reverse()
    .filter((m) => m.role === "user")
    .slice(0, 2);
  const seen = new Set<string>();
  const videoIds: string[] = [];
  for (const m of recent) {
    const re =
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(m.content)) !== null) {
      const id = parseYouTubeId(match[0]);
      if (id && !seen.has(id)) {
        seen.add(id);
        videoIds.push(id);
        if (videoIds.length >= 2) break; // 요청당 최대 2개 영상
      }
    }
    if (videoIds.length >= 2) break;
  }
  if (videoIds.length === 0) return { contextBlock: "", meta: [] };

  const parts: string[] = [];
  const meta: Array<{ videoId: string; lineCount: number; lang: string }> = [];
  for (const vid of videoIds) {
    type Item = { text: string; offset: number };
    let transcript: Item[] | null = null;
    let usedLang = "auto";
    for (const lang of ["ko", "en"]) {
      try {
        transcript = (await YoutubeTranscript.fetchTranscript(vid, {
          lang,
        })) as unknown as Item[];
        usedLang = lang;
        break;
      } catch {
        /* 다음 lang 시도 */
      }
    }
    if (!transcript) {
      try {
        transcript = (await YoutubeTranscript.fetchTranscript(
          vid,
        )) as unknown as Item[];
        usedLang = "auto";
      } catch {
        continue; // 자막 없음 → 건너뜀
      }
    }
    if (!transcript || transcript.length === 0) continue;
    // 타임스탬프 포함, 최대 8000자 (토큰 절약)
    const maxOff = Math.max(...transcript.map((t) => t.offset ?? 0));
    const isMs = maxOff > 1_000_000;
    const lines: string[] = [];
    for (const t of transcript) {
      const sec = Math.floor((isMs ? t.offset : t.offset * 1000) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      const txt = (t.text || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n+/g, " ")
        .trim();
      if (!txt) continue;
      lines.push(`[${mm}:${ss}] ${txt}`);
    }
    const body = lines.join("\n").slice(0, 8000);
    parts.push(
      `--- 영상 ${vid} (lang=${usedLang}, https://youtube.com/watch?v=${vid}) ---\n${body}`,
    );
    meta.push({ videoId: vid, lineCount: lines.length, lang: usedLang });
  }
  if (parts.length === 0) return { contextBlock: "", meta: [] };
  const contextBlock = `\n\n[📹 사용자가 공유한 YouTube 영상의 자막 (서버가 자동 추출함)]\n${parts.join("\n\n")}`;
  return { contextBlock, meta };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.messages?.length) {
    return new Response(JSON.stringify({ error: "messages 필수" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const me = currentUser();
  if (me) {
    logActivity({
      userId: me.id,
      type: "tutor_ask",
      meta: { level: body.level, direct: body.revealMode === "direct" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 작은 chunk 를 약 40ms 윈도우로 묶어 flush → "토막" 체감 완화 + 트래픽 ↓
      let buf = "";
      let lastFlush = Date.now();
      const BATCH_MS = 40;
      const sendRaw = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          /* controller closed */
        }
      };
      const flushDelta = () => {
        if (buf.length === 0) return;
        sendRaw({ delta: buf });
        buf = "";
        lastFlush = Date.now();
      };
      const pushDelta = (chunk: string) => {
        buf += chunk;
        // 큰 chunk 또는 시간 초과 시 즉시 flush
        if (buf.length >= 80 || Date.now() - lastFlush >= BATCH_MS) {
          flushDelta();
        }
      };

      try {
        // 1) 사용자가 YouTube URL 을 공유했으면 자막 자동 추출 → 시스템 컨텍스트로 주입
        const yt = await extractYoutubeContext(body.messages);
        if (yt.meta.length > 0) {
          // UI 에 "📹 자막 N줄 가져옴" 뱃지 띄울 수 있도록 즉시 알림
          sendRaw({ videoCaptioned: yt.meta });
        }
        const augmentedContext = (body.context ?? "") + yt.contextBlock;

        const creds = resolveCredentials(body);
        let fullText = "";
        if (!creds) {
          const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
          const chunks = demoTutorChunks({
            context: augmentedContext,
            lastUserMessage: lastUser?.content ?? "",
            withImageGen: body.imageEnabled,
          });
          for (const c of chunks) {
            pushDelta(c);
            fullText += c;
            await new Promise((r) => setTimeout(r, 20));
          }
          flushDelta();
          sendRaw({ done: true, demo: true });
        } else {
          const baseSystem = buildTutorSystem(
            body.level,
            augmentedContext,
            body.revealMode,
          );
          let system = body.imageEnabled ? baseSystem + IMAGE_HINT : baseSystem;
          if (yt.meta.length > 0) system += YOUTUBE_HINT;
          // Groq TPM 8000 안전 범위를 넘지 않도록 긴 히스토리를 자동 압축.
          // Claude/Gemini 는 넉넉하지만 Groq 는 분당 토큰 제한이 짧아 긴 세션 복원 후 추가 질문 시 자주 터짐.
          const trimmedMessages = trimMessagesForTokenBudget(
            body.messages,
            creds.provider === "groq" ? 5500 : 20_000,
          );
          const iter = generateStream({
            ...creds,
            system,
            messages: trimmedMessages,
            maxTokens: creds.provider === "groq" ? 1500 : 4096,
          });
          for await (const chunk of iter) {
            pushDelta(chunk);
            fullText += chunk;
          }
          flushDelta();
          sendRaw({ done: true, provider: creds.provider });
        }

        // 생성된 응답에서 `image-gen:` directive 를 실제 이미지로 치환해 보강 메시지로 전송
        if (body.imageEnabled && /!\[[^\]]*\]\(image-gen:/i.test(fullText)) {
          try {
            const expanded = await expandImageDirectives(
              fullText,
              {
                provider: body.imageProvider ?? "pollinations",
                apiKey: body.imageKey,
              },
              { max: 2 },
            );
            if (expanded !== fullText) {
              sendRaw({ expanded });
            }
          } catch (err) {
            sendRaw({
              imageError:
                err instanceof Error ? err.message : "이미지 생성 실패",
            });
          }
        }
      } catch (err) {
        flushDelta();
        sendRaw({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
