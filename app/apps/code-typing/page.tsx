"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Shuffle, Timer, Trophy } from "lucide-react";
import {
  TYPING_SNIPPETS,
  snippetsFor,
  type TypingLang,
  type TypingLevel,
  type TypingSnippet,
} from "@/lib/data/typing-snippets";

export default function CodeTypingPage() {
  const [lang, setLang] = useState<TypingLang | "all">("python");
  const [level, setLevel] = useState<TypingLevel | "all">("short");
  const [snippet, setSnippet] = useState<TypingSnippet | null>(null);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scoreReportedRef = useRef(false);

  const phase: "setup" | "playing" | "done" = !snippet
    ? "setup"
    : finishedAt
      ? "done"
      : "playing";

  useEffect(() => {
    if (phase !== "playing" || !startedAt || finishedAt) return;
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(t);
  }, [phase, startedAt, finishedAt]);

  useEffect(() => {
    if (phase === "playing") textareaRef.current?.focus();
  }, [phase, snippet]);

  function start() {
    const pool = snippetsFor(lang, level);
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setSnippet(picked);
    setTyped("");
    setStartedAt(null); // 첫 입력 시 시작
    setFinishedAt(null);
    setElapsed(0);
    scoreReportedRef.current = false;
  }

  function pickDifferent() {
    const pool = snippetsFor(lang, level).filter((s) => s.id !== snippet?.id);
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setSnippet(picked);
    setTyped("");
    setStartedAt(null);
    setFinishedAt(null);
    setElapsed(0);
    scoreReportedRef.current = false;
  }

  function reset() {
    setSnippet(null);
    setTyped("");
    setStartedAt(null);
    setFinishedAt(null);
    setElapsed(0);
    scoreReportedRef.current = false;
  }

  function onType(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (!startedAt && val.length > 0) setStartedAt(Date.now());
    setTyped(val);
    if (snippet && val === snippet.code) {
      setFinishedAt(Date.now());
    }
  }

  const stats = useMemo(() => {
    if (!snippet) return { correctChars: 0, totalChars: 0, accuracy: 0, wpm: 0, cpm: 0 };
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (snippet.code[i] === typed[i]) correct++;
    }
    const totalChars = typed.length;
    const accuracy = totalChars === 0 ? 100 : Math.round((correct / totalChars) * 100);
    const minutes = elapsed > 0 ? elapsed / 60 : 1 / 60;
    // 전통적 WPM = 분당 단어수 (단어 ≈ 5자)
    const wpm = Math.round(correct / 5 / minutes);
    const cpm = Math.round(correct / minutes);
    return { correctChars: correct, totalChars, accuracy, wpm, cpm };
  }, [typed, snippet, elapsed]);

  const finalElapsed =
    startedAt && finishedAt ? Math.floor((finishedAt - startedAt) / 1000) : elapsed;

  useEffect(() => {
    if (phase !== "done" || !snippet || scoreReportedRef.current) return;
    scoreReportedRef.current = true;
    fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "typing_drill",
        meta: {
          lang: snippet.lang,
          level: snippet.level,
          id: snippet.id,
          chars: snippet.code.length,
          elapsed: finalElapsed,
          wpm: stats.wpm,
          cpm: stats.cpm,
          accuracy: stats.accuracy,
        },
      }),
    }).catch(() => undefined);
  }, [phase, snippet, stats, finalElapsed]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/apps"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          학습 앱
        </Link>
        {phase === "playing" && (
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-accent-500">
              <Timer className="h-3 w-3" />
              {elapsed}초
            </span>
            <span className="text-muted">
              {typed.length} / {snippet?.code.length} 자
            </span>
            <span className="text-muted-strong">정확도 {stats.accuracy}%</span>
          </div>
        )}
      </div>

      <header>
        <div className="mb-2 text-3xl">⌨️</div>
        <h1 className="text-2xl font-bold">코드 타이핑 드릴</h1>
        <p className="mt-1 text-xs text-muted">
          스니펫을 보고 그대로 타이핑. 정확하게 입력한 글자만 WPM 에 반영됩니다.
          개행과 공백까지 100% 일치해야 완료.
        </p>
      </header>

      {phase === "setup" && (
        <div className="card space-y-5 p-6">
          <div>
            <div className="label">언어</div>
            <div className="flex gap-2">
              {(["python", "javascript", "typescript", "all"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    lang === l
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {{ python: "Python", javascript: "JavaScript", typescript: "TypeScript", all: "전체" }[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">난이도</div>
            <div className="flex gap-2">
              {(["short", "medium", "all"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    level === l
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {{ short: "짧은 (10줄 내외)", medium: "중간 (20줄 내외)", all: "전체" }[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted">
            선택 범위에 {snippetsFor(lang, level).length}개 스니펫 있음 ({TYPING_SNIPPETS.length}개 전체 중)
          </div>
          <button
            type="button"
            onClick={start}
            disabled={snippetsFor(lang, level).length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            <Shuffle className="h-4 w-4" />
            랜덤 스니펫 시작
          </button>
        </div>
      )}

      {phase === "playing" && snippet && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              📄 {snippet.title}{" "}
              <span className="text-muted">
                [{snippet.lang} · {snippet.level}]
              </span>
            </span>
            <button
              type="button"
              onClick={pickDifferent}
              className="rounded-full border border-white/10 px-2 py-0.5 hover:border-accent-500/40 hover:text-accent-500"
              title="다른 스니펫으로"
            >
              <Shuffle className="inline h-3 w-3" /> 다른 스니펫
            </button>
          </div>

          {/* 참고 코드 (한 글자씩 색상) */}
          <pre className="overflow-x-auto rounded-xl border border-white/5 bg-bg-elevated/40 p-4 font-mono text-sm leading-relaxed">
            {snippet.code.split("").map((ch, i) => {
              let cls = "text-muted"; // 아직 입력 안 함
              if (i < typed.length) {
                cls = typed[i] === ch ? "text-accent-500" : "text-rose-300 bg-rose-500/20";
              } else if (i === typed.length) {
                cls = "text-white bg-brand-500/40";
              }
              return (
                <span key={i} className={cls}>
                  {ch === "\n" ? "↵\n" : ch}
                </span>
              );
            })}
          </pre>

          <textarea
            ref={textareaRef}
            value={typed}
            onChange={onType}
            spellCheck={false}
            placeholder="여기에 타이핑하세요 (완료 시 자동 채점)"
            className="h-40 w-full resize-y rounded-xl border border-white/10 bg-bg-elevated/40 p-3 font-mono text-sm text-white outline-none focus:border-brand-500/50"
          />

          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="정확도" value={`${stats.accuracy}%`} />
            <Mini label="WPM" value={`${stats.wpm}`} />
            <Mini label="CPM" value={`${stats.cpm}`} />
          </div>
        </div>
      )}

      {phase === "done" && snippet && (
        <div className="space-y-5">
          <div className="card space-y-4 p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-300" />
            <h2 className="text-xl font-semibold">완료!</h2>
            <p className="text-xs text-muted">
              {snippet.title} ({snippet.lang} · {snippet.level})
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="시간" value={`${finalElapsed}초`} />
              <Kpi label="WPM" value={`${stats.wpm}`} tone="accent" />
              <Kpi label="CPM" value={`${stats.cpm}`} />
              <Kpi label="정확도" value={`${stats.accuracy}%`} />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={pickDifferent} className="btn-primary">
                <Shuffle className="h-4 w-4" />
                다른 스니펫
              </button>
              <button type="button" onClick={() => start()} className="btn-ghost">
                <RotateCcw className="h-4 w-4" />
                같은 설정으로
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                설정 바꾸기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-bg-elevated/40 p-2">
      <div className="text-[9px] text-muted">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated/40 p-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold ${
          tone === "accent" ? "text-accent-500" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
