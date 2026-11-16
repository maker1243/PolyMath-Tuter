/**
 * ANTHROPIC_API_KEY 가 없을 때 사용되는 데모 응답.
 * UI 플로우를 끊지 않고, 실제 Claude 호출로 교체되기 전까지 플레이스홀더 역할을 합니다.
 */

import type { ConceptCard, QuizQuestion } from "./types";

const DEMO_BANNER =
  "⚡ 데모 모드 응답입니다. .env.local 에 ANTHROPIC_API_KEY 를 넣으면 실제 Claude 응답으로 바뀝니다.";

export function demoTutorReply(opts: {
  context?: string;
  lastUserMessage: string;
  withImageGen?: boolean;
}): string {
  const { context, lastUserMessage, withImageGen } = opts;
  const topicLine = extractTopicHint(context);
  const subject = (context ?? "") + " " + (lastUserMessage ?? "");
  const subjectBlock = buildSubjectDemoBlock(subject);
  const lines = [
    DEMO_BANNER,
    "",
    "좋은 질문이에요. 바로 답을 드리는 대신 함께 짚어볼게요:",
    "",
    `1) **어디부터 좁힐까요?** — \"${trim(lastUserMessage, 60)}\" 에서 가장 자신 없는 부분을 한 문장으로 적어볼 수 있을까요?`,
    "2) **반례로 확인하기** — 가정이 깨지는 가장 간단한 예시를 하나 떠올려 보세요.",
    topicLine
      ? `3) **오늘의 축** — ${topicLine} 의 핵심을 한 줄 정의로 바꿔보면 어떤 문장이 될까요?`
      : "3) **한 줄 정의** — 지금 다루는 주제를 한 문장으로 정의할 수 있다면, 그 문장을 적어주세요.",
    "",
    ...subjectBlock,
    "",
    "학습 흐름을 정리하면 아래와 같아요:",
    "",
    "```mermaid",
    "flowchart LR",
    '  Q["질문"] --> H["단서/힌트"]',
    '  H --> T["직접 시도"]',
    '  T --> R{"풀렸나?"}',
    '  R -->|예| N["다음 개념"]',
    '  R -->|아니오| Q',
    "```",
    "",
    "그리고 \"반례\" 그래프의 느낌은 이렇게 생겼죠:",
    "",
    "```svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">',
    '  <line x1="20" y1="170" x2="300" y2="170" stroke="#8891a3" stroke-width="2"/>',
    '  <line x1="20" y1="20" x2="20" y2="170" stroke="#8891a3" stroke-width="2"/>',
    '  <polyline points="20,170 80,120 140,90 200,70 260,30" fill="none" stroke="#22d3b4" stroke-width="2"/>',
    '  <circle cx="200" cy="70" r="4" fill="#5b7cfa"/>',
    '  <text x="210" y="68" fill="#e8ecf4" font-size="10">반례 발견</text>',
    '  <text x="160" y="190" fill="#e8ecf4" font-size="10" text-anchor="middle">시도 횟수 →</text>',
    "</svg>",
    "```",
    "",
    withImageGen
      ? "\n학습하는 두뇌의 느낌을 사진으로도 보여드릴게요:"
      : "",
    withImageGen
      ? "\n![학습하는 두뇌](image-gen:a glowing human brain with neural pathways, cinematic lighting)"
      : "",
    "",
    "답을 적어주시면 그 지점에서 다음 힌트를 이어가겠습니다.",
  ].filter((line) => line !== "");
  return lines.join("\n");
}

export function demoTutorChunks(opts: {
  context?: string;
  lastUserMessage: string;
  withImageGen?: boolean;
}): string[] {
  const full = demoTutorReply(opts);
  const chunks: string[] = [];
  for (let i = 0; i < full.length; i += 18) {
    chunks.push(full.slice(i, i + 18));
  }
  return chunks;
}

