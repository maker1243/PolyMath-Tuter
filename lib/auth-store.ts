import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { authPath } from "./data-dir";

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string; // hex
  salt: string; // hex
  createdAt: number;
  lastLoginAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

interface AuthFile {
  version: 1;
  users: User[];
  sessions: Session[];
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "polymath_session";
const AUTH_PATH = authPath("auth.json");

// process 전역에 보관 (Next.js dev 모듈 재평가에서도 유지)
const g = process as unknown as {
  __polymathAuth?: {
    users: Map<string, User>;
    byEmail: Map<string, string>; // lowercased email → userId
    sessions: Map<string, Session>; // token → session
    loaded: boolean;
  };
  __polymathAuthSaveTimer?: NodeJS.Timeout | null;
};

function state() {
  if (!g.__polymathAuth) {
    g.__polymathAuth = {
      users: new Map(),
      byEmail: new Map(),
      sessions: new Map(),
      loaded: false,
    };
    loadFromDisk();
    seedOwnerFromEnv();
  }
  return g.__polymathAuth;
}

/**
 * Render/Fly 등 ephemeral 파일시스템 환경에서 재배포 후에도 로그인을 유지하기 위해,
 * 환경변수로 지정된 오너 계정을 서버 시작 시 "지금 등록" 한다.
 *
 * 필수 env: POLYMATH_SEED_EMAIL, POLYMATH_SEED_PASSWORD
 * 선택 env: POLYMATH_SEED_NAME (기본 "오너")
 *
 * 동작:
 * - 해당 이메일이 아직 없으면 → 새 유저 생성 (가장 오래된 createdAt 으로 → 자동 오너)
 * - 이미 있으면 → 비밀번호를 env 값으로 재설정 (환경변수가 소스 오브 트루스)
 */
function seedOwnerFromEnv() {
  const email = (process.env.POLYMATH_SEED_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.POLYMATH_SEED_PASSWORD ?? "";
  const displayName = (process.env.POLYMATH_SEED_NAME ?? "오너")
    .trim()
    .slice(0, 40);
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn("[auth] POLYMATH_SEED_EMAIL 형식이 올바르지 않습니다");
    return;
  }
  if (password.length < 8) {
    console.warn("[auth] POLYMATH_SEED_PASSWORD 는 8자 이상이어야 합니다");
    return;
  }
  const s = g.__polymathAuth!;
  const existingId = s.byEmail.get(email);
  const now = Date.now();
  if (existingId) {
    const user = s.users.get(existingId);
    if (!user) return;
    // 비밀번호를 env 값으로 재동기화 (매 재시작마다)
    const newSalt = randomBytes(16).toString("hex");
    user.salt = newSalt;
    user.passwordHash = hashPassword(password, newSalt);
    if (displayName && user.displayName !== displayName) {
      user.displayName = displayName;
    }
    // 세션은 유지 (쿠키 파기 안 함)
    scheduleSave();
    return;
  }
  // 새로 생성 — createdAt 을 0 으로 두어 어떤 기존 유저보다도 오래된 것으로 처리
  // → isOwner() 가 항상 이 유저를 오너로 식별하도록 보장
  const salt = randomBytes(16).toString("hex");
  const user: User = {
    id: randomBytes(10).toString("base64url"),
    email,
    displayName: displayName || "오너",
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: 0, // 오너 보장
    lastLoginAt: now,
  };
  s.users.set(user.id, user);
  s.byEmail.set(email, user.id);
  scheduleSave();
  console.log(`[auth] seeded owner account: ${email}`);
}

function loadFromDisk() {
  const s = g.__polymathAuth!;
  if (s.loaded) return;
  s.loaded = true;
  try {
    const raw = readFileSync(AUTH_PATH, "utf8");
    const data = JSON.parse(raw) as AuthFile;
    if (data.version !== 1) return;
    const now = Date.now();
    for (const u of data.users ?? []) {
      s.users.set(u.id, u);
      s.byEmail.set(u.email.toLowerCase(), u.id);
    }
    for (const sess of data.sessions ?? []) {
      if (sess.expiresAt > now) s.sessions.set(sess.token, sess);
    }
  } catch {
    /* 파일 없음 OK */
  }
}

function scheduleSave() {
  if (g.__polymathAuthSaveTimer) clearTimeout(g.__polymathAuthSaveTimer);
  g.__polymathAuthSaveTimer = setTimeout(() => {
    g.__polymathAuthSaveTimer = null;
    try {
      const s = state();
      const data: AuthFile = {
        version: 1,
        users: Array.from(s.users.values()),
        sessions: Array.from(s.sessions.values()),
      };
      mkdirSync(dirname(AUTH_PATH), { recursive: true });
      const tmp = AUTH_PATH + ".tmp";
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, AUTH_PATH);
    } catch (err) {
      console.error("[auth] save failed:", err);
    }
  }, 500);
  (g.__polymathAuthSaveTimer as unknown as { unref?: () => void }).unref?.();
}

function hashPassword(password: string, salt: string): string {
  // scrypt — Node 내장, 외부 의존 없음
  return scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
}

export function createUser(input: {
  email: string;
  password: string;
  displayName: string;
}): { user: User } | { error: string } {
  const s = state();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "이메일 형식이 올바르지 않습니다" };
  }
  if (input.password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다" };
  }
  const displayName = input.displayName.trim().slice(0, 40);
  if (!displayName) return { error: "표시 이름은 필수입니다" };
  if (s.byEmail.has(email)) return { error: "이미 등록된 이메일입니다" };

  const salt = randomBytes(16).toString("hex");
  const now = Date.now();
  const user: User = {
    id: randomBytes(10).toString("base64url"),
    email,
    displayName,
    passwordHash: hashPassword(input.password, salt),
    salt,
    createdAt: now,
    lastLoginAt: now,
  };
  s.users.set(user.id, user);
  s.byEmail.set(email, user.id);
  scheduleSave();
  return { user };
}

