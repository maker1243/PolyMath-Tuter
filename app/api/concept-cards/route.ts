import { NextResponse } from "next/server";
import { generate, resolveCredentials, type ProviderId } from "@/lib/providers";
import { demoConceptCards } from "@/lib/demo-responses";
import type { ConceptCard, SkillLevel } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  text: string;
  level?: SkillLevel;
  count?: number;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
}

const CARD_SYSTEM = `당신은 학습 자료에서 핵심 개념을 추출하는 노트 테이커입니다.
반드시 아래 JSON 배열만 출력하세요. 머리말·설명 금지:
[
  {
    "title": "개념 이름 (한국어 또는 원어)",
    "summary": "2~4문장 핵심 요약 (한국어)",
    "vocabulary": [{ "term": "어휘", "gloss": "뜻풀이" }]
  }
]`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const level = body.level ?? "intermediate";
    const count = Math.min(Math.max(body.count ?? 3, 1), 8);

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text 필수" }, { status: 400 });
    }

    const creds = resolveCredentials(body);
    if (!creds) {
      return NextResponse.json({ cards: demoConceptCards(count), demo: true });
    }

    const text = await generate({
      ...creds,
      system: CARD_SYSTEM,
      messages: [
        {
          role: "user",
          content: `난이도: ${level}
개수: ${count}개

학습 자료:
${body.text.slice(0, 8000)}

위 자료에서 가장 중요한 개념을 ${count}개 추출해 JSON 배열로만 출력하세요.`,
        },
      ],
      maxTokens: 1800,
    });

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "파싱 실패", raw: text }, { status: 502 });
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{
      title: string;
      summary: string;
      vocabulary?: Array<{ term: string; gloss: string }>;
    }>;

    const cards: ConceptCard[] = parsed.map((c, i) => ({
      id: `c-${Date.now()}-${i}`,
      title: String(c.title),
      summary: String(c.summary),
      vocabulary: Array.isArray(c.vocabulary) ? c.vocabulary : [],
      level,
    }));

    return NextResponse.json({ cards, provider: creds.provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