export function demoQuiz(topic: string, count: number): QuizQuestion[] {
  const base: QuizQuestion[] = [
    {
      id: "demo-q1",
      prompt: `[데모] "${topic}" 와 가장 가까운 설명은?`,
      choices: [
        "입력-출력 관계만 외우는 것",
        "핵심 원리를 반례와 함께 이해하는 것",
        "용어의 영어 표기를 암기하는 것",
        "유행어로 설명을 바꾸는 것",
      ],
      answerIndex: 1,
      explanation: "학습의 핵심은 원리 이해와 반례 테스트입니다. 암기만으로는 응용이 어렵습니다.",
    },
    {
      id: "demo-q2",
      prompt: `[데모] ${topic} 공부에서 가장 먼저 던질 질문은?`,
      choices: [
        "이게 왜 문제가 되는가?",
        "이 주제의 역사는?",
        "유명한 교재 저자는 누구인가?",
        "책의 두께는 몇 페이지인가?",
      ],
      answerIndex: 0,
      explanation: "모든 학습은 '왜 중요한가'에서 시작할 때 가장 오래 남습니다.",
    },
    {
      id: "demo-q3",
      prompt: `[데모] 소크라테스식 디버깅의 핵심 특징은?`,
      choices: [
        "정답을 가장 빠르게 알려준다",
        "학습자가 스스로 오류를 찾도록 질문을 던진다",
        "컴파일러 메시지를 직역한다",
        "코드 전체를 삭제하고 다시 시작한다",
      ],
      answerIndex: 1,
      explanation: "소크라테스식 방법은 질문으로 사고를 유도해 학습 전이력을 높입니다.",
    },
    {
      id: "demo-q4",
      prompt: `[데모] 복습 간격을 조절하는 '망각 곡선'의 핵심 통찰은?`,
      choices: [
        "한 번만 보면 평생 기억난다",
        "시간이 지날수록 기억이 지수적으로 감쇠한다",
        "복습은 효과가 없다",
        "기억은 뇌 밖에 저장된다",
      ],
      answerIndex: 1,
      explanation: "Ebbinghaus 는 복습 간격이 멀어질수록 유지율이 급락함을 보였고, 간격 반복이 그 해법입니다.",
    },
    {
      id: "demo-q5",
      prompt: `[데모] 융합 학습의 가장 큰 이점은?`,
      choices: [
        "한 과목만 깊이 아는 것",
        "서로 다른 영역의 패턴이 연결되어 응용력이 커지는 것",
        "과제가 더 쉬워지는 것",
        "시험 범위가 줄어드는 것",
      ],
      answerIndex: 1,
      explanation: "두 영역의 모델을 함께 다루면 각각의 공백이 서로의 반례로 작동해 이해가 공고해집니다.",
    },
  ];
  return base.slice(0, Math.max(1, Math.min(count, base.length)));
}

export function demoConceptCards(count: number): ConceptCard[] {
  const base: ConceptCard[] = [
    {
      id: "demo-c1",
      title: "[데모] 소크라테스식 디버깅",
      summary:
        "정답을 바로 제시하지 않고 '어디를 먼저 살펴볼까?'와 같은 질문을 통해 학습자의 메타인지를 자극하는 방법.",
      vocabulary: [
        { term: "메타인지", gloss: "자신의 사고 과정을 인식·조절하는 능력" },
      ],
      level: "intermediate",
    },
    {
      id: "demo-c2",
      title: "[데모] 망각 곡선",
      summary:
        "기억은 시간에 따라 지수적으로 감쇠하며, 적절한 간격으로 복습하면 유지율을 끌어올릴 수 있다.",
      vocabulary: [
        { term: "간격 반복", gloss: "학습 간격을 조절해 장기 기억을 강화하는 기법" },
      ],
      level: "intermediate",
    },
    {
      id: "demo-c3",
      title: "[데모] 융합 학습",
      summary:
        "서로 다른 분야의 모델을 겹쳐 다루며 패턴을 연결, 응용력과 전이력을 키우는 접근.",
      vocabulary: [{ term: "전이력", gloss: "학습한 내용을 새로운 문제에 적용하는 힘" }],
      level: "intermediate",
    },
    {
      id: "demo-c4",
      title: "[데모] 능동적 상기",
      summary: "책을 다시 읽기보다 스스로 떠올려 보는 과정이 기억 보존에 훨씬 효과적이다.",
      vocabulary: [{ term: "retrieval practice", gloss: "회상 기반 복습" }],
      level: "intermediate",
    },
  ];
  return base.slice(0, Math.max(1, Math.min(count, base.length)));
}

