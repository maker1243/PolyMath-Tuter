import { NextResponse } from "next/server";
import { generate, type ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  level: "beginner" | "intermediate" | "advanced";
  topic: string; // daily, business, travel, academic, …
  count?: number;
  lang?: "en" | "es" | "ja" | "zh" | "fr" | "de"; // 공부할 언어 (기본 en)
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
}

export interface VocabCard {
  word: string; // 외국어 단어/표현
  ipa?: string; // 발음 기호
  meaning: string; // 한국어 뜻
  example: string; // 외국어 예문
  exampleTr: string; // 예문 한국어 번역
}

const LANG_LABELS: Record<string, string> = {
  en: "영어",
  es: "스페인어",
  ja: "일본어",
  zh: "중국어 (간체)",
  fr: "프랑스어",
  de: "독일어",
};

const SYSTEM = `당신은 어학 플래시카드 생성기입니다.
학습자 레벨·주제·언어에 맞춰 외우기 좋은 단어·표현을 만듭니다.

규칙:
- word: 외국어 1~3단어 (너무 흔한 건 beginner, 숙어·고급 표현은 advanced)
- ipa: 국제음성기호 (/..../ 형태). 지원 안 되는 언어면 "" 로.
- meaning: 한국어 뜻 (1문장 이내)
- example: 자연스러운 외국어 예문 1문장
- exampleTr: 그 예문의 한국어 번역
- JSON 배열 외 다른 응답 금지. 설명·헤더·마크다운 코드펜스 금지

응답 형식:
[{"word":"...","ipa":"/.../","meaning":"...","example":"...","exampleTr":"..."}, ...]`;

function parseCards(raw: string): VocabCard[] {
  const trimmed = raw.trim();
  const tryParse = (s: string) => {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr))
        return arr.filter(
          (x) =>
            typeof x?.word === "string" &&
            typeof x?.meaning === "string" &&
            typeof x?.example === "string" &&
            typeof x?.exampleTr === "string",
        ) as VocabCard[];
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

function demoCards(topic: string, lang: string, count: number): VocabCard[] {
  const samples: Record<string, VocabCard[]> = {
    en: [
      { word: "commit", ipa: "/kəˈmɪt/", meaning: "약속하다, (코드를) 등록하다", example: "Please commit your changes before you leave.", exampleTr: "떠나기 전에 변경 사항을 커밋해 주세요." },
      { word: "deadline", ipa: "/ˈdɛdlaɪn/", meaning: "마감일", example: "The deadline is tomorrow at noon.", exampleTr: "마감일은 내일 정오입니다." },
      { word: "overwhelm", ipa: "/ˌoʊvərˈwɛlm/", meaning: "압도하다, 벅차게 하다", example: "The workload overwhelmed her last week.", exampleTr: "지난주 업무량이 그녀를 압도했어요." },
      { word: "schedule", ipa: "/ˈskɛdʒuːl/", meaning: "일정, 일정을 잡다", example: "Let's schedule a call next Monday.", exampleTr: "다음 주 월요일에 통화 일정을 잡읍시다." },
      { word: "straightforward", ipa: "/streɪtˈfɔːrwərd/", meaning: "간단명료한", example: "The instructions are pretty straightforward.", exampleTr: "설명은 꽤 간단명료합니다." },
    ],
    es: [
      { word: "aprender", ipa: "/apɾenˈdeɾ/", meaning: "배우다", example: "Quiero aprender español.", exampleTr: "저는 스페인어를 배우고 싶어요." },
      { word: "desayuno", ipa: "/desaˈʝuno/", meaning: "아침 식사", example: "El desayuno está listo.", exampleTr: "아침 식사가 준비됐어요." },
    ],
    ja: [
      { word: "勉強", ipa: "/ben.kjoː/", meaning: "공부", example: "毎日日本語を勉強します。", exampleTr: "매일 일본어를 공부합니다." },
      { word: "頑張る", ipa: "/gam.ba.ɾɯ/", meaning: "힘내다, 열심히 하다", example: "試験、頑張ってください。", exampleTr: "시험 잘 보세요 (힘내세요)." },
    ],
  };
  const base = samples[lang] ?? samples.en;
  const extras = Array.from({ length: Math.max(0, count - base.length) }, (_, i) => ({
    word: `demo-${topic}-${i + 1}`,
    ipa: "",
    meaning: "⚡ 데모 모드 — 설정에서 AI 공급자 키를 넣으면 실제 생성됩니다.",
    example: "",
    exampleTr: "",
  }));
  return [...base, ...extras].slice(0, count);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const level = body.level ?? "intermediate";
  const topic = (body.topic ?? "daily").toString().slice(0, 60);
  const count = Math.max(3, Math.min(20, body.count ?? 10));
  const lang = body.lang ?? "en";
  const langLabel = LANG_LABELS[lang] ?? lang;

  const userPrompt = [
    `학습 언어: ${langLabel} (코드: ${lang})`,
    `레벨: ${level}`,
    `주제: ${topic}`,
    `카드 개수: 정확히 ${count}개`,
    "",
    `${langLabel} 단어·표현 ${count}개를 플래시카드로 만들어 JSON 배열로만 응답하세요. 각 카드에 word·ipa·meaning·example·exampleTr 포함.`,
  ].join("\n");

  let cards: VocabCard[] = [];
  let fallbackReason: string | undefined;

  if (body.provider && body.apiKey) {
    try {
      const raw = await generate({
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 1800,
        geminiAuth: body.geminiAuth,
      });
      cards = parseCards(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[apps/vocab] AI failed:", msg.slice(0, 200));
      fallbackReason = msg.slice(0, 160);
    }
  }
  if (cards.length === 0) {
    cards = demoCards(topic, lang, count);
    if (!fallbackReason) fallbackReason = "AI 키 없음 — 데모 카드로 폴백";
  }

  return NextResponse.json({ ok: true, cards, lang, level, topic, fallbackReason });
}
