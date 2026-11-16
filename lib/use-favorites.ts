"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "polymath:collab:favorites";
const EVENT = "polymath:favorites-changed";
const MAX = 50;

export interface FavEntry {
  id: string;
  at: number; // 마지막 방문·추가 시각
  pinned: boolean; // true 면 수동 ⭐, false 면 자동 (최근 방문)
}

type Legacy = string | FavEntry;

function read(): FavEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr
      .map((x: Legacy) => {
        if (typeof x === "string") {
          // 레거시 string 배열 (수동 ⭐로 간주)
          return { id: x, at: now, pinned: true } as FavEntry;
        }
        if (x && typeof x === "object" && typeof (x as FavEntry).id === "string") {
          const e = x as FavEntry;
          return {
            id: e.id,
            at: typeof e.at === "number" ? e.at : now,
            pinned: !!e.pinned,
          };
        }
        return null;
      })
      .filter((x): x is FavEntry => !!x);
  } catch {
    return [];
  }
}

function write(list: FavEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * 방 입장 시 자동 호출 — 이미 있으면 at 만 갱신, 없으면 pinned:false 로 추가.
 * 사용자가 ⭐를 명시적으로 누르면 pinned:true 로 승격 (toggle).
 */
export function recordVisit(roomId: string) {
  if (typeof window === "undefined") return;
  const curr = read();
  const now = Date.now();
  const existing = curr.find((e) => e.id === roomId);
  const next = existing
    ? curr.map((e) => (e.id === roomId ? { ...e, at: now } : e))
    : [...curr, { id: roomId, at: now, pinned: false }];
  write(next);
}

export function useFavorites() {
  const [list, setList] = useState<FavEntry[]>([]);

  useEffect(() => {
    setList(read());
    const sync = () => setList(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** ⭐ 토글 — pinned 전환. 이미 자동 추가된 방이면 pinned:true 로 승격. */
  const togglePin = useCallback((roomId: string) => {
    const curr = read();
    const existing = curr.find((e) => e.id === roomId);
    const next = existing
      ? curr.map((e) =>
          e.id === roomId ? { ...e, pinned: !e.pinned, at: Date.now() } : e,
        )
      : [...curr, { id: roomId, pinned: true, at: Date.now() }];
    write(next);
    setList(next);
  }, []);

  const remove = useCallback((roomId: string) => {
    const next = read().filter((e) => e.id !== roomId);
    write(next);
    setList(next);
  }, []);

  const clear = useCallback(() => {
    // pinned 는 유지, 자동 방문 기록만 지움
    const next = read().filter((e) => e.pinned);
    write(next);
    setList(next);
  }, []);

  const isPinned = useCallback(
    (roomId: string) => list.find((e) => e.id === roomId)?.pinned ?? false,
    [list],
  );

  // 정렬: pinned 먼저, 그 안에서 최근 at 순
  const sorted = [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.at - a.at;
  });

  return { favorites: sorted, togglePin, remove, clear, isPinned };
}
