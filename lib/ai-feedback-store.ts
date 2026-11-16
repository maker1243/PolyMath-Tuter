import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { dataPath } from "./data-dir";

export type FeedbackCategory =
  | "wrong"       // 사실/논리 오류
  | "unclear"     // 설명이 모호함
  | "off-topic"   // 질문과 어긋남
  | "too-long"    // 너무 장황함
  | "too-short"   // 너무 짧거나 피상적
  | "other";

export interface AiFeedback {
  id: string;
  userId: string | null;  // 익명이면 null
  pid: string;            // collab pid (익명 사용자 추적)
  roomId: string;
  messageId: string;
  rating: "up" | "down";
  reason?: string;
  category?: FeedbackCategory;
  question?: string;      // 직전 사용자 질문 (있으면)
  answerPreview?: string; // AI 답변 앞부분
  provider?: string;      // claude / gemini / groq / demo / template
  at: number;
}

interface FeedbackFile {
  version: 1;
  items: AiFeedback[];
}

const PATH = dataPath("ai-feedback.json");
const MAX_ITEMS = 10_000;

const g = process as unknown as {
  __polymathFeedback?: AiFeedback[];
  __polymathFeedbackLoaded?: boolean;
  __polymathFeedbackTimer?: NodeJS.Timeout | null;
};

function store(): AiFeedback[] {
  if (!g.__polymathFeedback) g.__polymathFeedback = [];
  if (!g.__polymathFeedbackLoaded) {
    g.__polymathFeedbackLoaded = true;
    try {
      const raw = readFileSync(PATH, "utf8");
      const data = JSON.parse(raw) as FeedbackFile;
      if (data.version === 1 && Array.isArray(data.items)) {
        g.__polymathFeedback.push(...data.items);
      }
    } catch {
      /* ignore */
    }
  }
  return g.__polymathFeedback;
}

function scheduleSave() {
  if (g.__polymathFeedbackTimer) clearTimeout(g.__polymathFeedbackTimer);
  g.__polymathFeedbackTimer = setTimeout(() => {
    g.__polymathFeedbackTimer = null;
    try {
      const items = store();
      const data: FeedbackFile = { version: 1, items };
      mkdirSync(dirname(PATH), { recursive: true });
      const tmp = PATH + ".tmp";
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, PATH);
    } catch (err) {
      console.error("[ai-feedback] save failed:", err);
    }
  }, 500);
  (g.__polymathFeedbackTimer as unknown as { unref?: () => void }).unref?.();
}

export function recordFeedback(input: {
  userId: string | null;
  pid: string;
  roomId: string;
  messageId: string;
  rating: "up" | "down";
  reason?: string;
  category?: FeedbackCategory;
  question?: string;
  answerPreview?: string;
  provider?: string;
}): AiFeedback {
  const items = store();
  // 같은 (userId or pid, messageId) 피드백은 1개만 — upsert
  const existingIdx = items.findIndex(
    (f) =>
      f.messageId === input.messageId &&
      ((input.userId && f.userId === input.userId) ||
        (!input.userId && f.pid === input.pid)),
  );
  const fb: AiFeedback = {
    id:
      existingIdx >= 0 ? items[existingIdx].id : randomUUID(),
    userId: input.userId,
    pid: input.pid,
    roomId: input.roomId,
    messageId: input.messageId,
    rating: input.rating,
    reason: input.reason?.trim().slice(0, 500),
    category: input.category,
    question: input.question?.slice(0, 1000),
    answerPreview: input.answerPreview?.slice(0, 500),
    provider: input.provider?.slice(0, 24),
    at: Date.now(),
  };
  if (existingIdx >= 0) items[existingIdx] = fb;
  else {
    items.push(fb);
    if (items.length > MAX_ITEMS) items.splice(0, items.length - MAX_ITEMS);
  }
  scheduleSave();
  return fb;
}

/** userId 기준 피드백 조회 (익명은 포함 안 함) */
export function listUserFeedback(
  userId: string,
  opts?: { limit?: number; onlyNegative?: boolean },
): AiFeedback[] {
  const items = store()
    .filter((f) => f.userId === userId)
    .filter((f) => (opts?.onlyNegative ? f.rating === "down" : true))
    .sort((a, b) => b.at - a.at);
  return opts?.limit ? items.slice(0, opts.limit) : items;
}

export interface FeedbackStats {
  total: number;
  up: number;
  down: number;
  upRate: number; // 0-1
  byCategory: Record<FeedbackCategory, number>;
  byProvider: Record<string, { up: number; down: number }>;
  recentNegative: AiFeedback[];
}

const EMPTY_CATEGORY: Record<FeedbackCategory, number> = {
  wrong: 0,
  unclear: 0,
  "off-topic": 0,
  "too-long": 0,
  "too-short": 0,
  other: 0,
};

export function userFeedbackStats(userId: string): FeedbackStats {
  const items = store().filter((f) => f.userId === userId);
  const up = items.filter((f) => f.rating === "up").length;
  const down = items.filter((f) => f.rating === "down").length;
  const total = up + down;
  const byCategory: Record<FeedbackCategory, number> = { ...EMPTY_CATEGORY };
  for (const f of items) {
    if (f.category) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  const byProvider: Record<string, { up: number; down: number }> = {};
  for (const f of items) {
    const p = f.provider ?? "unknown";
    if (!byProvider[p]) byProvider[p] = { up: 0, down: 0 };
    byProvider[p][f.rating] += 1;
  }
  const recentNegative = items
    .filter((f) => f.rating === "down")
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  return {
    total,
    up,
    down,
    upRate: total === 0 ? 0 : up / total,
    byCategory,
    byProvider,
    recentNegative,
  };
}
