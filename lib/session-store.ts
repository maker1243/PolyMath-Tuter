"use client";

import type { LearningMode, LearningSource, SkillLevel } from "./types";

export interface LearningSession {
  id: string;
  createdAt: string;
  mode: LearningMode;
  level: SkillLevel;
  goal: string;
  subjects: string[];
  sources: Array<LearningSource & { preview: string }>;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: LearningMode;
  level: SkillLevel;
  goal: string;
  subjects: string[];
  messageCount: number;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
}

const KEY_PREFIX = "polymath:session:";
const MSG_PREFIX = "polymath:session-msgs:";
const INDEX_KEY = "polymath:session-index";

/* ---------- 세션 인덱스 (최근순) ---------- */

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    /* storage full — index drops */
  }
}

function touchIndex(id: string) {
  const idx = readIndex().filter((x) => x !== id);
  idx.unshift(id);
  // 최대 100개 세션 보관 — 넘으면 가장 오래된 것부터 삭제
  const trimmed = idx.slice(0, 100);
  const dropped = idx.slice(100);
  for (const d of dropped) {
    try {
      window.localStorage.removeItem(`${KEY_PREFIX}${d}`);
      window.localStorage.removeItem(`${MSG_PREFIX}${d}`);
    } catch {
      /* ignore */
    }
  }
  writeIndex(trimmed);
}

/* ---------- 세션 메타 ---------- */

export function saveSession(session: LearningSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${KEY_PREFIX}${session.id}`,
      JSON.stringify(session),
    );
    touchIndex(session.id);
  } catch {
    /* storage may be full or disabled — session falls back to in-memory only */
  }
}

/** 어떤 구포맷/손상된 payload 가 들어와도 안전하게 LearningSession 으로 정규화.
 *  구 포맷이 subjects/sources 를 아예 안 가진 경우를 대비해 기본값을 채워 둠. */
function normalizeSession(raw: unknown, id: string): LearningSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LearningSession>;
  return {
    id: typeof r.id === "string" ? r.id : id,
    createdAt:
      typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    mode: (r.mode ?? "single") as LearningMode,
    level: (r.level ?? "intermediate") as SkillLevel,
    goal: typeof r.goal === "string" ? r.goal : "",
    subjects: Array.isArray(r.subjects)
      ? r.subjects.filter((x): x is string => typeof x === "string")
      : [],
    sources: Array.isArray(r.sources) ? r.sources : [],
  };
}

export function loadSession(id: string): LearningSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw), id);
  } catch {
    return null;
  }
}

/* ---------- 세션 메시지 (영구 저장) ---------- */

export function saveMessages(sessionId: string, messages: StoredMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${MSG_PREFIX}${sessionId}`,
      JSON.stringify({ messages, updatedAt: new Date().toISOString() }),
    );
    touchIndex(sessionId);
  } catch {
    /* storage full — try to free space by dropping the oldest session */
    const idx = readIndex();
    const oldest = idx[idx.length - 1];
    if (oldest && oldest !== sessionId) {
      deleteSession(oldest);
      // 한 번 더 시도
      try {
        window.localStorage.setItem(
          `${MSG_PREFIX}${sessionId}`,
          JSON.stringify({ messages, updatedAt: new Date().toISOString() }),
        );
      } catch {
        /* give up */
      }
    }
  }
}