/** 과목·질문 내용에 따라 데모용 비주얼 블럭을 선택. */
function buildSubjectDemoBlock(mix: string): string[] {
  const text = mix.toLowerCase();
  // 어학
  if (/영어|english/.test(text)) {
    return [
      "영어 예시 문장 — 🔊 재생 버튼으로 원어민 발음을 들을 수 있어요:",
      "",
      "```tts",
      "lang: en-US",
      "Nice to meet you. Where are you from?",
      "tr: 만나서 반가워요. 어디서 오셨어요?",
      "```",
      "",
      "핵심 단어의 발음 기호:",
      "",
      "```ipa",
      "nice /naɪs/",
      "meet /miːt/",
      "where /wɛər/",
      "```",
    ];
  }
  if (/스페인|español|spanish|spain/i.test(mix)) {
    return [
      "스페인어 예시 — 🔊 재생 버튼으로 원어민 발음을 들을 수 있어요:",
      "",
      "```tts",
      "lang: es-ES",
      "¿Cómo estás? Estoy muy bien, gracias.",
      "tr: 어떻게 지내요? 아주 잘 지내요, 감사합니다.",
      "```",
      "",
      "자주 쓰는 인사 발음:",
      "",
      "```ipa",
      "hola /ˈola/",
      "gracias /ˈɡɾasjas/",
      "buenos días /ˈbwenos ˈdias/",
      "```",
    ];
  }
  if (/일본|japanese|日本/i.test(mix)) {
    return [
      "일본어 예시:",
      "",
      "```tts",
      "lang: ja-JP",
      "今日は何を勉強しますか？",
      "tr: 오늘은 무엇을 공부하실 건가요?",
      "```",
    ];
  }
  if (/중국|chinese|中文/i.test(mix)) {
    return [
      "중국어 예시:",
      "",
      "```tts",
      "lang: zh-CN",
      "你今天学什么?",
      "tr: 오늘 뭐 공부해요?",
      "```",
    ];
  }
  // 한문·고전
  if (/한문|한자|논어|맹자|대학|중용|한시|사기|열전|고사성어|서예|고전/i.test(mix)) {
    return [
      "논어 학이편의 첫 구절을 함께 읽어볼게요:",
      "",
      "```hanja",
      "title: 논어 학이편 1장",
      "原: 學而時習之, 不亦說乎.",
      "音: 학이시습지, 불역열호.",
      "拼音: Xué ér shí xí zhī, bù yì yuè hū.",
      "譯: 배우고 때로 익히면 또한 기쁘지 아니한가.",
      "註: 時는 '적절한 때'를 뜻하고, 說(설)은 悅과 통용되어 '기쁘다'로 읽습니다.",
      "```",
      "",
      "학(學) 한 글자부터 살펴볼까요?",
      "",
      "```hanja",
      "字: 學",
      "音: 학",
      "뜻: 배우다",
      "拼音: xué",
      "部首: 子 (아들 자)",
      "畫: 16",
      "註: 윗부분은 두 손이 책·효(爻)를 받드는 모양, 아래 '子'는 어린이. '배우다·학문·학자'로 뜻이 퍼짐.",
      "```",
    ];
  }
  // 경제·통계
  if (/경제|통계|회계|금융|거시|미시|gdp/i.test(mix)) {
    return [
      "분기별 매출 흐름을 차트로 보여드릴게요:",
      "",
      "```chart",
      "type: bar",
      "title: 2024 분기별 매출 (억원)",
      "labels: Q1, Q2, Q3, Q4",
      "data: 120, 150, 180, 210",
      "```",
      "",
      "지역 분포는 파이로:",
      "",
      "```chart",
      "type: pie",
      "title: 지역별 사용자 비율",
      "서울: 48",
      "부산: 15",
      "대구: 10",
      "기타: 27",
      "```",
    ];
  }
  // 기본 — 함수 그래프 데모
  return [
    "함수 공부용 예시 — \\(y = x^2\\) 와 \\(y = \\sin(x)\\) 를 그려 봤어요:",
    "",
    "```plot",
    "f(x) = x^2       # 포물선",
    "g(x) = sin(x)*5  # 사인파 (×5 로 스케일)",
    "x: -5 to 5",
    "title: 포물선 vs 사인파",
    "```",
  ];
}

function extractTopicHint(context?: string): string {
  if (!context) return "";
  const m = context.match(/선택한 과목:\s*([^\n]+)/);
  if (m) return m[1].trim();
  const g = context.match(/목표:\s*([^\n,]+)/);
  if (g) return g[1].trim();
  return "";
}

function trim(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
