import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { dataPath } from "./data-dir";

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
const AUTH_PATH = dataPath("auth.json");

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
  }
  return g.__polymathAuth;
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
