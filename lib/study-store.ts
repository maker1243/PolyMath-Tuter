import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { dataPath } from "./data-dir";

export type SourceKind = "note" | "pdf" | "url" | "code";

export interface Source {
  id: string;
  userId: string;
  title: string;
  content: string;
  kind: SourceKind;
  createdAt: number;
  // 공유 (옵셔널)
  isPublic?: boolean;
  publicSlug?: string;
  publishedAt?: number;
  copyCount?: number;      // 다른 사용자가 복제한 횟수
  publisherName?: string;  // UI 노출용 (공개 시 스냅샷)
}

export interface Flashcard {
  id: string;
  userId: string;
  sourceId?: string;
  front: string;
  back: string;
  tags: string[];
  // SM-2 SRS 상태
  ease: number;        // 쉬움 계수 (최소 1.3, 기본 2.5)
  interval: number;    // 다음 복습까지 일 수 (최소 1)
  reps: number;        // 연속 성공 횟수
  lapses: number;      // "again" 횟수
  dueAt: number;       // 다음 복습 시각 (ms)
  createdAt: number;
  lastReviewedAt?: number;
}

export type Rating = "again" | "hard" | "good" | "easy";

interface StudyFile {
  version: 1;
  sources: Source[];
  cards: Flashcard[];
}

const STUDY_PATH = dataPath("study.json");

const g = process as unknown as {
  __polymathStudy?: {
    sources: Map<string, Source>;
    cards: Map<string, Flashcard>;
    loaded: boolean;
  };
  __polymathStudyTimer?: NodeJS.Timeout | null;
};

function state() {
  if (!g.__polymathStudy) {
    g.__polymathStudy = {
      sources: new Map(),
      cards: new Map(),
      loaded: false,
    };
  }
  const s = g.__polymathStudy;
  if (!s.loaded) {
    s.loaded = true;
    try {
      const raw = readFileSync(STUDY_PATH, "utf8");
      const data = JSON.parse(raw) as StudyFile;
      if (data.version === 1) {
        for (const src of data.sources ?? []) s.sources.set(src.id, src);
        for (const c of data.cards ?? []) s.cards.set(c.id, c);
      }
    } catch {
      /* 파일 없음 OK */
    }
  }
  return s;
}

function scheduleSave() {
  if (g.__polymathStudyTimer) clearTimeout(g.__polymathStudyTimer);
  g.__polymathStudyTimer = setTimeout(() => {
    g.__polymathStudyTimer = null;
    try {
      const s = state();
      const data: StudyFile = {
        version: 1,
        sources: Array.from(s.sources.values()),
        cards: Array.from(s.cards.values()),
      };
      mkdirSync(dirname(STUDY_PATH), { recursive: true });
      const tmp = STUDY_PATH + ".tmp";
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, STUDY_PATH);
    } catch (err) {
      console.error("[study] save failed:", err);
    }
  }, 500);
  (g.__polymathStudyTimer as unknown as { unref?: () => void }).unref?.();
}

// ─────────────────────────── Sources ───────────────────────────

export function listSources(userId: string): Source[] {
  return Array.from(state().sources.values())
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function createSource(input: {
  userId: string;
  title: string;
  content: string;
  kind: SourceKind;
}): Source {
  const src: Source = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.slice(0, 120),
    content: input.content.slice(0, 100_000),
    kind: input.kind,
    createdAt: Date.now(),
  };
  state().sources.set(src.id, src);
  scheduleSave();
  return src;
}

function newSlug(): string {
  return randomBytes(5).toString("base64url").toLowerCase().slice(0, 8);
}

export function publishSource(
  userId: string,
  sourceId: string,
  publisherName: string,
): Source | null {
  const s = state();
  const src = s.sources.get(sourceId);
  if (!src || src.userId !== userId) return null;
  if (!src.publicSlug) {
    let slug = newSlug();
    const taken = new Set(
      Array.from(s.sources.values())
        .map((x) => x.publicSlug)
        .filter((x): x is string => !!x),
    );
    for (let i = 0; i < 5 && taken.has(slug); i++) slug = newSlug();
    src.publicSlug = slug;
  }
  src.isPublic = true;
  src.publishedAt = Date.now();
  src.publisherName = publisherName.slice(0, 40);
  src.copyCount = src.copyCount ?? 0;
  scheduleSave();
  return src;
}

export function unpublishSource(
  userId: string,
  sourceId: string,
): Source | null {
  const s = state();
  const src = s.sources.get(sourceId);
  if (!src || src.userId !== userId) return null;
  src.isPublic = false;
  scheduleSave();
  return src;
}

export interface PublicDeck {
  slug: string;
  title: string;
  content: string;
  kind: SourceKind;
  publisherName: string;
  publishedAt: number;
  copyCount: number;
  cards: { front: string; back: string }[];
  totalCards: number;
}

export function getPublicDeck(slug: string): PublicDeck | null {
  const src = Array.from(state().sources.values()).find(
    (s) => s.publicSlug === slug && s.isPublic,
  );
  if (!src) return null;
  const cards = Array.from(state().cards.values()).filter(
    (c) => c.sourceId === src.id,
  );
  return {
    slug,
    title: src.title,
    content: src.content.slice(0, 2000),
    kind: src.kind,
    publisherName: src.publisherName ?? "익명",
    publishedAt: src.publishedAt ?? 0,
    copyCount: src.copyCount ?? 0,
    cards: cards.slice(0, 100).map((c) => ({ front: c.front, back: c.back })),
    totalCards: cards.length,
  };
}

