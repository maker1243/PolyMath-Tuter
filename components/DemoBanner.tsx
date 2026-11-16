"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, X, Settings } from "lucide-react";
import { loadAiSettings } from "@/lib/user-settings";

export function DemoBanner() {
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);
  const [clientHasKey, setClientHasKey] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => {
      const s = loadAiSettings();
      setClientHasKey(Boolean(s.keys[s.provider]?.trim()));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);

    let active = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { claude?: string }) => {
        if (!active) return;
        setServerHasKey(d.claude === "live");
      })
      .catch(() => active && setServerHasKey(false));

    try {
      if (sessionStorage.getItem("polymath:demo-banner-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  if (serverHasKey === null) return null; // 상태 미확정이면 배너를 깜빡거리지 않음
  const live = serverHasKey || clientHasKey;
  if (live || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem("polymath:demo-banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-b border-amber-400/20 bg-amber-400/10">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs text-amber-200 sm:px-6 lg:px-8">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <strong>데모 모드로 실행 중입니다.</strong> 실제 Claude/Gemini/Groq 응답을
          쓰려면 설정에서 API 키를 입력해 주세요.
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/15 px-2 py-1 text-amber-100 hover:bg-amber-400/25"
        >
          <Settings className="h-3.5 w-3.5" />
          설정 열기
        </Link>
        <button
          onClick={dismiss}
          className="rounded-md p-1 text-amber-200 hover:bg-amber-400/15"
          aria-label="배너 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
