import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { dataPath } from "./data-dir";

export type ActivityType =
  | "room_join"
  | "code_run"
  | "ai_ask"
  | "file_upload"
  | "message_sent"
  | "mission_created"
  // 신규: /tutor, /study, /quiz 집계
  | "tutor_ask"
  | "card_review"
  | "card_created"
  | "source_added"
  | "quiz_completed"
  // 신규: /apps 미니앱
  | "math_drill"
  | "vocab_drill"
  | "hanja_drill"
  | "typing_drill"
  | "history_quiz";

export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  roomId?: string;
  meta?: Record<string, unknown>;
  at: number;
}

interface ActivityFile {
  version: 1;
  items: Activity[];
}

const ACTIVITY_PATH = dataPath("activity.json");
const MAX_ITEMS = 10_000; // 전체 상한. 넘으면 가장 오래된 것부터 drop

const g = process as unknown as {
  __polymathActivity?: Activity[];
  __polymathActivityLoaded?: boolean;
  __polymathActivityTimer?: NodeJS.Timeout | null;
};

function store(): Activity[] {
  if (!g.__polymathActivity) g.__polymathActivity = [];
  if (!g.__polymathActivityLoaded) {
    g.__polymathActivityLoaded = true;
    try {
      const raw = readFileSync(ACTIVITY_PATH, "utf8");
      const data = JSON.parse(raw) as ActivityFile;
      if (data.version === 1 && Array.isArray(data.items)) {
        g.__polymathActivity.push(...data.items);
      }
    } catch {
      /* 파일 없음 OK */
    }
  }
  return g.__polymathActivity;
}

function scheduleSave() {
  if (g.__polymathActivityTimer) clearTimeout(g.__polymathActivityTimer);
  g.__polymathActivityTimer = setTimeout(() => {
    g.__polymathActivityTimer = null;
    try {
      const items = store();
      const data: ActivityFile = { version: 1, items };
      mkdirSync(dirname(ACTIVITY_PATH), { recursive: true });
      const tmp = ACTIVITY_PATH + ".tmp";
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, ACTIVITY_PATH);
    } catch (err) {
      console.error("[activity] save failed:", err);
    }
  }, 800);
  (g.__polymathActivityTimer as unknown as { unref?: () => void }).unref?.();
}

export function logActivity(input: {
  userId: string;
  type: ActivityType;
  roomId?: string;
  meta?: Record<string, unknown>;
}): Activity | null {
  if (!input.userId) return null; // 익명은 기록 안 함
  const items = store();
  const act: Activity = {
    id: randomUUID(),
    userId: input.userId,
    type: input.type,
    roomId: input.roomId,
    meta: input.meta,
    at: Date.now(),
  };
  items.push(act);
  if (items.length > MAX_ITEMS) items.splice(0, items.length - MAX_ITEMS);
  scheduleSave();
  return act;
}

export interface UserSummary {
  totalActivities: number;
  byType: Record<ActivityType, number>;
  streakDays: number;
  distinctRooms: number;
  weekMinutes: { day: string; count: number }[]; // 최근 7일 각 날짜의 activity 수
  /** 최근 7일 날짜별 타입별 카운트 (D 상세 뷰용) */
  weekByType: {
    day: string;
    dateKey: string;
    byType: Record<ActivityType, number>;
  }[];
  recent: Activity[]; // 최근 20개
}

const EMPTY_BY_TYPE: Record<ActivityType, number> = {
  room_join: 0,
  code_run: 0,
  ai_ask: 0,
  file_upload: 0,
  message_sent: 0,
  mission_created: 0,
  tutor_ask: 0,
  card_review: 0,
  card_created: 0,
  source_added: 0,
  quiz_completed: 0,
  math_drill: 0,
  vocab_drill: 0,
  hanja_drill: 0,
  typing_drill: 0,
  history_quiz: 0,
};

const KO_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function summarizeUser(userId: string): UserSummary {
  const items = store().filter((a) => a.userId === userId);
  const byType: Record<ActivityType, number> = { ...EMPTY_BY_TYPE };
  const rooms = new Set<string>();
  const dayStamps = new Set<string>(); // "YYYY-MM-DD"
  for (const a of items) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    if (a.roomId) rooms.add(a.roomId);
    dayStamps.add(dateKey(a.at));
  }

  // streak: 오늘부터 역순으로 연속한 날짜 수
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (dayStamps.has(dateKey(d.getTime()))) streak++;
    else if (i > 0) break; // 오늘이 비면 0, 그 외는 끊김
  }

  // 최근 7일
  const week: { day: string; count: number }[] = [];
  const weekByType: {
    day: string;
    dateKey: string;
    byType: Record<ActivityType, number>;
  }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKey(d.getTime());
    const dayItems = items.filter((a) => dateKey(a.at) === key);
    week.push({ day: KO_WEEK[d.getDay()], count: dayItems.length });
    const dayByType: Record<ActivityType, number> = { ...EMPTY_BY_TYPE };
    for (const a of dayItems) {
      dayByType[a.type] = (dayByType[a.type] ?? 0) + 1;
    }
    weekByType.push({
      day: KO_WEEK[d.getDay()],
      dateKey: key,
      byType: dayByType,
    });
  }

  const recent = items
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);

  return {
    totalActivities: items.length,
    byType,
    streakDays: streak,
    distinctRooms: rooms.size,
    weekMinutes: week,
    weekByType,
    recent,
  };
}

function dateKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