/** 공개 덱을 로그인 사용자에게 복제 — Source + 모든 Card. SRS 상태는 초기화. */
export function copyDeckToUser(
  slug: string,
  newUserId: string,
): { sourceId: string; cardCount: number } | null {
  const s = state();
  const src = Array.from(s.sources.values()).find(
    (x) => x.publicSlug === slug && x.isPublic,
  );
  if (!src) return null;
  const cards = Array.from(s.cards.values()).filter(
    (c) => c.sourceId === src.id,
  );
  const now = Date.now();
  // Source 복제 — publicSlug·isPublic 등은 제거
  const newSrc: Source = {
    id: randomUUID(),
    userId: newUserId,
    title: `${src.title} (복사)`.slice(0, 120),
    content: src.content,
    kind: src.kind,
    createdAt: now,
  };
  s.sources.set(newSrc.id, newSrc);
  // 카드 복제 — SRS 상태 초기화
  let cardCount = 0;
  for (const c of cards) {
    const newCard: Flashcard = {
      id: randomUUID(),
      userId: newUserId,
      sourceId: newSrc.id,
      front: c.front,
      back: c.back,
      tags: c.tags,
      ease: 2.5,
      interval: 0,
      reps: 0,
      lapses: 0,
      dueAt: now,
      createdAt: now,
    };
    s.cards.set(newCard.id, newCard);
    cardCount += 1;
  }
  src.copyCount = (src.copyCount ?? 0) + 1;
  scheduleSave();
  return { sourceId: newSrc.id, cardCount };
}

export function deleteSource(userId: string, sourceId: string): boolean {
  const s = state();
  const src = s.sources.get(sourceId);
  if (!src || src.userId !== userId) return false;
  s.sources.delete(sourceId);
  // 연결된 카드의 sourceId 는 유지 (orphan OK) — 카드 자체는 삭제 안 함
  scheduleSave();
  return true;
}

export function getSource(userId: string, sourceId: string): Source | null {
  const src = state().sources.get(sourceId);
  if (!src || src.userId !== userId) return null;
  return src;
}

// ─────────────────────────── Flashcards ───────────────────────────

export function listCards(
  userId: string,
  opts?: { dueOnly?: boolean; sourceId?: string },
): Flashcard[] {
  const now = Date.now();
  return Array.from(state().cards.values())
    .filter((c) => c.userId === userId)
    .filter((c) => (opts?.sourceId ? c.sourceId === opts.sourceId : true))
    .filter((c) => (opts?.dueOnly ? c.dueAt <= now : true))
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function createCard(input: {
  userId: string;
  sourceId?: string;
  front: string;
  back: string;
  tags?: string[];
}): Flashcard | null {
  const front = input.front.trim().slice(0, 500);
  const back = input.back.trim().slice(0, 2000);
  if (!front || !back) return null;
  const card: Flashcard = {
    id: randomUUID(),
    userId: input.userId,
    sourceId: input.sourceId,
    front,
    back,
    tags: (input.tags ?? []).slice(0, 10).map((t) => t.slice(0, 30)),
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    dueAt: Date.now(),
    createdAt: Date.now(),
  };
  state().cards.set(card.id, card);
  scheduleSave();
  return card;
}

export function deleteCard(userId: string, cardId: string): boolean {
  const s = state();
  const card = s.cards.get(cardId);
  if (!card || card.userId !== userId) return false;
  s.cards.delete(cardId);
  scheduleSave();
  return true;
}

/**
 * SM-2 변형 SRS. rating 에 따라 interval·ease·dueAt 갱신.
 * - again: interval=1분, ease-=0.2, reps=0, lapses++
 * - hard:  interval*=1.2, ease-=0.15, reps++
 * - good:  interval*=ease (처음엔 1→6일), ease 유지, reps++
 * - easy:  interval*=ease*1.3, ease+=0.15, reps++
 */
export function reviewCard(
  userId: string,
  cardId: string,
  rating: Rating,
): Flashcard | null {
  const s = state();
  const card = s.cards.get(cardId);
  if (!card || card.userId !== userId) return null;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let { ease, interval, reps, lapses } = card;

  switch (rating) {
    case "again": {
      ease = Math.max(1.3, ease - 0.2);
      reps = 0;
      lapses += 1;
      interval = 1 / (24 * 60); // 1분 (일 단위)
      break;
    }
    case "hard": {
      ease = Math.max(1.3, ease - 0.15);
      reps += 1;
      interval = reps === 1 ? 1 : interval * 1.2;
      break;
    }
    case "good": {
      reps += 1;
      interval = reps === 1 ? 1 : reps === 2 ? 6 : interval * ease;
      break;
    }
    case "easy": {
      ease += 0.15;
      reps += 1;
      interval = reps === 1 ? 2 : reps === 2 ? 10 : interval * ease * 1.3;
      break;
    }
  }

  card.ease = ease;
  card.interval = interval;
  card.reps = reps;
  card.lapses = lapses;
  card.lastReviewedAt = now;
  card.dueAt = now + interval * day;
  scheduleSave();
  return card;
}

export interface StudyStats {
  totalCards: number;
  dueToday: number;
  dueNow: number;
  learning: number;    // reps < 2
  mature: number;      // reps >= 2 and interval >= 21
  totalSources: number;
}

export function studyStats(userId: string): StudyStats {
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endTs = endOfToday.getTime();

  const cards = Array.from(state().cards.values()).filter(
    (c) => c.userId === userId,
  );
  const sources = Array.from(state().sources.values()).filter(
    (s) => s.userId === userId,
  );
  return {
    totalCards: cards.length,
    dueNow: cards.filter((c) => c.dueAt <= now).length,
    dueToday: cards.filter((c) => c.dueAt <= endTs).length,
    learning: cards.filter((c) => c.reps < 2).length,
    mature: cards.filter((c) => c.reps >= 2 && c.interval >= 21).length,
    totalSources: sources.length,
  };
}
