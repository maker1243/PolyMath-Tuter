import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { ProviderId } from "./providers";
import { dataPath } from "./data-dir";

export interface AiPrefs {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  geminiAuth?: "auto" | "key" | "bearer";
}

export interface UserPrefs {
  userId: string;
  aiSettings: AiPrefs | null;
  updatedAt: number;
}

interface PrefsFile {
  version: 1;
  prefs: UserPrefs[];
}

const PREFS_PATH = dataPath("user-prefs.json");

const g = process as unknown as {
  __polymathPrefs?: Map<string, UserPrefs>;
  __polymathPrefsLoaded?: boolean;
  __polymathPrefsTimer?: NodeJS.Timeout | null;
};

function store() {
  if (!g.__polymathPrefs) g.__polymathPrefs = new Map();
  if (!g.__polymathPrefsLoaded) {
    g.__polymathPrefsLoaded = true;
    try {
      const raw = readFileSync(PREFS_PATH, "utf8");
      const data = JSON.parse(raw) as PrefsFile;
      if (data.version === 1 && Array.isArray(data.prefs)) {
        for (const p of data.prefs) g.__polymathPrefs.set(p.userId, p);
      }
    } catch {
      /* 파일 없음 OK */
    }
  }
  return g.__polymathPrefs;
}

function scheduleSave() {
  if (g.__polymathPrefsTimer) clearTimeout(g.__polymathPrefsTimer);
  g.__polymathPrefsTimer = setTimeout(() => {
    g.__polymathPrefsTimer = null;
    try {
      const data: PrefsFile = {
        version: 1,
        prefs: Array.from(store().values()),
      };
      mkdirSync(dirname(PREFS_PATH), { recursive: true });
      const tmp = PREFS_PATH + ".tmp";
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, PREFS_PATH);
    } catch (err) {
      console.error("[prefs] save failed:", err);
    }
  }, 500);
  (g.__polymathPrefsTimer as unknown as { unref?: () => void }).unref?.();
}

export function getUserPrefs(userId: string): UserPrefs | null {
  return store().get(userId) ?? null;
}

export function setUserAiPrefs(
  userId: string,
  aiSettings: AiPrefs | null,
): UserPrefs {
  const existing = store().get(userId);
  const next: UserPrefs = {
    userId,
    aiSettings,
    updatedAt: Date.now(),
  };
  const _ = existing;
  store().set(userId, next);
  scheduleSave();
  return next;
}