export function loadMessages(sessionId: string): {
  messages: StoredMessage[];
  updatedAt?: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${MSG_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      messages?: StoredMessage[];
      updatedAt?: string;
    };
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function deleteSession(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${KEY_PREFIX}${sessionId}`);
    window.localStorage.removeItem(`${MSG_PREFIX}${sessionId}`);
    writeIndex(readIndex().filter((x) => x !== sessionId));
  } catch {
    /* ignore */
  }
}

/* ---------- 복습용 세션 요약 리스트 ---------- */

/* ---------- 세션 검색 (모든 메시지 가로질러) ---------- */

export interface SessionSearchHit {
  summary: SessionSummary;
  matches: Array<{
    messageId: string;
    role: "user" | "assistant" | "system";
    excerpt: string;
    createdAt: string;
  }>;
}

/**
 * 모든 세션의 메시지를 대상으로 키워드 검색.
 * - case-insensitive
 * - 매치된 위치 전후 60~80자 스니펫 반환 (하이라이트는 UI 쪽)
 * - 비주얼 블럭 (```mermaid 등) 내부는 제외하고 검색 (노이즈 제거)
 */
export function searchSessions(
  query: string,
  opts?: { perSessionLimit?: number; totalLimit?: number },
): SessionSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const perSessionLimit = opts?.perSessionLimit ?? 3;
  const totalLimit = opts?.totalLimit ?? 30;
  const ids = readIndex();
  const hits: SessionSearchHit[] = [];
  for (const id of ids) {
    const msgData = loadMessages(id);
    if (!msgData) continue;
    const matches: SessionSearchHit["matches"] = [];
    for (const m of msgData.messages) {
      if (matches.length >= perSessionLimit) break;
      // 비주얼 블럭 제거 (검색 노이즈)
      const cleaned = m.content
        .replace(/```[\s\S]*?```/g, " [시각화] ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " [이미지] ");
      const haystack = cleaned.toLowerCase();
      const pos = haystack.indexOf(q);
      if (pos < 0) continue;
      const before = Math.max(0, pos - 60);
      const after = Math.min(cleaned.length, pos + q.length + 80);
      let excerpt = cleaned.slice(before, after).trim();
      if (before > 0) excerpt = "…" + excerpt;
      if (after < cleaned.length) excerpt = excerpt + "…";
      matches.push({
        messageId: m.id,
        role: m.role,
        excerpt,
        createdAt: m.createdAt,
      });
    }
    if (matches.length === 0) continue;
    const session = loadSession(id);
    const firstUser = msgData.messages.find((m) => m.role === "user");
    const lastAssistant = [...msgData.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim().length > 0);
    hits.push({
      summary: {
        id,
        createdAt:
          session?.createdAt ??
          msgData.messages[0]?.createdAt ??
          new Date().toISOString(),
        updatedAt: msgData.updatedAt ?? new Date().toISOString(),
        mode: session?.mode ?? "single",
        level: session?.level ?? "intermediate",
        goal: session?.goal ?? "",
        subjects: session?.subjects ?? [],
        messageCount: msgData.messages.length,
        firstUserMessage: firstUser?.content.slice(0, 160),
        lastAssistantMessage: lastAssistant?.content.slice(0, 200),
      },
      matches,
    });
    if (hits.length >= totalLimit) break;
  }
  return hits;
}

export function listSessions(limit?: number): SessionSummary[] {
  if (typeof window === "undefined") return [];
  const ids = readIndex();
  const summaries: SessionSummary[] = [];
  for (const id of ids) {
    const session = loadSession(id);
    const msgData = loadMessages(id);
    if (!session && !msgData) continue; // 인덱스엔 있지만 데이터 없음 — 스킵
    const messages = msgData?.messages ?? [];
    const firstUser = messages.find((m) => m.role === "user");
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim().length > 0);
    summaries.push({
      id,
      createdAt: session?.createdAt ?? messages[0]?.createdAt ?? new Date().toISOString(),
      updatedAt: msgData?.updatedAt ?? session?.createdAt ?? new Date().toISOString(),
      mode: session?.mode ?? "single",
      level: session?.level ?? "intermediate",
      goal: session?.goal ?? "",
      subjects: session?.subjects ?? [],
      messageCount: messages.length,
      firstUserMessage: firstUser?.content.slice(0, 160),
      lastAssistantMessage: lastAssistant?.content.slice(0, 200),
    });
  }
  return typeof limit === "number" ? summaries.slice(0, limit) : summaries;
}

/** 세션에 쌓인 자료들을 Claude 시스템 프롬프트의 컨텍스트 블록으로 압축. */
export function buildContextBlock(session: LearningSession): string {
  const parts: string[] = [];

  if (session.subjects.length) {
    parts.push(
      `선택한 과목: ${session.subjects.join(", ")}
자료 없이 과목 중심으로 학습이 시작되었습니다. 커리큘럼의 핵심 개념을 질문·예시로 안내해 주세요.`,
    );
  }

  if (session.sources.length) {
    const lines: string[] = [
      `학습 자료 ${session.sources.length}개가 세션에 포함되어 있습니다.`,
    ];
    for (const s of session.sources) {
      const head = s.preview.slice(0, 1200);
      lines.push(
        `\n--- [${s.kind.toUpperCase()}] ${s.name} ---\n${head}${
          s.preview.length > 1200 ? "\n…(생략)" : ""
        }`,
      );
    }
    parts.push(lines.join("\n"));
  }

  return parts.join("\n\n");
}

/** 파일을 텍스트로 읽어들입니다 (브라우저 File API). PDF 는 바이트 미리보기만. */
export async function readSourceContent(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return `[PDF ${(file.size / 1024).toFixed(1)}KB] — 서버에서 파싱이 필요합니다.`;
  }
  try {
    const text = await file.text();
    return text.length > 20000 ? text.slice(0, 20000) + "\n…(파일이 너무 커 일부만)" : text;
  } catch {
    return "(텍스트 추출 실패)";
  }
}
