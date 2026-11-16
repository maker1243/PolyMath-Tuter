"use client";

const KEY = "polymath:collab:identity";

export interface CollabIdentity {
  id: string;
  name: string;
  color: string;
}

const COLORS = [
  "bg-brand-500",
  "bg-accent-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
];

export const COLOR_HEX: Record<string, string> = {
  "bg-brand-500": "#5b7cfa",
  "bg-accent-500": "#22d3b4",
  "bg-pink-500": "#ec4899",
  "bg-amber-500": "#f59e0b",
  "bg-sky-500": "#0ea5e9",
  "bg-violet-500": "#8b5cf6",
  "bg-emerald-500": "#10b981",
  "bg-rose-500": "#f43f5e",
};

export function hexOf(color: string): string {
  return COLOR_HEX[color] ?? "#5b7cfa";
}

const KO_NAMES = [
  "민찬",
  "지후",
  "서연",
  "하은",
  "도윤",
  "지안",
  "예준",
  "서윤",
  "주원",
  "시우",
  "하준",
  "지유",
];

import { randomId } from "./random-id";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getIdentity(): CollabIdentity {
  if (typeof window === "undefined") {
    return { id: "ssr", name: "익명", color: "bg-brand-500" };
  }
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CollabIdentity;
  } catch {
    /* ignore */
  }
  const id = randomId();
  const identity: CollabIdentity = {
    id,
    name: `${pick(KO_NAMES)}-${id.slice(0, 4)}`,
    color: pick(COLORS),
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
  return identity;
}

export function setIdentity(id: CollabIdentity) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    /* ignore */
  }
}

export function initial(name: string): string {
  return name.replace(/-\w+$/, "").slice(0, 1) || "?";
}

/**
 * 로그인한 user 를 collab identity 로 변환. userId 가 안정적이므로
 * 다른 탭·방 재접속 시에도 동일 pid 로 인식됩니다.
 */
export function identityFromUser(user: {
  id: string;
  displayName: string;
}): CollabIdentity {
  // 사용자 id 기반 결정적 색상 (매번 동일)
  let hash = 0;
  for (let i = 0; i < user.id.length; i++) {
    hash = (hash * 31 + user.id.charCodeAt(i)) | 0;
  }
  const color = COLORS[Math.abs(hash) % COLORS.length];
  return { id: `u:${user.id}`, name: user.displayName, color };
}
