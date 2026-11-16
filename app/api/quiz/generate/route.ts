import { NextResponse } from "next/server";
import { generate, resolveCredentials, type ProviderId } from "@/lib/providers";
import { demoQuiz } from "@/lib/demo-responses";
import type { QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  topic?: string;
  context?: string;
  count?: number;
  level?: "beginner" | "intermediate" | "advanced";
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
}

const QUIZ_SYSTEM = `당신은 학습 자료 기반 퀴즈 출제 엔진입니다.
반드시 아래 JSON 스키마를 지키는 배열만 출력하세요. 설명·머리말 금지:
[
  {
    "prompt": "문제 (한국어)",
    "choices": ["보기1","보기2","보기3","보기4"],
    "answerIndex": 0,
    "explanation": "정답 해설 (한국어, 2~3문장)"
  }
]`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const count = Math.min(Math.max(body.count ?? 3, 1), 10);
    const level = body.level ?? "intermediate";
    const topic = body.topic ?? "일반 CS 상식";

    const creds = resolveCredentials(body);
    if (!creds) {
      return NextResponse.json({ questions: demoQuiz(topic, count), demo: true });
    }

    const userPrompt = `주제: ${topic}
난이도: ${level}
문항 수: ${count}개

${body.context ? `참고 자료:\n${body.context.slice(0, 6000)}` : ""}

위 조건에 맞춰 4지선다 객관식 퀴즈를 JSON 배열로만 출력하세요.`;

    const text = await generate({
      ...creds,
      system: QUIZ_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 2048,
    });

    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "모델 출력 파싱 실패", raw: text }, { status: 502 });
    }

    const questions: QuizQuestion[] = parsed.filter(isQuestionShape).map((q, i) => ({
      id: `g-${Date.now()}-${i}`,
      prompt: String(q.prompt),
      choices: q.choices.map(String).slice(0, 4),
      answerIndex: clamp(Number(q.answerIndex), 0, 3),
      explanation: String(q.explanation ?? ""),
    }));

    return NextResponse.json({ questions, provider: creds.provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isQuestionShape(x: unknown): x is {
  prompt: unknown;
  choices: unknown[];
  answerIndex: unknown;
  explanation?: unknown;
} {
  return (
    typeof x === "object" &&
    x !== null &&
    "prompt" in x &&
    "choices" in x &&
    Array.isArray((x as { choices: unknown }).choices) &&
    "answerIndex" in x
  );
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}
