import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { generate, type ProviderId } from "@/lib/providers";
import {
  resetInitialCode,
  roomExists,
  setMission,
  type Mission,
} from "@/lib/collab-store";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  subject: string;
  difficulty: string; // "입문" | "중급" | "고급" (freeform)
  topic?: string;
  language: "javascript" | "python";
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
  // 템플릿 사용 시 — AI 호출 건너뛰고 바로 사용
  template?: {
    title: string;
    description: string;
    initialCode: string;
  };
}

const SYSTEM = `당신은 PolyMath Tutor 의 공동 학습 미션 작성자입니다.
학습자 2~5명이 **한 에디터에서 함께 풀** 짧고 명확한 미션을 설계합니다.

반드시 아래 JSON 1개만 응답하세요. 코드 펜스·설명·여분 텍스트 금지.
{
  "title": "15자 이내의 미션 제목",
  "description": "3~5문장. 왜 흥미로운지, 무엇을 완성해야 성공인지, 어떤 함정이 숨어 있는지.",
  "initialCode": "지정된 언어의 **실행 가능한 시작 코드**. 10~25줄. 미션을 명확히 하도록 함수 시그니처·입출력 예시·TODO 주석 포함."
}`;

function buildUserPrompt(b: Body): string {
  const topic = b.topic?.trim();
  return [
    `과목: ${b.subject}`,
    `난이도: ${b.difficulty}`,
    `언어: ${b.language}`,
    topic ? `세부 주제: ${topic}` : "세부 주제: (자유)",
    "",
    "미션을 설계하고 위 포맷의 JSON 만 응답하세요.",
  ].join("\n");
}

function newRoomId(): string {
  // 짧고 URL-safe, 중복 가능성 낮음 (8 chars base36)
  return randomBytes(5).toString("base64url").toLowerCase().slice(0, 8);
}

function parseJsonLoose(raw: string): {
  title: string;
  description: string;
  initialCode: string;
} | null {
  const trimmed = raw.trim();
  // 1차: 바로 JSON
  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj?.title === "string" && typeof obj?.initialCode === "string")
      return obj;
  } catch {
    /* fallthrough */
  }
  // 2차: 처음 { 부터 마지막 } 추출
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(trimmed.slice(first, last + 1));
      if (typeof obj?.title === "string" && typeof obj?.initialCode === "string")
        return obj;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function demoMission(b: Body): {
  title: string;
  description: string;
  initialCode: string;
} {
  const lang = b.language;
  const topic = b.topic?.trim() || b.subject;
  if (lang === "python") {
    return {
      title: `${topic} 공동 디버깅`,
      description:
        "⚡ 데모 미션입니다. 설정에서 AI 공급자 API 키를 넣으면 실제 Claude/Gemini/Groq 로 생성됩니다.\n아래 함수가 잘못된 결과를 반환합니다. 테스트가 통과하도록 수정하세요. 성능보다 정확성을 먼저 생각하세요.",
      initialCode: `# TODO: 아래 함수가 모든 테스트를 통과하도록 수정하세요.\n# 입력: 정수 리스트  →  출력: 짝수의 합\n\ndef sum_evens(nums):\n    total = 0\n    for n in nums:\n        total += n  # 버그: 짝수만 더해야 함\n    return total\n\nassert sum_evens([1, 2, 3, 4]) == 6\nassert sum_evens([]) == 0\nassert sum_evens([-2, -1, 1, 2]) == 0\nprint("all tests passed")\n`,
    };
  }
  return {
    title: `${topic} 공동 디버깅`,
    description:
      "⚡ 데모 미션입니다. 설정에서 AI 공급자 API 키를 넣으면 실제 Claude/Gemini/Groq 로 생성됩니다.\n아래 함수가 잘못된 결과를 반환합니다. 테스트가 통과하도록 수정하세요. 성능보다 정확성을 먼저 생각하세요.",
    initialCode: `// TODO: 아래 함수가 모든 테스트를 통과하도록 수정하세요.\n// 입력: 숫자 배열  →  출력: 짝수의 합\n\nfunction sumEvens(nums) {\n  let total = 0;\n  for (const n of nums) {\n    total += n; // 버그: 짝수만 더해야 함\n  }\n  return total;\n}\n\nconsole.assert(sumEvens([1, 2, 3, 4]) === 6, "basic");\nconsole.assert(sumEvens([]) === 0, "empty");\nconsole.assert(sumEvens([-2, -1, 1, 2]) === 0, "negatives");\nconsole.log("all tests passed");\n`,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.subject || !body?.difficulty || !body?.language) {
    return NextResponse.json(
      { error: "subject·difficulty·language 필수" },
      { status: 400 },
    );
  }
  if (body.language !== "javascript" && body.language !== "python") {
    return NextResponse.json({ error: "지원하지 않는 언어" }, { status: 400 });
  }

  // 1) 신규 room id 발급 (충돌 시 재시도)
  let roomId = newRoomId();
  for (let i = 0; i < 5 && roomExists(roomId); i++) roomId = newRoomId();

  // 2) template 가 있으면 즉시 사용 (AI 호출 생략)
  let parsed: {
    title: string;
    description: string;
    initialCode: string;
  } | null = body.template ?? null;
  let generatedBy = parsed ? "template" : "demo";
  if (!parsed && body.provider && body.apiKey) {
    try {
      const raw = await generate({
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserPrompt(body) }],
        maxTokens: 1200,
        geminiAuth: body.geminiAuth,
      });
      parsed = parseJsonLoose(raw);
      if (parsed) generatedBy = body.provider;
    } catch (err) {
      console.error("[collab/create] AI generate failed:", err);
    }
  }
  if (!parsed) parsed = demoMission(body);

  // 3) room 생성 (getRoom), initial code 교체 + mission 저장
  resetInitialCode(roomId, parsed.initialCode);
  const mission: Mission = {
    title: parsed.title.slice(0, 120),
    description: parsed.description.slice(0, 2000),
    subject: body.subject.slice(0, 60),
    difficulty: body.difficulty.slice(0, 20),
    language: body.language,
    generatedBy,
    generatedAt: Date.now(),
  };
  setMission(roomId, mission);

  const me = await currentUser();
  if (me) {
    logActivity({
      userId: me.id,
      type: "mission_created",
      roomId,
      meta: { subject: body.subject, difficulty: body.difficulty, language: body.language },
    });
  }

  return NextResponse.json({ ok: true, roomId, mission });
}
