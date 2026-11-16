import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createCard } from "@/lib/study-store";
import { generate, type ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Body {
  title: string; // 세션 식별자 (제목 역할)
  messages: SessionMessage[];
  count?: number;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
}

const SYSTEM = `당신은 PolyMath Tutor 의 플래시카드 생성기입니다.
학습자가 과거에 진행한 **대화 전체** 를 받아, 그 안에서 복습할 가치가 있는 핵심 개념·사실을 **외우기 쉬운 단위** 로 쪼개 카드를 만듭니다.

규칙:
- 질문(front)은 짧고 한 가지 사실/개념만 묻기
- 답(back)은 1-3문장. 요점 + (필요시) 짧은 예시
- 코드가 있으면 간결하게 유지
- **다이어그램·그래프 블럭 (\`\`\`mermaid, \`\`\`plot, \`\`\`chart, \`\`\`hanja 등) 은 뽑지 말고**, 그 안의 핵심 개념만 카드로
- 중복·너무 사소한 것 제외. 질문 자체가 애매한 경우도 제외
- 응답 언어는 대화와 동일 (한국어 중심)
- JSON 배열 외 다른 응답 금지. 설명·헤더·마크다운 코드펜스 금지

응답 형식:
[{"front":"...","back":"..."}, ...]`;

function parseCards(raw: string): { front: string; back: string }[] {
  const trimmed = raw.trim();
  const tryParse = (s: string) => {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr))
        return arr.filter(
          (x) => typeof x?.front === "string" && typeof x?.back === "string",
        );
    } catch {
      /* ignore */
    }
    return null;
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  const first = trimmed.indexOf("[");
  const last = trimmed.lastIndexOf("]");
  if (first >= 0 && last > first) {
    const sub = tryParse(trimmed.slice(first, last + 1));
    if (sub) return sub;
  }
  return [];
}

/** 데모 폴백 — AI 없이도 사용자 질문/AI 답변 쌍으로 간단히 카드 추출. */
function demoCardsFromMessages(
  messages: SessionMessage[],
  max: number,
): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = [];
  for (let i = 0; i < messages.length - 1 && cards.length < max; i++) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q.role !== "user" || a.role !== "assistant") continue;
    const front = q.content.trim().slice(0, 160);
    // 비주얼 블럭·메타정보 제거해 핵심 텍스트만
    const back = a.content
      .replace(/```[\s\S]*?```/g, "") // 코드/비주얼 블럭 제거
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // 이미지
      .replace(/_\([^)]*\)_/g, "") // _(⚡ claude)_ 같은 메타
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 400);
    if (!front || !back) continue;
    cards.push({ front, back });
  }
  if (cards.length === 0) {
    cards.push({
      front: "⚡ 복습 카드 — 데모 모드",
      back: "실제 플래시카드로 변환하려면 설정에서 AI 공급자 키를 넣어 주세요. 그러면 세션 전체를 읽고 핵심 Q&A 를 추출해 줍니다.",
    });
  }
  return cards;
}

/** 한 메시지의 내용을 정리 — 비주얼 블럭·이미지·메타 제거. */
function cleanContent(content: string): string {
  return content
    .replace(/```(mermaid|svg|plot|chart|tts|ipa|hanja)[\s\S]*?```/g, "[시각화]")
    .replace(/```[\s\S]*?```/g, "[코드]")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "[이미지]")
    .replace(/_\([^)]*\)_/g, "") // _(⚡ claude)_ 같은 메타
    .replace(/_?📹[^_\n]+_?/g, "") // 자막 자동 포함 뱃지 제거
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 메시지 리스트를 LLM 프롬프트용으로 압축.
 * - 제한: ko 1자 ≈ 1.5 토큰 → 3500자 ≈ 5000 토큰 (Groq 8000 TPM 안전 범위)
 * - 긴 세션: 최근 메시지를 우선 → 앞쪽은 제목·주제 요약으로 대체
 * - 각 메시지 본문: user 400자, assistant 800자 상한
 */