export function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): { ok: true } | { error: string } {
  if (newPassword.length < 8) {
    return { error: "새 비밀번호는 8자 이상이어야 합니다" };
  }
  const s = state();
  const user = s.users.get(userId);
  if (!user) return { error: "사용자 없음" };
  const stored = Buffer.from(user.passwordHash, "hex");
  const candidate = Buffer.from(hashPassword(oldPassword, user.salt), "hex");
  if (stored.length !== candidate.length) return { error: "현재 비밀번호 불일치" };
  if (!timingSafeEqual(stored, candidate)) {
    return { error: "현재 비밀번호 불일치" };
  }
  const newSalt = randomBytes(16).toString("hex");
  user.salt = newSalt;
  user.passwordHash = hashPassword(newPassword, newSalt);
  // 모든 기존 세션 무효화 (현재 쿠키 포함) — 보안상 안전
  for (const [token, sess] of s.sessions.entries()) {
    if (sess.userId === userId) s.sessions.delete(token);
  }
  scheduleSave();
  return { ok: true };
}

export function verifyPassword(email: string, password: string): User | null {
  const s = state();
  const id = s.byEmail.get(email.trim().toLowerCase());
  if (!id) return null;
  const user = s.users.get(id);
  if (!user) return null;
  const stored = Buffer.from(user.passwordHash, "hex");
  const candidate = Buffer.from(hashPassword(password, user.salt), "hex");
  if (stored.length !== candidate.length) return null;
  if (!timingSafeEqual(stored, candidate)) return null;
  user.lastLoginAt = Date.now();
  scheduleSave();
  return user;
}

export function createSession(userId: string): Session {
  const s = state();
  const token = randomBytes(32).toString("base64url");
  const sess: Session = {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  s.sessions.set(token, sess);
  scheduleSave();
  return sess;
}

export function getUserBySession(
  token: string | undefined | null,
): User | null {
  if (!token) return null;
  const s = state();
  const sess = s.sessions.get(token);
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) {
    s.sessions.delete(token);
    scheduleSave();
    return null;
  }
  return s.users.get(sess.userId) ?? null;
}

export function updateDisplayName(
  userId: string,
  displayName: string,
): User | null {
  const s = state();
  const user = s.users.get(userId);
  if (!user) return null;
  user.displayName = displayName.slice(0, 40);
  scheduleSave();
  return user;
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  const s = state();
  if (s.sessions.delete(token)) scheduleSave();
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}

/** 가장 먼저 가입한 사용자 = 오너. 전역 백업/복원 권한을 가짐. */
export function isOwner(userId: string): boolean {
  const s = state();
  let oldestId: string | null = null;
  let oldestAt = Number.POSITIVE_INFINITY;
  for (const u of s.users.values()) {
    if (u.createdAt < oldestAt) {
      oldestAt = u.createdAt;
      oldestId = u.id;
    }
  }
  return oldestId === userId;
}

export interface AuthBackup {
  version: 1;
  exportedAt: number;
  users: User[];
  sessions: Session[];
}

/** 전체 사용자·세션을 JSON 으로 반환. 비밀번호 해시가 포함되므로 안전하게 보관할 것. */
export function exportAll(): AuthBackup {
  const s = state();
  return {
    version: 1,
    exportedAt: Date.now(),
    users: Array.from(s.users.values()),
    sessions: Array.from(s.sessions.values()),
  };
}

export interface ImportResult {
  usersAdded: number;
  usersUpdated: number;
  sessionsAdded: number;
  skipped: number;
}

/** 백업 파일을 현재 저장소에 merge (기본) 또는 replace.
 *  merge: 같은 id 는 payload 쪽이 최신이면 덮어씀. 새 id 는 추가.
 *  replace: 현재 users/sessions 를 모두 지우고 payload 로 교체.
 */
export function importAll(
  data: AuthBackup,
  mode: "merge" | "replace" = "merge",
): ImportResult {
  if (data?.version !== 1) {
    throw new Error("지원하지 않는 백업 버전입니다");
  }
  const s = state();
  const result: ImportResult = {
    usersAdded: 0,
    usersUpdated: 0,
    sessionsAdded: 0,
    skipped: 0,
  };
  if (mode === "replace") {
    s.users.clear();
    s.byEmail.clear();
    s.sessions.clear();
  }
  const now = Date.now();
  for (const u of data.users ?? []) {
    if (
      !u?.id ||
      !u?.email ||
      !u?.passwordHash ||
      !u?.salt ||
      typeof u.createdAt !== "number"
    ) {
      result.skipped++;
      continue;
    }
    const existing = s.users.get(u.id);
    if (existing) {
      // 최신 createdAt 또는 lastLoginAt 이 큰 쪽 보존
      if ((u.lastLoginAt ?? 0) >= (existing.lastLoginAt ?? 0)) {
        s.users.set(u.id, u);
        s.byEmail.set(u.email.toLowerCase(), u.id);
        result.usersUpdated++;
      } else {
        result.skipped++;
      }
    } else {
      s.users.set(u.id, u);
      s.byEmail.set(u.email.toLowerCase(), u.id);
      result.usersAdded++;
    }
  }
  for (const sess of data.sessions ?? []) {
    if (!sess?.token || !sess?.userId || !sess?.expiresAt) {
      result.skipped++;
      continue;
    }
    if (sess.expiresAt < now) {
      result.skipped++;
      continue;
    }
    if (!s.sessions.has(sess.token)) {
      s.sessions.set(sess.token, sess);
      result.sessionsAdded++;
    }
  }
  scheduleSave();
  return result;
}
