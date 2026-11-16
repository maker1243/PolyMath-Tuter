import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type {
  ChatMessage,
  CodeState,
  Mission,
  RunResult,
  SharedFile,
} from "./collab-store";
import { DATA_DIR, dataPath } from "./data-dir";

export const DATA_ROOT = DATA_DIR;
export const PERSIST_PATH = dataPath("rooms.json");
export const FILES_DIR = dataPath("files");

export interface PersistedRoom {
  id: string;
  messages: ChatMessage[];
  code: CodeState;
  yState: string | null; // base64 of Y.encodeStateAsUpdate
  runs: RunResult[];
  files: SharedFile[];
  startedAt: number;
  mission: Mission | null;
  hostPid: string;
  name: string | null;
  savedAt: number;
}

export interface PersistedFile {
  version: 1;
  rooms: PersistedRoom[];
}

export function loadPersistedSync(): PersistedFile | null {
  try {
    const raw = readFileSync(PERSIST_PATH, "utf8");
    const data = JSON.parse(raw) as PersistedFile;
    if (data.version !== 1 || !Array.isArray(data.rooms)) return null;
    return data;
  } catch {
    return null;
  }
}

export function savePersistedSync(data: PersistedFile): void {
  mkdirSync(dirname(PERSIST_PATH), { recursive: true });
  const tmp = PERSIST_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(data), "utf8");
  renameSync(tmp, PERSIST_PATH);
}

// Debounced writer — HMR safe via process (globalThis is sandboxed per module graph in Next dev).
const g = process as unknown as {
  __polymathPersistTimer?: NodeJS.Timeout | null;
  __polymathPersistSource?: () => PersistedFile;
};

export function configurePersistence(src: () => PersistedFile) {
  g.__polymathPersistSource = src;
}

export function schedulePersist() {
  if (!g.__polymathPersistSource) return;
  if (g.__polymathPersistTimer) clearTimeout(g.__polymathPersistTimer);
  g.__polymathPersistTimer = setTimeout(() => {
    g.__polymathPersistTimer = null;
    try {
      savePersistedSync(g.__polymathPersistSource!());
    } catch (err) {
      console.error("[polymath/persist] save failed:", err);
    }
  }, 800);
  (g.__polymathPersistTimer as unknown as { unref?: () => void }).unref?.();
}
