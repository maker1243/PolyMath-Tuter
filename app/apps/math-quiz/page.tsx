"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Flame,
  RotateCcw,
  Timer,
  Trophy,
  X,
} from "lucide-react";

type Op = "+" | "-" | "×" | "÷";
type Level = "easy" | "medium" | "hard";

interface Problem {
  id: number;
  a: number;
  b: number;
  op: Op;
  answer: number;
  display: string; // "12 × 7"
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genProblem(id: number, level: Level, ops: Op[]): Problem {
  const op = ops[rand(0, ops.length - 1)];
  let a = 0,
    b = 0,
    ans = 0;
  // 레벨별 숫자 범위
  const ranges: Record<Level, { add: [number, number]; mul: [number, number]; div: [number, number] }> = {
    easy: { add: [1, 20], mul: [1, 9], div: [1, 9] },
    medium: { add: [10, 99], mul: [2, 12], div: [2, 12] },
    hard: { add: [50, 999], mul: [11, 25], div: [11, 25] },
  };
  const r = ranges[level];
  switch (op) {
    case "+":
      a = rand(...r.add);
      b = rand(...r.add);
      ans = a + b;
      break;
    case "-":
      a = rand(...r.add);
      b = rand(1, a); // 음수 방지
      ans = a - b;
      break;
    case "×":
      a = rand(...r.mul);
      b = rand(...r.mul);
      ans = a * b;
      break;
    case "÷":
      // 나누어 떨어지는 문제만: b * quotient = a
      b = rand(...r.div);
      const quotient = rand(2, r.div[1]);
      a = b * quotient;
      ans = quotient;
      break;
  }
  return { id, a, b, op, answer: ans, display: `${a} ${op} ${b}` };
}

const DEFAULT_COUNT = 10;

export default function MathQuizPage() {
  const [level, setLevel] = useState<Level>("easy");
  const [ops, setOps] = useState<Op[]>(["+", "-"]);
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<{ pid: number; correct: boolean; given: string }[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const phase: "setup" | "playing" | "done" =
    problems.length === 0
      ? "setup"
      : idx < problems.length
        ? "playing"
        : "done";

  // 타이머
  useEffect(() => {
    if (phase !== "playing" || !startedAt) return;
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(t);
  }, [phase, startedAt]);

  // 새 문제 뜨면 input 자동 포커스
  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase, idx]);

  function toggleOp(op: Op) {
    setOps((prev) =>
      prev.includes(op)
        ? prev.length > 1
          ? prev.filter((x) => x !== op)
          : prev
        : [...prev, op],
    );
  }

  function start() {
    if (ops.length === 0) return;
    const ps = Array.from({ length: count }, (_, i) => genProblem(i, level, ops));
    setProblems(ps);
    setIdx(0);
    setInput("");
    setLog([]);
    setStreak(0);
    setMaxStreak(0);
    setElapsed(0);
    setStartedAt(Date.now());
  }

  function reset() {
    setProblems([]);
    setIdx(0);
    setInput("");
    setLog([]);
    setStartedAt(null);
    setElapsed(0);
    setStreak(0);
    setMaxStreak(0);
  }

  const submit = useCallback(() => {
    if (phase !== "playing") return;
    const current = problems[idx];
    const parsed = parseFloat(input.trim());
    if (!Number.isFinite(parsed)) return;
    const correct = parsed === current.answer;
    setLog((prev) => [...prev, { pid: current.id, correct, given: input.trim() }]);
    setStreak((prev) => {
      const next = correct ? prev + 1 : 0;
      setMaxStreak((m) => Math.max(m, next));
      return next;
    });
    setInput("");
    setIdx((i) => i + 1);
  }, [phase, problems, idx, input]);

