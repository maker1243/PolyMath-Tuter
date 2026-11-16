import { NextResponse } from "next/server";
import { generate, type ProviderId } from "@/lib/providers";
import { SUBJECT_GROUPS } from "@/lib/subjects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  groupId: string; // 분야 id (programming, math, language, …)
  subject?: string; // 분야 내 사전 정의된 세부 (선택)
  topic: string; // 사용자가 자유 입력한 세부 주제
  level?: "beginner" | "intermediate" | "advanced";
  count?: number;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
}

export interface DrillCard {
  front: string; // 질문·용어·개념
  back: string; // 답·설명
  hint?: string; // 중급 힌트 (optional)
}

const SYSTEM = `당신은 모든 분야를 다루는 플래시카드 생성기입니다.
학습자가 지정한 분야(대분류)와 세부 주제에 맞춰 외우기·이해에 최적화된 Q·A 카드를 만듭니다.

규칙:
- front: 질문·용어·개념 (짧고 명확. 한 문장 이내 또는 핵심 키워드)
- back: 답·설명 (2~3문장 이내, 예시 가능. 외우기 좋도록 간결하게)
- hint: 중간 난이도 힌트 (선택. 없으면 생략)
- 카드마다 서로 다른 각도로 접근 (정의·예시·반례·비교·응용 등을 섞어서)
- JSON 배열 외 다른 응답 금지. 설명·헤더·마크다운 코드펜스 금지

응답 형식:
[{"front":"...","back":"...","hint":"..."}, ...]`;

function parseCards(raw: string): DrillCard[] {
  const trimmed = raw.trim();
  const tryParse = (s: string): DrillCard[] | null => {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr
          .filter(
            (x) => typeof x?.front === "string" && typeof x?.back === "string",
          )
          .map((x) => ({
            front: String(x.front).slice(0, 400),
            back: String(x.back).slice(0, 800),
            hint: typeof x.hint === "string" ? x.hint.slice(0, 300) : undefined,
          })) as DrillCard[];
      }
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

function demoCards(groupLabel: string, topic: string, count: number): DrillCard[] {
  const seeds: DrillCard[] = [
    {
      front: `${groupLabel} · "${topic}" 의 핵심 정의는?`,
      back: "⚡ 데모 카드 — 설정(/settings) 에서 AI 공급자 키를 등록하면 실제 카드가 생성됩니다.",
      hint: "AI 키를 등록해 보세요.",
    },
    {
      front: `"${topic}" 을 쉽게 설명하는 비유 1개를 들어본다면?`,
      back: "실제 AI 가 분야·주제에 맞춰 적절한 비유와 예시를 생성합니다. 지금은 데모 응답입니다.",
    },
    {
      front: `"${topic}" 학습 시 가장 흔히 하는 실수는?`,
      back: "AI 공급자 키 연결 후 실제 생성 시 '자주 틀리는 포인트 → 대처법' 흐름으로 카드가 구성됩니다.",
    },
  ];
  const extras = Array.from(
    { length: Math.max(0, count - seeds.length) },
    (_, i) => ({
      front: `데모 카드 ${i + 4}: ${topic}`,
      back: "AI 생성 전 임시 카드입니다.",
    }),
  );
  return [...seeds, ...extras].slice(0, count);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const group = SUBJECT_GROUPS.find((g) => g.id === body.groupId);
  if (!group) {
    return NextResponse.json({ error: "알 수 없는 분야" }, { status: 400 });
  }
  const topic = (body.topic ?? "").toString().trim().slice(0, 120);
  if (!topic) {
    return NextResponse.json(
      { error: "세부 주제를 입력하세요" },
      { status: 400 },
    );
  }
  const subject = (body.subject ?? "").toString().trim().slice(0, 60);
  const level = body.level ?? "intermediate";
  const count = Math.max(3, Math.min(20, body.count ?? 10));

  const userPrompt = [
    `대분류: ${group.label}`,
    subject ? `중분류: ${subject}` : null,
    `세부 주제: ${topic}`,
    `학습자 레벨: ${level}`,
    `카드 개수: 정확히 ${count}개`,
    "",
    `위 분야·주제에 맞춰 Q·A 플래시카드 ${count}개를 JSON 배열로만 응답하세요. ` +
      `각 카드의 front 는 질문·용어·개념, back 은 답·설명, hint 는 선택적 힌트.`,
  ]
    .filter(Boolean)
    .join("\n");

  let cards: DrillCard[] = [];
  let fallbackReason: string | undefined;

  if (body.provider && body.apiKey) {
    try {
      const raw = await generate({
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 2400,
        geminiAuth: body.geminiAuth,
      });
      cards = parseCards(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[apps/custom] AI failed:", msg.slice(0, 200));
      fallbackReason = msg.slice(0, 160);
    }
  }
  if (cards.length === 0) {
    cards = demoCards(group.label, topic, count);
    if (!fallbackReason) fallbackReason = "AI 키 없음 — 데모 카드로 폴백";
  }

  return NextResponse.json({
    ok: true,
    cards,
    group: group.label,
    subject,
    topic,
    level,
    fallbackReason,
  });
}
