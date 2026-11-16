"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, Shuffle, Trophy, X } from "lucide-react";
import {
  HISTORY_EVENTS,
  eventsForRegion,
  type HistoryEvent,
} from "@/lib/data/history-events";

type Region = "korea" | "world" | "all";
type Mode = "year-to-event" | "event-to-year";

interface Question {
  event: HistoryEvent;
  choices: string[]; // mode 에 따라 연도 문자열 또는 사건 제목
  correct: string;
}

export default function HistoryQuizPage() {
  const [region, setRegion] = useState<Region>("korea");
  const [mode, setMode] = useState<Mode>("year-to-event");
  const [count, setCount] = useState(10);
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [log, setLog] = useState<Array<"correct" | "wrong">>([]);
  const scoreReportedRef = useRef(false);

  const phase: "setup" | "playing" | "done" =
    quiz.length === 0 ? "setup" : idx < quiz.length ? "playing" : "done";

  const current = quiz[idx];

  function formatYear(y: number): string {
    return y < 0 ? `기원전 ${-y}년` : `${y}년`;
  }

  function buildQuiz() {
    const pool = eventsForRegion(region);
    if (pool.length < 4) return;
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    const qs: Question[] = picked.map((event) => {
      const distractors = shuffle(pool.filter((e) => e.year !== event.year)).slice(0, 3);
      if (mode === "year-to-event") {
        // 연도 보여주고 → 사건 4지선다
        const correct = event.title;
        const choices = shuffle([correct, ...distractors.map((d) => d.title)]);
        return { event, choices, correct };
      } else {
        // 사건 보여주고 → 연도 4지선다
        const correct = formatYear(event.year);
        const choices = shuffle([correct, ...distractors.map((d) => formatYear(d.year))]);
        return { event, choices, correct };
      }
    });
    setQuiz(qs);
    setIdx(0);
    setPicked(null);
    setLog([]);
    scoreReportedRef.current = false;
  }

  function reset() {
    setQuiz([]);
    setIdx(0);
    setPicked(null);
    setLog([]);
    scoreReportedRef.current = false;
  }

  function pick(choice: string) {
    if (picked) return;
    setPicked(choice);
    const correct = choice === current.correct;
    setLog((prev) => [...prev, correct ? "correct" : "wrong"]);
    setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
    }, 1400);
  }

  const stats = useMemo(() => {
    const correct = log.filter((x) => x === "correct").length;
    const wrong = log.length - correct;
    return {
      correct,
      wrong,
      total: log.length,
      accuracy: log.length > 0 ? Math.round((correct / log.length) * 100) : 0,
    };
  }, [log]);

  useEffect(() => {
    if (phase !== "done" || scoreReportedRef.current) return;
    scoreReportedRef.current = true;
    fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "history_quiz",
        meta: {
          region,
          mode,
          count: quiz.length,
          correct: stats.correct,
          wrong: stats.wrong,
          accuracy: stats.accuracy,
        },
      }),
    }).catch(() => undefined);
  }, [phase, stats, quiz.length, region, mode]);

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
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              {idx + 1} / {quiz.length}
            </span>
            <span className="text-accent-500">✓ {stats.correct}</span>
            <span className="text-rose-300">✗ {stats.wrong}</span>
          </div>
        )}
      </div>

      <header>
        <div className="mb-2 text-3xl">📜</div>
        <h1 className="text-2xl font-bold">역사 연표 퀴즈</h1>
        <p className="mt-1 text-xs text-muted">
          한국사·세계사 주요 사건을 연도·사건 양방향으로 맞춥니다. 4지선다 즉시 채점.
        </p>
      </header>

      {phase === "setup" && (
        <div className="card space-y-5 p-6">
          <div>
            <div className="label">범주</div>
            <div className="flex gap-2">
              {(["korea", "world", "all"] as Region[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  aria-pressed={region === r}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    region === r
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {{ korea: "한국사", world: "세계사", all: "전체" }[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">문제 유형</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("year-to-event")}
                aria-pressed={mode === "year-to-event"}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === "year-to-event"
                    ? "border-brand-500/60 bg-brand-500/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">연도 → 사건</div>
                <div className="mt-0.5 text-[10px] text-muted">"1392년에 일어난 일은?"</div>
              </button>
              <button
                type="button"
                onClick={() => setMode("event-to-year")}
                aria-pressed={mode === "event-to-year"}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === "event-to-year"
                    ? "border-brand-500/60 bg-brand-500/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">사건 → 연도</div>
                <div className="mt-0.5 text-[10px] text-muted">"조선 건국은 몇 년?"</div>
              </button>
            </div>
          </div>
          <div>
            <div className="label">문항 수</div>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
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
          <button type="button" onClick={buildQuiz} className="btn-primary w-full py-3 text-base">
            <Shuffle className="h-4 w-4" />
            문제 섞어서 시작
          </button>
          <p className="text-[10px] text-muted">
            전체 사건 {HISTORY_EVENTS.length}개 · 선택 범주 {eventsForRegion(region).length}개 보유
          </p>
        </div>
      )}

      {phase === "playing" && current && (
        <div className="space-y-4">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(idx / quiz.length) * 100}%` }}
            />
          </div>

          <div className="card space-y-2 p-6 text-center">
            <div className="text-[10px] text-muted">
              {current.event.region === "korea" ? "🇰🇷 한국사" : "🌍 세계사"} ·{" "}
              {{ ancient: "고대", medieval: "중세", modern: "근대", contemporary: "현대" }[current.event.era]}
            </div>
            {mode === "year-to-event" ? (
              <div className="text-4xl font-bold text-white">
                {formatYear(current.event.year)}
              </div>
            ) : (
              <div className="text-2xl font-bold text-white">{current.event.title}</div>
            )}
            <div className="text-[11px] text-muted">
              {mode === "year-to-event"
                ? "이 해에 일어난 사건은?"
                : "이 사건이 일어난 해는?"}
            </div>
          </div>

          <div className="grid gap-2">
            {current.choices.map((c) => {
              const isPicked = picked === c;
              const isCorrect = picked && c === current.correct;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pick(c)}
                  disabled={!!picked}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    !picked
                      ? "border-white/10 bg-white/[0.02] hover:border-brand-500/50 hover:bg-white/[0.05]"
                      : isCorrect
                        ? "border-accent-500/60 bg-accent-500/20 text-accent-500"
                        : isPicked
                          ? "border-rose-500/60 bg-rose-500/20 text-rose-300"
                          : "border-white/5 bg-white/[0.01] text-muted opacity-50"
                  }`}
                >
                  <span className="mr-2">
                    {picked && isCorrect ? (
                      <Check className="inline h-3 w-3" />
                    ) : picked && isPicked ? (
                      <X className="inline h-3 w-3" />
                    ) : null}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="rounded-lg border border-white/10 bg-bg-elevated/40 p-3 text-xs text-muted-strong">
              💡 <strong className="text-white">{current.event.title}</strong> ({formatYear(current.event.year)})
              — {current.event.description}
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-5">
          <div className="card space-y-4 p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-300" />
            <h2 className="text-xl font-semibold">완료!</h2>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="정답" value={`${stats.correct}`} tone="accent" />
              <Kpi label="오답" value={`${stats.wrong}`} tone="rose" />
              <Kpi label="정확도" value={`${stats.accuracy}%`} />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={buildQuiz} className="btn-primary">
                <RotateCcw className="h-4 w-4" />
                같은 설정으로 다시
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                설정 바꾸기
              </button>
            </div>
          </div>
          {stats.wrong > 0 && (
            <div className="card space-y-2 p-5">
              <h3 className="text-sm font-semibold">틀린 문제 복습</h3>
              <ul className="space-y-1.5">
                {quiz
                  .filter((_, i) => log[i] === "wrong")
                  .map((q, i) => (
                    <li
                      key={i}
                      className="rounded border border-rose-500/20 bg-rose-500/5 p-3 text-xs"
                    >
                      <div className="font-semibold text-white">
                        {formatYear(q.event.year)} — {q.event.title}
                      </div>
                      <div className="mt-0.5 text-muted">{q.event.description}</div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "rose";
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated/40 p-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold ${
          tone === "accent"
            ? "text-accent-500"
            : tone === "rose"
              ? "text-rose-300"
              : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