  const stats = useMemo(() => {
    const total = log.length;
    const correct = log.filter((l) => l.correct).length;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, wrong, accuracy };
  }, [log]);

  // 완료 시 활동 로그 자동 전송
  useEffect(() => {
    if (phase !== "done" || !startedAt) return;
    fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "math_drill",
        meta: {
          level,
          count: problems.length,
          correct: stats.correct,
          wrong: stats.wrong,
          accuracy: stats.accuracy,
          elapsed,
          maxStreak,
          ops: ops.join(""),
        },
      }),
    }).catch(() => {
      /* non-critical */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
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
            {streak >= 3 && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Flame className="h-3 w-3" />
                {streak} 연속!
              </span>
            )}
            <span className="text-muted">
              {idx + 1} / {problems.length}
            </span>
          </div>
        )}
      </div>

      <header>
        <div className="mb-2 text-3xl">🔢</div>
        <h1 className="text-2xl font-bold">수학 사칙연산 드릴</h1>
        <p className="mt-1 text-xs text-muted">
          레벨과 연산을 고르고 시작하세요. Enter 키로 빠르게 제출할 수 있어요.
        </p>
      </header>

      {phase === "setup" && (
        <div className="card space-y-5 p-6">
          <div>
            <div className="label">레벨</div>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as Level[]).map((l) => (
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
                  {{ easy: "초급 (한자리~두자리)", medium: "중급 (두자리)", hard: "고급 (세자리)" }[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">연산 (복수 선택)</div>
            <div className="flex gap-2">
              {(["+", "-", "×", "÷"] as Op[]).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => toggleOp(op)}
                  aria-pressed={ops.includes(op)}
                  className={`flex-1 rounded-xl border px-3 py-3 text-xl font-mono transition-colors ${
                    ops.includes(op)
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">문항 수</div>
            <div className="flex gap-2">
              {[10, 20, 30, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    count === n
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={ops.length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            시작!
          </button>
        </div>
      )}

      {phase === "playing" && problems[idx] && (
        <div className="card space-y-5 p-8">
          {/* 진행률 바 */}
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(idx / problems.length) * 100}%` }}
            />
          </div>
          <div className="text-center">
            <div className="font-mono text-5xl tracking-wide text-white">
              {problems[idx].display} = ?
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="답을 입력하고 Enter"
              className="input text-center text-2xl"
              autoFocus
            />
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              className="btn-primary"
            >
              제출 (Enter)
            </button>
          </div>
          {/* 바로 직전 결과 피드백 */}
          {log.length > 0 && (() => {
            const last = log[log.length - 1];
            const prev = problems.find((p) => p.id === last.pid);
            if (!prev) return null;
            return (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  last.correct
                    ? "border-accent-500/40 bg-accent-500/10 text-accent-500"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                {last.correct ? (
                  <>
                    <Check className="mr-1 inline h-3 w-3" />
                    정답! {prev.display} = {prev.answer}
                  </>
                ) : (
                  <>
                    <X className="mr-1 inline h-3 w-3" />
                    오답. {prev.display} = <strong>{prev.answer}</strong> (내 답:{" "}
                    {last.given})
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-5">
          <div className="card space-y-4 p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-300" />
            <h2 className="text-xl font-semibold">완료!</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="정답" value={`${stats.correct}/${stats.total}`} />
              <Kpi label="정확도" value={`${stats.accuracy}%`} />
              <Kpi label="시간" value={`${elapsed}초`} />
              <Kpi label="최대 연속" value={`${maxStreak}`} />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={start}
                className="btn-primary"
              >
                <RotateCcw className="h-4 w-4" />
                같은 설정으로 다시
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn-ghost"
              >
                설정 바꾸기
              </button>
            </div>
          </div>

          {log.some((l) => !l.correct) && (
            <div className="card space-y-2 p-5">
              <h3 className="text-sm font-semibold">틀린 문제 복습</h3>
              <ul className="space-y-1 font-mono text-xs">
                {log
                  .filter((l) => !l.correct)
                  .map((l) => {
                    const p = problems.find((p) => p.id === l.pid)!;
                    return (
                      <li
                        key={l.pid}
                        className="flex items-center justify-between rounded border border-rose-500/20 bg-rose-500/5 px-3 py-1.5"
                      >
                        <span className="text-white">
                          {p.display} = <strong>{p.answer}</strong>
                        </span>
                        <span className="text-rose-300">내 답: {l.given}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated/40 p-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}
