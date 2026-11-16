"use client";

import { useEffect, useState, useCallback } from "react";

export interface ClientUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

interface State {
  user: ClientUser | null;
  isOwner: boolean;
  loading: boolean;
}

/** 간단한 fetch("/api/auth/me") 훅. storage/focus 이벤트로 재조회. */
export function useCurrentUser(): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    user: null,
    isOwner: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as {
        user: ClientUser | null;
        isOwner?: boolean;
      };
      setState({
        user: data.user,
        isOwner: Boolean(data.isOwner),
        loading: false,
      });
    } catch {
      setState({ user: null, isOwner: false, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("polymath:auth-changed", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("polymath:auth-changed", onFocus);
    };
  }, [refresh]);

  return { ...state, refresh };
}

export function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("polymath:auth-changed"));
  }
}
