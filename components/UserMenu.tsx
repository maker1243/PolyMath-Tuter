"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { LogIn, LogOut, UserPlus, UserCircle2, ChevronDown } from "lucide-react";
import { emitAuthChanged, useCurrentUser } from "@/lib/use-current-user";

export function UserMenu() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    emitAuthChanged();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-lg bg-white/5" aria-hidden />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/auth/login"
          className="rounded-lg px-2.5 py-1.5 text-xs text-muted-strong hover:bg-white/[0.04] hover:text-white"
        >
          <span className="inline-flex items-center gap-1">
            <LogIn className="h-3.5 w-3.5" />
            로그인
          </span>
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs text-muted-strong hover:bg-white/[0.05] hover:text-white"
        >
          <span className="inline-flex items-center gap-1">
            <UserPlus className="h-3.5 w-3.5" />
            가입
          </span>
        </Link>
      </div>
    );
  }

  const initial = user.displayName.slice(0, 1) || "?";
  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1 text-xs text-muted-strong hover:bg-white/[0.05] hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-semibold text-white">
          {initial}
        </span>
        <span className="hidden sm:inline">{user.displayName}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-white/10 bg-bg-elevated/95 p-2 shadow-xl backdrop-blur"
        >
          <div className="mb-1 border-b border-white/5 px-2 py-1.5 text-xs text-muted">
            <div className="truncate font-semibold text-muted-strong">
              {user.displayName}
            </div>
            <div className="truncate text-[10px]">{user.email}</div>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2 py-1.5 text-xs text-muted-strong hover:bg-white/5 hover:text-white"
            role="menuitem"
          >
            <span className="inline-flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" />내 대시보드
            </span>
          </Link>
          <button
            onClick={logout}
            className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-rose-300 hover:bg-rose-500/10"
            role="menuitem"
          >
            <span className="inline-flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
