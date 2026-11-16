"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Play, Trash2, Terminal, Lightbulb, Server, Globe, Package2, Loader2 } from "lucide-react";
import { runPython } from "@/lib/pyodide";
import { withAiCredentials } from "@/lib/user-settings";
import { PythonPackageManager } from "@/components/PythonPackageManager";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted">
      에디터 로딩 중…
    </div>
  ),
});

type Lang = "javascript" | "python";
type PyRuntime = "pyodide" | "local";

const DEFAULT_CODE: Record<Lang, string> = {
  javascript: `// 환영합니다 — PolyMath Sandbox (JavaScript)
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
for (let i = 0; i < 8; i++) {
  console.log(\`fib(\${i}) = \${fib(i)}\`);
}
`,
  python: `# 환영합니다 — PolyMath Sandbox (Python)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

for i in range(8):
    print(f"fib({i}) = {fib(i)}")
`,
};

interface LocalInfo {
  ok: boolean;
  python?: { cmd: string; version: string };
  pip?: { version: string };
  message?: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  durationMs: number;
}

export default function SandboxPage() {
  const [lang, setLang] = useState<Lang>("javascript");
  const [pyRuntime, setPyRuntime] = useState<PyRuntime>("pyodide");
  const [code, setCode] = useState<Record<Lang, string>>(DEFAULT_CODE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [hint, setHint] = useState<string>("");
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const [pipPkg, setPipPkg] = useState("");
  const [pipping, setPipping] = useState(false);
  const [pipResult, setPipResult] = useState<string>("");

  useEffect(() => {
    fetch("/api/local-info")
      .then((r) => r.json())
      .then(setLocalInfo)
      .catch(() => setLocalInfo({ ok: false, message: "로컬 서버 응답 없음" }));
  }, []);

  async function pipInstall() {
    const name = pipPkg.trim();
    if (!name || pipping) return;
    setPipping(true);
    setPipResult("");
    try {
      const res = await fetch("/api/local-pip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: name }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
        durationMs?: number;
      };
      const lines = [
        data.ok ? `✅ ${name} 설치 성공 (${data.durationMs}ms)` : `❌ 실패`,
        data.stdout?.trim(),
        data.stderr?.trim(),
        data.error,
      ]
        .filter(Boolean)
        .join("\n\n");
      setPipResult(lines);
      if (data.ok) setPipPkg("");
    } finally {
      setPipping(false);
    }
  }

  async function run() {
    setRunning(true);
    setHint("");
    try {
      if (lang === "python" && pyRuntime === "local") {
        const res = await fetch("/api/execute-local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "python", code: code.python }),
        });
        const data = (await res.json()) as {
          stdout?: string;
          stderr?: string;
          durationMs?: number;
          error?: string;
        };
        setResult({
          stdout: data.stdout ?? "",
          stderr: data.stderr ?? data.error ?? "",
          durationMs: data.durationMs ?? 0,
        });
      } else if (lang === "python") {
        setResult(await runPython(code.python));
      } else {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "javascript", code: code.javascript }),
        });
        setResult((await res.json()) as RunResult);
      }
    } finally {
      setRunning(false);
    }
  }

  async function askHint() {
    if (!result?.stderr) {
      setHint(
        "현재 에러가 감지되지 않았습니다. 코드를 실행한 뒤 다시 시도해 주세요.",
      );
      return;
    }
    setHint("튜터가 힌트를 준비 중…");
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withAiCredentials({
            level: "intermediate",
            context: `사용자가 다음 ${lang} 코드를 실행했습니다:\n\n${code[lang]}\n\n에러 출력:\n${result.stderr}`,
            messages: [
              {
                role: "user",
                content:
                  "정답을 바로 알려주지 말고, 어디를 먼저 살펴봐야 할지 소크라테스식 힌트 1~2개만 주세요.",
              },
            ],
          }),
        ),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      setHint(data.text ?? `오류: ${data.error}`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : String(err));
    }
  }

  function clearOutput() {
    setResult(null);
    setHint("");
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">즉시 실행 샌드박스</h1>
          <p className="text-sm text-muted">
            브라우저 안에서 바로 JS 코드를 돌려보세요. 에러가 나면 "힌트" 버튼으로
            소크라테스식 디버깅을 받을 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearOutput} className="btn-ghost">
            <Trash2 className="h-4 w-4" />
            출력 지우기
          </button>
          <button onClick={run} disabled={running} className="btn-primary">
            <Play className="h-4 w-4" />
            {running ? "실행 중…" : "실행"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
            <div className="text-xs text-muted">
              {lang === "javascript" ? "main.js" : "main.py"}
            </div>
            <div className="flex items-center gap-1">
              <LangTab active={lang === "javascript"} onClick={() => setLang("javascript")}>
                JavaScript
              </LangTab>
              <LangTab active={lang === "python"} onClick={() => setLang("python")}>
                Python
              </LangTab>
            </div>
          </div>
          <div className="h-[520px]">
            <MonacoEditor
              value={code[lang]}
              onChange={(v) => setCode((prev) => ({ ...prev, [lang]: v ?? "" }))}
              language={lang}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 12 },
              }}
            />
          </div>
        </section>

        <section className="card flex h-[574px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Terminal className="h-3.5 w-3.5" />
              터미널
            </div>
            {result && (
              <div className="chip">
                {result.durationMs}ms{result.stderr ? " · 에러" : ""}
              </div>
            )}
          </div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">
            {result ? (
              <>
                {result.stdout && (
                  <span className="text-white">{result.stdout}</span>
                )}
                {result.stderr && (
                  <span className="text-red-400">
                    {result.stdout ? "\n" : ""}
                    {result.stderr}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted">실행 결과가 여기에 표시됩니다.</span>
            )}
          </pre>
          <div className="border-t border-white/5 p-3">
            <button onClick={askHint} className="btn-ghost w-full">
              <Lightbulb className="h-4 w-4 text-accent-500" />
              소크라테스식 힌트 받기
            </button>
            {hint && (
              <div className="mt-3 whitespace-pre-wrap rounded-xl border border-accent-500/30 bg-accent-500/5 p-3 text-xs text-white">
                {hint}
              </div>
            )}
          </div>
        </section>
      </div>
      {lang === "python" && (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Python 런타임</div>
            <div className="flex gap-1">
              <RuntimeTab
                active={pyRuntime === "pyodide"}
                onClick={() => setPyRuntime("pyodide")}
                icon={Globe}
              >
                브라우저 (Pyodide)
              </RuntimeTab>
              <RuntimeTab
                active={pyRuntime === "local"}
                onClick={() => setPyRuntime("local")}
                icon={Server}
                disabled={localInfo !== null && !localInfo.ok}
                badge={
                  localInfo?.ok
                    ? "활성"
                    : localInfo === null
                      ? "탐지 중"
                      : "미설치"
                }
              >
                로컬 서버
              </RuntimeTab>
            </div>
          </div>

          {pyRuntime === "pyodide" && <PythonPackageManager />}

          {pyRuntime === "local" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/5 bg-bg-elevated/60 p-3 text-xs">
                {localInfo?.ok ? (
                  <>
                    <div className="font-semibold text-accent-500">✓ 로컬 Python 감지됨</div>
                    <div className="mt-1 text-muted-strong">
                      {localInfo.python?.version} · {localInfo.python?.cmd}
                    </div>
                    {localInfo.pip && (
                      <div className="mt-0.5 text-muted">{localInfo.pip.version}</div>
                    )}
                  </>
                ) : localInfo === null ? (
                  <div className="text-muted">로컬 Python 탐지 중…</div>
                ) : (
                  <div className="text-red-400">
                    ⚠ 로컬 Python 을 찾지 못했습니다. {localInfo.message}
                  </div>
                )}
              </div>

              {localInfo?.ok && (
                <div>
                  <div className="label flex items-center gap-1.5">
                    <Package2 className="h-3 w-3" />
                    pip install
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={pipPkg}
                      onChange={(e) => setPipPkg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && pipInstall()}
                      placeholder="pygame, numpy, requests, flask …"
                      className="input"
                      disabled={pipping}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button
                      onClick={pipInstall}
                      disabled={pipping || !pipPkg.trim()}
                      className="btn-primary shrink-0"
                    >
                      {pipping ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          설치 중…
                        </>
                      ) : (
                        "설치"
                      )}
                    </button>
                  </div>
                  {pipResult && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-2 font-mono text-[11px] leading-relaxed">
                      {pipResult}
                    </pre>
                  )}
                  <div className="mt-2 text-[11px] text-muted">
                    설치는 시스템 Python 에 영구 반영됩니다. 가상환경을 쓰고 싶으면 터미널에서{" "}
                    <code className="rounded bg-white/5 px-1">python -m venv .venv</code> 로
                    분리하세요. 큰 패키지(numpy, scipy)는 몇 분까지 걸릴 수 있습니다.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {lang === "python" && pyRuntime === "pyodide" && (
        <div className="text-xs text-muted">
          첫 실행 시 Pyodide 런타임(약 10MB)이 CDN에서 로드됩니다. 몇 초 소요될 수 있습니다.
          설치한 패키지는 페이지를 새로 고치기 전까지 유지됩니다.
        </div>
      )}
      {lang === "python" && pyRuntime === "local" && (
        <div className="text-xs text-muted">
          코드가 당신 PC 의 실제 Python 으로 실행됩니다. 네이티브 확장·GUI 포함 전 패키지 지원.
          <strong className="text-amber-300"> 민감한 명령은 신중히</strong> — 서버는 localhost 에서만 돌지만 서브프로세스 권한은 당신 사용자 그대로입니다.
        </div>
      )}
    </div>
  );
}

function RuntimeTab({
  active,
  onClick,
  icon: Icon,
  children,
  disabled,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Server;
  children: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-brand-500/60 bg-brand-500/15 text-white"
          : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
      {badge && (
        <span
          className={`rounded px-1 py-0.5 text-[10px] ${
            badge === "활성"
              ? "bg-accent-500/20 text-accent-500"
              : badge === "미설치"
                ? "bg-red-400/15 text-red-300"
                : "bg-white/5 text-muted"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function LangTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
        active
          ? "bg-brand-500/20 text-brand-500"
          : "text-muted hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