function compressMessages(
  messages: SessionMessage[],
  maxChars: number,
): string {
  const relevant = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      m.content.trim().length > 0 &&
      !/세션\s.+가 시작되었습니다/.test(m.content),
  );
  // 뒤에서부터 담아 최근 대화 우선 — 길면 앞쪽을 버림
  const picked: string[] = [];
  let total = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    const m = relevant[i];
    const role = m.role === "user" ? "학습자" : "튜터";
    const cap = m.role === "user" ? 400 : 800;
    const body = cleanContent(m.content).slice(0, cap);
    const chunk = `[${role}] ${body}`;
    if (total + chunk.length > maxChars) {
      // 더 넣을 공간 없음 — 앞 메시지는 생략됨 표시
      if (i > 0) picked.unshift(`[… 앞서 ${i}개 메시지 생략 …]`);
      break;
    }
    picked.unshift(chunk);
    total += chunk.length + 2;
  }
  return picked.join("\n\n");
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as Body;
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "messages 필수" },
      { status: 400 },
    );
  }
  const title = (body.title ?? "지난 세션").toString().slice(0, 120);
  const count = Math.max(1, Math.min(20, body.count ?? 6));

  // 3500자 ≈ 5000 토큰 (한국어 기준). Groq 무료 티어 TPM 8000 이내에 들어오도록 안전 마진.
  const context = compressMessages(body.messages, 3500);
  const userPrompt = [
    `세션 제목/주제: ${title}`,
    `원하는 카드 개수: 약 ${count}개 (중요도가 낮으면 적게 뽑아도 됨)`,
    "",
    "학습 세션 대화 로그:",
    "---",
    context,
    "---",
    "",
    "위 대화의 핵심 개념·사실을 복습용 플래시카드로 만들어 JSON 배열로만 응답하세요.",
  ].join("\n");

  let cards: { front: string; back: string }[] = [];
  let fallbackReason: string | undefined;
  if (body.provider && body.apiKey) {
    // 1차 시도 — 3500자 컨텍스트 + 1500 maxTokens
    let attemptPrompt = userPrompt;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await generate({
          provider: body.provider,
          apiKey: body.apiKey,
          model: body.model,
          system: SYSTEM,
          messages: [{ role: "user", content: attemptPrompt }],
          maxTokens: attempt === 1 ? 1500 : 1000,
          geminiAuth: body.geminiAuth,
        });
        cards = parseCards(raw);
        if (cards.length > 0) break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[study/from-session] AI attempt ${attempt} failed:`,
          msg.slice(0, 200),
        );
        // 토큰 초과 (413 / tokens per minute) 라면 컨텍스트 반 자르고 재시도
        if (
          attempt === 1 &&
          /413|too large|tokens per minute|context length|rate limit/i.test(msg)
        ) {
          const shorter = compressMessages(body.messages, 1800);
          attemptPrompt = [
            `세션 제목/주제: ${title}`,
            `원하는 카드 개수: 약 ${Math.min(count, 4)}개 (대화가 길어 핵심만 추출)`,
            "",
            "학습 세션 대화 로그 (압축):",
            "---",
            shorter,
            "---",
            "",
            "위 대화의 핵심 개념·사실을 복습용 플래시카드로 만들어 JSON 배열로만 응답하세요.",
          ].join("\n");
          fallbackReason = "컨텍스트 압축 후 재시도";
          continue;
        }
        fallbackReason = msg.slice(0, 160);
        break;
      }
    }
  }
  if (cards.length === 0) {
    cards = demoCardsFromMessages(body.messages, count);
  }

  const created = cards
    .map((c) =>
      createCard({
        userId: me.id,
        front: c.front,
        back: c.back,
      }),
    )
    .filter((x): x is NonNullable<typeof x> => !!x);

  return NextResponse.json({
    ok: true,
    created: created.length,
    source: "session",
    title,
    fallbackReason,
  });
}
