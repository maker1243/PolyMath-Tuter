import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createCard, getSource } from "@/lib/study-store";
import { generate, type ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  sourceId: string;
  count?: number;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
}

const SYSTEM = `당신은 PolyMath Tutor 의 플래시카드 생성기입니다.
학습자가 **한 번에 외우기 쉬운 작은 단위** 로 쪼개 카드를 만듭니다.

규칙:
- 질문(front)은 짧고 한 가지 사실/개념만 묻기
- 답(back)은 1-3문장. 요점 + (필요시) 짧은 예시
- 코드가 있으면 코드 블럭 유지
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
          (x) =>
            typeof x?.front === "string" && typeof x?.back === "string",
        );
    } catch {
      /* ignore */
    }
    return null;
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  // 2차: [ ... ] 추출
  const first = trimmed.indexOf("[");
  const last = trimmed.lastIndexOf("]");
  if (first >= 0 && last > first) {
    const sub = tryParse(trimmed.slice(first, last + 1));
    if (sub) return sub;
  }
  return [];
}

function demoCards(title: string): { front: string; back: string }[] {
  return [
    {
      front: `⚡ "${title}" — 데모 카드 1`,
      back: "설정에서 AI 공급자 키를 넣으면 실제 LLM 이 자료 전체를 읽고 카드를 생성합니다.",
    },
    {
      front: "데모 카드 2 — 간격 반복이란?",
      back: "SRS (Spaced Repetition System) — 복습 간격을 점점 늘려 장기 기억에 최적화. 응답 정확도에 따라 자동 조정.",
    },
  ];
}

export async function POST(req: Request) {
  const me = currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as Body;
  if (!body?.sourceId) {
    return NextResponse.json({ error: "sourceId 필수" }, { status: 400 });
  }
  const src = getSource(me.id, body.sourceId);
  if (!src) {
    return NextResponse.json({ error: "자료 없음" }, { status: 404 });
  }
  const count = Math.max(1, Math.min(20, body.count ?? 8));

  /**
   * 자료 본문 압축 — 긴 YouTube 자막·PDF 발췌를 Groq TPM 8000 안에 맞춤.
   * - 1차: 3500자 (약 5000 토큰) + maxTokens 1500 → 총 ~6500 토큰
   * - 긴 자료는 앞/뒤 샘플링해서 양쪽 정보 모두 담음 (중간 생략)
   */
  function sampleContent(content: string, limit: number): string {
    const t = content.trim();
    if (t.length <= limit) return t;
    // 앞 2/3, 뒤 1/3 로 샘플링해서 "서론·결론" 양쪽 모두 담기
    const head = Math.floor(limit * 0.6);
    const tail = limit - head - 30;
    return `${t.slice(0, head)}\n\n[… 자료 중간 ${t.length - limit}자 생략 …]\n\n${t.slice(-tail)}`;
  }

  function buildPrompt(bodyText: string, cardCount: number): string {
    return [
      `자료 제목: ${src!.title}`,
      `카드 개수: 약 ${cardCount}개`,
      "",
      "자료 본문:",
      "---",
      bodyText,
      "---",
      "",
      "위 자료의 핵심 개념·사실을 플래시카드로 만들어 JSON 배열로만 응답하세요.",
    ].join("\n");
  }

  let cards: { front: string; back: string }[] = [];
  let fallbackReason: string | undefined;
  if (body.provider && body.apiKey) {
    const attempts: Array<{ chars: number; count: number; maxTokens: number }> = [
      { chars: 3500, count, maxTokens: 1500 },
      { chars: 1800, count: Math.min(count, 4), maxTokens: 1000 },
    ];
    for (let i = 0; i < attempts.length; i++) {
      const { chars, count: c, maxTokens } = attempts[i];
      try {
        const raw = await generate({
          provider: body.provider,
          apiKey: body.apiKey,
          model: body.model,
          system: SYSTEM,
          messages: [
            {
              role: "user",
              content: buildPrompt(sampleContent(src.content, chars), c),
            },
          ],
          maxTokens,
          geminiAuth: body.geminiAuth,
        });
        cards = parseCards(raw);
        if (cards.length > 0) {
          if (i > 0) fallbackReason = "컨텍스트 압축 후 성공";
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[study/generate] AI attempt ${i + 1} failed:`,
          msg.slice(0, 200),
        );
        if (
          i < attempts.length - 1 &&
          /413|too large|tokens per minute|context length|rate limit/i.test(msg)
        ) {
          continue; // 더 짧게 재시도
        }
        fallbackReason = msg.slice(0, 160);
        break;
      }
    }
  }
  if (cards.length === 0) cards = demoCards(src.title);

  const created = cards
    .map((c) =>
      createCard({
        userId: me.id,
        sourceId: src.id,
        front: c.front,
        back: c.back,
      }),
    )
    .filter((x): x is NonNullable<typeof x> => !!x);

  return NextResponse.json({
    ok: true,
    created,
    count: created.length,
    fallbackReason,
  });
}
