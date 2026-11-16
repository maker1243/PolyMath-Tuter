"use client";

import { useEffect, useRef, useState } from "react";
import {
  Package,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  installPackage,
  listInstalledPackages,
  SUGGESTED_PACKAGES,
  type InstallResult,
} from "@/lib/pyodide";

interface Props {
  /** 설치 완료되면 호출됨 (예: 에디터에 import 자동 삽입). */
  onInstalled?: (name: string) => void;
  /** 컴팩트 모드: 세로 공간이 좁은 사이드 패널용. */
  compact?: boolean;
}

export function PythonPackageManager({ onInstalled, compact }: Props) {
  const [installed, setInstalled] = useState<Record<string, string>>({});
  const [pkg, setPkg] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installingName, setInstallingName] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastResult, setLastResult] = useState<InstallResult | null>(null);
  const [history, setHistory] = useState<InstallResult[]>([]);
  const timerRef = useRef<number | null>(null);

  async function refresh() {
    try {
      setInstalled(await listInstalledPackages());
    } catch {
      /* Pyodide 가 아직 로드 안 됐을 수 있음 */
    }
  }

  useEffect(() => {
    void refresh();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  async function doInstall(name: string) {
    const target = name.trim();
    if (!target || installing) return;
    setInstalling(true);
    setInstallingName(target);
    setLastResult(null);
    setElapsedMs(0);
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 250);
    try {
      const result = await installPackage(target);
      setLastResult(result);
      setHistory((prev) => [result, ...prev].slice(0, 20));
      if (result.ok) {
        setPkg("");
        await refresh();
        onInstalled?.(result.package);
      }
    } finally {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setInstalling(false);
      setInstallingName("");
    }
  }

  function fmtElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}분 ${rs}초`;
  }

  const alreadyInstalledLookup = new Set(Object.keys(installed).map((k) => k.toLowerCase()));

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} font-semibold`}>
        <Package className={compact ? "h-3.5 w-3.5 text-accent-500" : "h-4 w-4 text-accent-500"} />
        Python 패키지
      </div>

      {/* Install input */}
      <div className="flex gap-1.5">
        <input
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doInstall(pkg)}
          placeholder="pygame-ce, numpy, pandas …"
          className="input text-xs"
          disabled={installing}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={() => doInstall(pkg)}
          disabled={installing || !pkg.trim()}
          className="btn-primary shrink-0 px-2 py-1 text-xs"
          title="설치"
        >
          {installing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* 설치 중 라이브 상태 */}
      {installing && (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-2.5 text-[11px]">
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">
                {installingName} 설치 중…
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-muted-strong">
                <Clock className="h-3 w-3" />
                경과 {fmtElapsed(elapsedMs)}
              </div>
              <div className="mt-1 text-muted">
                패키지 크기·네트워크에 따라{" "}
                <strong className="text-muted-strong">몇 분까지</strong> 걸릴 수
                있어요. 큰 패키지(matplotlib, scipy, scikit-learn)는 압축 해제가
                특히 오래 걸립니다. 창을 닫지 말고 기다려 주세요.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {lastResult && (
        <div
          className={`rounded-lg border p-2 text-[11px] ${
            lastResult.ok
              ? "border-accent-500/40 bg-accent-500/10 text-white"
              : "border-red-400/40 bg-red-400/10 text-red-200"
          }`}
        >
          <div className="flex items-start gap-1.5">
            {lastResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-accent-500" />
            ) : (
              <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{lastResult.package}</div>
              <div className="mt-0.5 text-muted-strong">{lastResult.message}</div>
              <div className="mt-0.5 text-muted">
                {lastResult.method ? `${lastResult.method} · ` : ""}
                {lastResult.durationMs}ms
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested */}
      {!compact && (
        <div>
          <div className="label">자주 쓰는 패키지</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PACKAGES.map((s) => {
              const already = alreadyInstalledLookup.has(s.name.toLowerCase());
              return (
                <button
                  key={s.name}
                  onClick={() => doInstall(s.name)}
                  disabled={installing || already}
                  title={s.description}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    already
                      ? "border-accent-500/40 bg-accent-500/10 text-accent-500"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {already && <Download className="mr-1 inline h-3 w-3" />}
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Installed list */}
      {Object.keys(installed).length > 0 && (
        <div>
          <div className="label">
            설치됨 ({Object.keys(installed).length})
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(installed)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, version]) => (
                <span
                  key={name}
                  className="rounded border border-white/5 bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] text-muted-strong"
                  title={`${name} ${version}`}
                >
                  {name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* History (compact only shows last) */}
      {!compact && history.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted hover:text-white">
            설치 이력 ({history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {history.map((h, i) => (
              <li
                key={i}
                className={`flex items-center gap-1.5 ${
                  h.ok ? "text-muted-strong" : "text-red-400"
                }`}
              >
                {h.ok ? "✓" : "✗"} {h.package}{" "}
                <span className="text-muted">({h.durationMs}ms)</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2 text-[11px] text-amber-200">
        <div className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <div>
            <strong>설치 시간 안내</strong> — 작은 패키지(numpy, sympy)는{" "}
            <strong>1~5초</strong>, 중형(pandas, pillow, pygame-ce)은{" "}
            <strong>5~30초</strong>, 대형(matplotlib, scipy, scikit-learn)은{" "}
            <strong>30초~수 분</strong>까지 걸릴 수 있습니다. 설치는 Pyodide 공식
            wheel → micropip (PyPI) 순서로 시도되며, 한번 설치한 패키지는 페이지를
            새로 고치기 전까지 캐시됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
