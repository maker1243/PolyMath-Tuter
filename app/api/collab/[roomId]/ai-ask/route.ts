import { NextResponse } from "next/server";
import {
  postAiMessage,
  resolveAiCredentials,
  roomCurrentCode,
} from "@/lib/collab-store";
import { generate, type ProviderId } from "@/lib/providers";
import { currentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-store";
import { expandImageDirectives, type ImageProvider } from "@/lib/image-gen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  question: string;
  selection?: string; // 선택된 코드 영역 (옵셔널)
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
  revealMode?: "socratic" | "direct";
  imageEnabled?: boolean;
  imageProvider?: ImageProvider;
  imageKey?: string;
}

const DIAGRAM_HINT = `
개념 흐름·관계·수식이 복잡하면 그림을 넣으세요:
- 구조·흐름·관계 → \`\`\`mermaid 블럭 (flowchart/sequenceDiagram/classDiagram 등)
- **수학 함수 그래프 (y=x², sin(x) 등)** → \`\`\`plot 블럭 (예: \`y = x^2\` 한 줄에 \`x: -5 to 5\`; sin/cos/log/sqrt/exp 등 지원)
- 좌표계·기하 도형·커스텀 그림 → \`\`\`svg 블럭 (\`<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">\`; script/on* 금지)
클라이언트가 자동으로 렌더링합니다 (외부 이미지 API 아님).`;

const SYSTEM_SOCRATIC = `당신은 PolyMath Tutor 의 **공동 학습 AI 튜터**입니다.
- 참여자 2~5명이 하나의 코드를 함께 보고 있습니다.
- 바로 정답을 주지 말고 **단서 → 원인 → 다음 실험** 순으로 디버깅 힌트를 제시하세요.
- 한국어로, 5문장 이내로 답하세요. 코드 수정이 꼭 필요할 때만 코드 블럭을 쓰세요.${DIAGRAM_HINT}`;

const SYSTEM_DIRECT = `당신은 PolyMath Tutor 의 **공동 학습 AI 튜터**입니다.
- 참여자가 **"건너뛰기 (바로 알려주기)" 모드**를 선택했습니다. 반문·힌트는 접고 직접 답하세요.
- 코드 수정이 필요하면 **수정된 전체 스니펫** 과 변경 포인트를 명시.
- 왜 그 답이 맞는지 **2–4문장**으로 이유 설명.
- 한국어, 코드와 식별자는 원어 유지. 끝에 "👉 다음 단계" 로 더 공부할 포인트 1줄.${DIAGRAM_HINT}`;

function buildPrompt(question: string, code: string, selection?: string): string {
  const parts: string[] = [];
  parts.push("## 공유 코드 (전체)");
  parts.push("```");
  parts.push(code.slice(0, 6000) || "(비어 있음)");
  parts.push("```");
  if (selection && selection.trim().length > 0) {
    parts.push("");
    parts.push("## 질문자가 선택한 영역");
    parts.push("```");
    parts.push(selection.slice(0, 2000));
    parts.push("```");
  }
  parts.push("");
  parts.push("## 질문");
  parts.push(question);
  return parts.join("\n");
}

function demoAnswer(question: string): string {
  return [
    "⚡ 데모 응답입니다 (설정에서 AI 공급자 키를 넣으면 실제 LLM 응답으로 교체됩니다).",
    "",
    `질문 "${question.slice(0, 80)}" 에 대해 함께 짚어볼게요:`,
    "1) 어떤 입력에서 결과가 틀렸는지 가장 작은 반례부터 찾아보세요.",
    "2) 중간 변수에 `console.log` 를 심어 어느 분기에서 값이 어긋나는지 확인해 보세요.",
    "3) 코드의 핵심 가정 1줄을 주석으로 적어보면 어디서 깨지는지 보일 거예요.",
  ].join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } },
) {
  const body = (await req.json()) as Body;
  const question = (body?.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question 필수" }, { status: 400 });
  }

  const code = roomCurrentCode(params.roomId);
  const user = buildPrompt(question, code, body.selection);

  // 요청자 키 > 호스트 지갑 > 데모 폴백
  const creds = resolveAiCredentials(params.roomId, {
    provider: body.provider,
    apiKey: body.apiKey,
    model: body.model,
    geminiAuth: body.geminiAuth,
  });

  let text: string;
  let payerLine = "";
  if (creds) {
    try {
      text = await generate({
        provider: creds.provider,
        apiKey: creds.apiKey,
        model: creds.model,
        system: body.revealMode === "direct" ? SYSTEM_DIRECT : SYSTEM_SOCRATIC,
        messages: [{ role: "user", content: user }],
        maxTokens: 3000,
        geminiAuth: creds.geminiAuth,
      });
      payerLine =
        creds.payer === "host"
          ? `_(⚡ ${creds.provider} · 호스트 지갑: ${creds.payerName ?? "호스트"})_`
          : `_(⚡ ${creds.provider})_`;
    } catch (err) {
      console.error("[ai-ask] generate failed:", err);
      text = demoAnswer(question);
    }
  } else {
    text = demoAnswer(question);
  }

  // 이미지 directive 치환 (활성화되고 패턴이 있을 때만)
  if (body.imageEnabled && /!\[[^\]]*\]\(image-gen:/i.test(text)) {
    try {
      text = await expandImageDirectives(
        text,
        {
          provider: body.imageProvider ?? "pollinations",
          apiKey: body.imageKey,
        },
        { max: 2 },
      );
    } catch (err) {
      console.error("[ai-ask] image expand failed:", err);
    }
  }

  const finalText = payerLine ? `${payerLine}\n\n${text}` : text;
  const msg = postAiMessage(params.roomId, finalText, {
    codeContext: body.selection ?? undefined,
  });
  const me = currentUser();
  if (me) {
    logActivity({
      userId: me.id,
      type: "ai_ask",
      roomId: params.roomId,
      meta: { provider: creds?.provider ?? "demo", payer: creds?.payer ?? "none" },
    });
  }
  return NextResponse.json({ ok: true, message: msg });
}
