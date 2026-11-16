"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

/**
 * 전역 클라이언트 에러 바운더리. Next.js App Router 가 자동 감지해서
 * 어느 페이지든 하얀 'Application error' 대신 이 UI 를 렌더합니다.
 *
 * 흔한 복구 경로를 모두 노출: 다시 시도 → localStorage 초기화 → 처음으로.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 서버 에러는 콘솔에만 남겨 디버그 가능하도록
    // eslint-disable-next-line no-console
    console.error("[RootError]", error);
  }, [error]);

  function clearStorage() {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    location.href = "/";
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(
        `${error.message}\n${error.stack ?? ""}\ndigest: ${error.digest ?? "n/a"}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-20 text-center">
      <div className="inline-flex rounded-full bg-amber-500/10 p-4">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">앗, 화면을 그리다가 멈췄어요</h1>
        <p className="mt-2 text-sm text-muted">
          브라우저에 저장된 과거 데이터와 새 버전이 맞지 않아 생길 때가 많습니다.
          <br />
          아래 순서로 시도해 보세요.
        </p>
      </div>

      <div className="w-full space-y-2 rounded-xl border border-white/5 bg-bg-elevated/40 p-4 text-left text-xs">
        <div className="font-mono text-amber-300">{error.message}</div>
        {error.digest && (
          <div className="font-mono text-muted">digest · {error.digest}</div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2 text-sm text-muted-strong hover:bg-white/5 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          다시 시도
        </button>
        <button
          type="button"
          onClick={clearStorage}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:brightness-110"
        >
          <Trash2 className="h-4 w-4" />
          캐시 정리 후 홈으로
        </button>
        <button
          type="button"
          onClick={copyDetails}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2 text-xs text-muted hover:text-white"
        >
          {copied ? "복사됨" : "에러 내용 복사"}
        </button>
      </div>

      <div className="max-w-sm rounded-lg border border-white/5 bg-bg-elevated/30 px-3 py-2 text-[11px] leading-5 text-muted">
        💡 <b className="text-white">캐시 정리</b> 는 브라우저에 저장된 과거 학습
        세션·UI 설정만 지웁니다. 서버의 계정·복습 카드는 그대로입니다.
      </div>
    </div>
  );
}
