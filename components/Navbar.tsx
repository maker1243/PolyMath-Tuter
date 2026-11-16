"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Code2,
  Users,
  Trophy,
  LineChart,
  Sparkles,
  Settings,
  Layers,
  Rocket,
} from "lucide-react";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { loadAiSettings } from "@/lib/user-settings";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/learn", label: "학습 입력", icon: BookOpen },
  { href: "/tutor", label: "AI 튜터", icon: Sparkles },
  { href: "/study", label: "복습 큐", icon: Layers },
  { href: "/apps", label: "학습 앱", icon: Rocket },
  { href: "/sandbox", label: "샌드박스", icon: Code2 },
  { href: "/collab", label: "협업 룸", icon: Users },
  { href: "/quiz", label: "퀴즈 배틀", icon: Trophy },
  { href: "/dashboard", label: "대시보드", icon: LineChart },
];

export function Navbar() {
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const sync = () => {
      const s = loadAiSettings();
      setProvider(s.provider);
      setHasKey(Boolean(s.keys[s.provider]?.trim()));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-3 sm:px-4 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] text-white">
            π
          </span>
          <span className="hidden sm:inline">PolyMath Tutor</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-strong transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <Icon className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/settings"
            className="group flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] text-muted-strong transition-colors hover:bg-white/[0.05] hover:text-white"
            title="AI 공급자 설정"
          >
            <Settings className="h-3 w-3" />
            <span className="hidden sm:inline">
              {provider ? PROVIDERS[provider].label.split(" ")[0] : "AI"}
            </span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hasKey ? "bg-accent-500" : "bg-amber-400"
              }`}
              title={hasKey ? "키 설정됨" : "데모 모드"}
            />
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
