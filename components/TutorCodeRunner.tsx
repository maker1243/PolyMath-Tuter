"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Play, Trash2, Send, Code2, X, Terminal, Package } from "lucide-react";
import { runPython } from "@/lib/pyodide";
import { PythonPackageManager } from "./PythonPackageManager";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted">
      에디터 로딩 중…
    </div>
  ),
});

export type CodeLang = "javascript" | "python";

export interface CodeTask {
  language: CodeLang;
  code: string;
  /** 변경이 감지되면 에디터 내용이 갱신됨 */
  seed: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface Props {
  task: CodeTask;
  onClose: () => void;
  onSubmitResult?: (result: string) => void;
}

export function TutorCodeRunner({ task, onClose, onSubmitResult }: Props) {
  const [lang, setLang] = useState<CodeLang>(task.language);
  const [code, setCode] = useState(task.code);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showPackages, setShowPackages] = useState(false);

  // 튜터가 새 과제를 내면 에디터 내용 교체 (seed 변경 감지)
  useEffect(() => {
    setLang(task.language);
    setCode(task.code);
    setResult(null);
  }, [task.seed]);

  async function run() {
    setRunning(true);
    try {
      if (lang === "python") {
        setResult(await runPython(code));
      } else {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "javascript", code }),
        });
        setResult((await res.json()) as RunResult);
      }
    } finally {
      setRunning(false);
    }
  }

  function sendBack() {
    if (!result || !onSubmitResult) return;
    const summary = [
      `방금 ${lang === "python" ? "Python" : "JavaScript"} 코드를 실행했어요.`,
      "",
      "```" + lang,
      code,
      "```",
      "",
      "출력:",
      "```",
      result.stderr ? `[에러]\n${result.stderr}` : result.stdout || "(출력 없음)",
      "```",
    ].join("\n");
    onSubmitResult(summary);
  }

  return (
    <section className="card flex h-[calc(100vh-10rem)] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-accent-500" />
          코드 실습
        </div>
        <div className="flex items-center gap-1">
          <LangTab active={lang === "javascript"} onClick={() => setLang("javascript")}>
            JS
          </LangTab>
          <LangTab active={lang === "python"} onClick={() => setLang("python")}>
            Py
          </LangTab>
          {lang === "python" && (
            <button
              onClick={() => setShowPackages((v) => !v)}
              className={`ml-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                showPackages
                  ? "bg-accent-500/20 text-accent-500"
                  : "text-muted hover:bg-white/5 hover:text-white"
              }`}
              title="Python 패키지 설치"
            >
              <Package className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 rounded-md p-1 text-muted hover:bg-white/5 hover:text-white"
            aria-label="코드 패널 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {lang === "python" && showPackages && (
        <div className="border-b border-white/5 bg-bg-elevated/40 p-3">
          <PythonPackageManager
            compact
            onInstalled={(name) => {
              // import 자동 삽입 — 커서 위치 상관없이 코드 상단에 한 줄 추가
              const importLine = `import ${name.replace(/-ce$/, "").replace(/-/g, "_")}\n`;
              if (!code.includes(importLine.trim())) {
                setCode(importLine + code);
              }
            }}
          />
        </div>
      )}

      <div className="min-h-[260px] flex-[1_1_60%]">
        <MonacoEditor
          value={code}
          onChange={(v) => setCode(v ?? "")}
          language={lang}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            padding: { top: 8 },
            lineNumbers: "on",
          }}
        />
      </div>

      <div className="flex items-center justify-between border-y border-white/5 bg-bg-elevated/40 px-3 py-1.5 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3 w-3" />
          터미널
          {result && <span className="ml-2 chip">{result.durationMs}ms</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setResult(null)}
            className="rounded px-2 py-0.5 text-xs text-muted hover:bg-white/5 hover:text-white"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1 rounded bg-brand-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {running ? "실행…" : "실행"}
          </button>
        </div>
      </div>

      <pre className="min-h-[80px] flex-[1_1_40%] overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed">
        {result ? (
          <>
            {result.stdout && <span className="text-white">{result.stdout}</span>}
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

      {onSubmitResult && (
        <div className="border-t border-white/5 p-2">
          <button
            onClick={sendBack}
            disabled={!result}
            className="btn-ghost w-full text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            결과를 튜터에게 보내기
          </button>
        </div>
      )}
    </section>
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
      className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
        active
          ? "bg-brand-500/20 text-brand-500"
          : "text-muted hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** 비주얼/비코드 fence 태그 — 코드 패널에 넣지 않음. */
const NON_CODE_FENCES = new Set([
  "mermaid",
  "svg",
  "plot",
  "chart",
  "tts",
  "ipa",
  "hanja",
  "math",
  "latex",
  "tex",
  "diff",
  "md",
  "markdown",
  "txt",
  "text",
  "json",
  "yaml",
  "yml",
  "toml",
  "csv",
  "sql",
  "html",
  "css",
  "bash",
  "sh",
  "shell",
  "powershell",
  "ps1",
]);

/** 어시스턴트 메시지에서 코드 블록 또는 코딩 과제 신호를 감지. */
export function detectCodeTask(text: string): CodeTask | null {
  // 1) fenced code block — 모든 fence 를 순회해서 실제 코드 언어만 집기
  const fenceRe = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let fence: RegExpExecArray | null;
  while ((fence = fenceRe.exec(text)) !== null) {
    const raw = (fence[1] ?? "").toLowerCase();
    // 비주얼 블럭 (mermaid/svg/plot) 과 비코드 포맷 (json/md 등) 은 건너뜀
    if (NON_CODE_FENCES.has(raw)) continue;
    const language: CodeLang =
      raw === "py" || raw === "python" ? "python" : "javascript";
    return {
      language,
      code: fence[2].trim() || starterFor(language),
      seed: fence[2].trim().slice(0, 80) || `empty-${language}`,
    };
  }

  // 2) 과제 키워드 — 코드는 없지만 코딩 실습을 유도하는 표현
  if (
    /(코딩\s*(실습|과제|챌린지|해보)|코드를?\s*(짜|작성|직접|구현)|직접\s*(실행|구현|해보)|실행\s*해\s*보|함수를?\s*(만들|작성)|구현해\s*보)/i.test(
      text,
    )
  ) {
    const language: CodeLang = /파이썬|python/i.test(text) ? "python" : "javascript";
    return {
      language,
      code: starterFor(language),
      seed: `prompted-${language}-${text.length}`,
    };
  }

  return null;
}

function starterFor(language: CodeLang): string {
  if (language === "python") {
    return `# 여기에 코드를 작성해 보세요.\n\n`;
  }
  return `// 여기에 코드를 작성해 보세요.\n\n`;
}
