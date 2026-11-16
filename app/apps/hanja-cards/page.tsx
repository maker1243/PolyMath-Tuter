"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  RotateCcw,
  Shuffle,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { HANJA_SET, hanjaForLevel, type HanjaEntry } from "@/lib/data/hanja-set";
import { isTtsAvailable, speak } from "@/lib/tts";

type Level = "basic" | "intermediate" | "advanced" | "all";
type Mode = "flip" | "quiz";

export default function HanjaCardsPage() {
  const [level, setLevel] = useState<Level>("basic");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<Mode>("flip");
  const [deck, setDeck] = useState<HanjaEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [log, setLog] = useState<Array<"known" | "unknown">>([]);
  const [quizChoices, setQuizChoices] = useState<string[]>([]);
  const [quizPicked, setQuizPicked] = useState<string | null>(null);
  const scoreReportedRef = useRef(false);
  const ttsOk = isTtsAvailable();

  const phase: "setup" | "playing" | "done" =
    deck.length === 0 ? "setup" : idx < deck.length ? "playing" : "done";

  const current = deck[idx];

  // 퀴즈 모드일 때 4지선다 보기 생성 (현재 한자의 음 포함)
  useEffect(() => {
    if (mode !== "quiz" || phase !== "playing") return;
    const pool = HANJA_SET.filter((h) => h.reading !== current.reading);
    const distractors = shuffle(pool).slice(0, 3).map((h) => h.reading);
    setQuizChoices(shuffle([current.reading, ...distractors]));
    setQuizPicked(null);
  }, [mode, phase, idx, current]);

  function start() {
    const pool = hanjaForLevel(level);
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    setDeck(picked);
    setIdx(0);
    setFlipped(false);
    setLog([]);
    scoreReportedRef.current = false;
  }

  function reset() {
    setDeck([]);
    setIdx(0);
    setFlipped(false);
    setLog([]);
    scoreReportedRef.current = false;
  }

  function next(result?: "known" | "unknown") {
    if (phase !== "playing") return;
    if (result) setLog((prev) => [...prev, result]);
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  function pickQuiz(choice: string) {
    if (quizPicked) return;
    setQuizPicked(choice);
    const correct = choice === current.reading;
    setLog((prev) => [...prev, correct ? "known" : "unknown"]);
    // 1.2초 후 다음
    setTimeout(() => {
      setQuizPicked(null);
      setIdx((i) => i + 1);
    }, 1200);
  }

  function playSpeech() {
    if (!ttsOk || !current) return;
    speak(current.character, { lang: "zh-CN", rate: 0.85 });
  }

  const stats = useMemo(() => {
    const known = log.filter((x) => x === "known").length;
    const unknown = log.filter((x) => x === "unknown").length;
    const total = log.length;
    return {
      known,
      unknown,
      total,
      accuracy: total > 0 ? Math.round((known / total) * 100) : 0,
    };
  }, [log]);

  // 활동 로그
  useEffect(() => {
    if (phase !== "done" || scoreReportedRef.current) return;
    scoreReportedRef.current = true;
    fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "hanja_drill",
        meta: {
          level,
          mode,
          count: deck.length,
          known: stats.known,
          unknown: stats.unknown,
          accuracy: stats.accuracy,
        },
      }),
    }).catch(() => undefined);
  }, [phase, stats, deck.length, level, mode]);

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
              {idx + 1} / {deck.length}
            </span>
            <span className="text-accent-500">✓ {stats.known}</span>
            <span className="text-rose-300">✗ {stats.unknown}</span>
          </div>
        )}
      </div>

      <header>
        <div className="mb-2 text-3xl">🀄</div>
        <h1 className="text-2xl font-bold">한자 플래시카드</h1>
        <p className="mt-1 text-xs text-muted">
          음·훈·부수·획수를 익힙니다. 플립 모드는 자율 확인, 퀴즈 모드는 4지선다
          즉시 채점.
        </p>
      </header>

      {phase === "setup" && (
        <div className="card space-y-5 p-6">
          <div>
            <div className="label">레벨</div>
            <div className="flex gap-2">
              {(["basic", "intermediate", "advanced", "all"] as Level[]).map((l) => (
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
                  {{ basic: "초급", intermediate: "중급", advanced: "고급", all: "전체" }[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">모드</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("flip")}
                aria-pressed={mode === "flip"}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === "flip"
                    ? "border-brand-500/60 bg-brand-500/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">플립 모드</div>
                <div className="mt-0.5 text-[10px] text-muted">카드 뒤집어 음·훈 확인</div>
              </button>
              <button
                type="button"
                onClick={() => setMode("quiz")}
                aria-pressed={mode === "quiz"}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === "quiz"
                    ? "border-brand-500/60 bg-brand-500/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">퀴즈 모드</div>
                <div className="mt-0.5 text-[10px] text-muted">4지선다로 음 맞추기</div>
              </button>
            </div>
          </div>
          <div>
            <div className="label">문항 수</div>
            <div className="flex gap-2">
              {[5, 10, 20, 40].map((n) => (
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
          <button type="button" onClick={start} className="btn-primary w-full py-3 text-base">
            <Shuffle className="h-4 w-4" />
            섞어서 시작
          </button>
        </div>
      )}

      {phase === "playing" && current && (
        <div className="space-y-4">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(idx / deck.length) * 100}%` }}
            />
          </div>

          {mode === "flip" ? (
            <>
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="card flex min-h-[320px] w-full flex-col items-center justify-center gap-3 p-8 transition hover:border-accent-500/40"
              >
                {!flipped ? (
                  <div className="font-serif text-8xl text-white" lang="zh-Hant">
                    {current.character}
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="font-serif text-6xl text-white" lang="zh-Hant">
                      {current.character}
                    </div>
                    <div className="text-2xl text-accent-500">
                      {current.reading} · {current.meaning}
                    </div>
                    <div className="text-xs text-muted">
                      부수 {current.radical} · {current.strokes}획
                    </div>
                  </div>
                )}
                <div className="mt-2 text-[10px] text-muted">
                  카드 클릭 → {flipped ? "한자만 보기" : "음·훈 보기"}
                </div>
              </button>
              {ttsOk && (
                <button type="button" onClick={playSpeech} className="btn-ghost w-full">
                  <Volume2 className="h-4 w-4" />
                  중국어 발음 듣기
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => next("unknown")}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 py-3 text-sm text-rose-200 hover:bg-rose-500/20"
                >
                  <X className="mr-1 inline h-4 w-4" />
                  몰라요
                </button>
                <button
                  type="button"
                  onClick={() => next("known")}
                  className="rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm text-accent-500 hover:bg-accent-500/20"
                >
                  <Check className="mr-1 inline h-4 w-4" />
                  알아요
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="card flex min-h-[220px] w-full flex-col items-center justify-center gap-2 p-8">
                <div className="font-serif text-8xl text-white" lang="zh-Hant">
                  {current.character}
                </div>
                <div className="mt-2 text-xs text-muted">
                  뜻: <span className="text-muted-strong">{current.meaning}</span>
                </div>
              </div>
              <div className="text-center text-xs text-muted">
                이 한자의 <strong className="text-white">음(소리)</strong>은 무엇인가요?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quizChoices.map((c) => {
                  const picked = quizPicked === c;
                  const correctMarker =
                    quizPicked && c === current.reading;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => pickQuiz(c)}
                      disabled={!!quizPicked}
                      className={`rounded-xl border p-3 text-center text-lg transition-colors ${
                        !quizPicked
                          ? "border-white/10 bg-white/[0.02] hover:border-brand-500/50 hover:bg-white/[0.05]"
                          : correctMarker
                            ? "border-accent-500/60 bg-accent-500/20 text-accent-500"
                            : picked
                              ? "border-rose-500/60 bg-rose-500/20 text-rose-300"
                              : "border-white/5 bg-white/[0.01] text-muted opacity-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-5">
          <div className="card space-y-4 p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-300" />
            <h2 className="text-xl font-semibold">완료!</h2>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="알아요" value={`${stats.known}`} tone="accent" />
              <Kpi label="몰라요" value={`${stats.unknown}`} tone="rose" />
              <Kpi label="정확도" value={`${stats.accuracy}%`} />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={start} className="btn-primary">
                <RotateCcw className="h-4 w-4" />
                같은 설정으로 다시
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                설정 바꾸기
              </button>
            </div>
          </div>
          {stats.unknown > 0 && (
            <div className="card space-y-2 p-5">
              <h3 className="text-sm font-semibold">다시 볼 한자 ({stats.unknown}자)</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {deck
                  .filter((_, i) => log[i] === "unknown")
                  .map((h, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded border border-white/5 bg-bg-elevated/40 px-3 py-2"
                    >
                      <span className="font-serif text-2xl text-white" lang="zh-Hant">
                        {h.character}
                      </span>
                      <span className="text-xs text-muted-strong">
                        {h.reading}·{h.meaning}
                      </span>
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
