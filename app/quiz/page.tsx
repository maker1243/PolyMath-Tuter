"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Flame,
  Eye,
  Shuffle,
  Target,
  ChevronRight,
} from "lucide-react";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  sourceId?: string;
}

type Mode = "flip" | "multi" | "mixed";

interface Question {
  cardId: string;
  type: "flip" | "multi";
  front: string;
  back: string;
  choices?: string[]; // multi 전용 — 섞인 4개
  answerIndex?: number; // multi 전용
}

interface Answer {
  cardId: string;
  correct: boolean;
  type: "flip" | "multi";
  elapsedMs: number;
  pickedIndex?: number;
}

type Phase = "setup" | "playing" | "done";

const COUNT_OPTIONS = [5, 10, 20] as const;

export default function QuizPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("setup");

  // 설정
  const [mode, setMode] = useState<Mode>("mixed");
  const [count, setCount] = useState<number>(10);

  // 플레이
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const qStartRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/study/cards", { cache: "no-store" });
      const d = await r.json();
      setCards(d.cards ?? []);
      setLoading(false);
    })();
  }, []);

  const current = questions[index];

  const canMulti = cards.length >= 4;
  const actualCount = Math.min(count, cards.length);

  function buildQuestions(): Question[] {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, actualCount);
    return picked.map((c): Question => {
      const useMulti =
        mode === "multi" || (mode === "mixed" && canMulti && Math.random() < 0.5);
      if (useMulti && canMulti) {
        const others = cards.filter((x) => x.id !== c.id);
        const distractors = others
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((x) => x.back);
        const choices = [c.back, ...distractors].sort(() => Math.random() - 0.5);
        return {
          cardId: c.id,
          type: "multi",
          front: c.front,
          back: c.back,
          choices,
          answerIndex: choices.indexOf(c.back),
        };
      }
      return { cardId: c.id, type: "flip", front: c.front, back: c.back };
    });
  }

  function start() {
    const qs = buildQuestions();
    if (qs.length === 0) return;
    setQuestions(qs);
    setIndex(0);
    setFlipped(false);
    setPicked(null);
    setAnswers([]);
    setStartedAt(Date.now());
    qStartRef.current = Date.now();
    setPhase("playing");
  }

  // 세션 완료 시 활동 로그
  useEffect(() => {
    if (phase === "done" && answers.length > 0) {
      const correct = answers.filter((a) => a.correct).length;
      void fetch("/api/activity/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quiz_completed",
          meta: {
            correct,
            total: answers.length,
            mode,
            avgMs: Math.round(
              answers.reduce((s, a) => s + a.elapsedMs, 0) / answers.length,
            ),
          },
        }),
      }).catch(() => {});
    }
  }, [phase, answers, mode]);

  const nextQ = useCallback(() => {
    setFlipped(false);
    setPicked(null);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      qStartRef.current = Date.now();
    } else {
      setPhase("done");
    }
  }, [index, questions.length]);

  function answerFlip(correct: boolean) {
    if (!current) return;
    setAnswers((prev) => [
      ...prev,
      {
        cardId: current.cardId,
        correct,
        type: "flip",
        elapsedMs: Date.now() - qStartRef.current,
      },
    ]);
    nextQ();
  }

  function answerMulti(choiceIndex: number) {
    if (!current || current.type !== "multi" || picked !== null) return;
    setPicked(choiceIndex);
    const correct = choiceIndex === current.answerIndex;
    setAnswers((prev) => [
      ...prev,
      {
        cardId: current.cardId,
        correct,
        type: "multi",
        elapsedMs: Date.now() - qStartRef.current,
        pickedIndex: choiceIndex,
      },
    ]);
    // 1.2초 후 다음
    setTimeout(nextQ, 1200);
  }

  // 틀린 카드만 재도전 — 플래시카드 ID 로 SRS "again" 처리
  async function retryWrongWithSRS() {
    const wrongIds = answers.filter((a) => !a.correct).map((a) => a.cardId);
    await Promise.all(
      wrongIds.map((id) =>
        fetch("/api/study/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "review", cardId: id, rating: "again" }),
        }),
      ),
    );
    // 다시 셋업으로
    setPhase("setup");
  }

  // 키보드 단축키 (multi 모드)
  useEffect(() => {
    if (phase !== "playing" || !current) return;
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (current.type === "multi" && picked === null) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= (current.choices?.length ?? 0)) {
          answerMulti(n - 1);
        }
      } else if (current.type === "flip") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (!flipped) setFlipped(true);
        } else if (flipped) {
          if (e.key === "1" || e.key === "x") answerFlip(false);
          if (e.key === "2" || e.key === "o") answerFlip(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, picked, flipped]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        플래시카드 불러오는 중…
      </div>
    );
  }

  if (phase === "done") return (
    <ResultScreen
      answers={answers}
      questions={questions}
      cards={cards}
      startedAt={startedAt}
      onPlayAgain={() => setPhase("setup")}
      onRetryWrong={retryWrongWithSRS}
    />
  );

  if (phase === "playing" && current) return (
    <PlayScreen
      question={current}
      index={index}
      total={questions.length}
      flipped={flipped}
      picked={picked}
      onFlip={() => setFlipped(true)}
      onAnswerFlip={answerFlip}
      onAnswerMulti={answerMulti}
      onQuit={() => setPhase("setup")}
    />
  );

  // phase === "setup"
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="text-center">
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
          <Trophy className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">퀴즈 배틀</h1>
        <p className="mt-1 text-sm text-muted">
          플래시카드로 즉석 퀴즈 — 플립·객관식·시간 점수.
        </p>
      </header>

      {cards.length === 0 ? (
        <section className="card space-y-3 p-6 text-center">
          <div className="text-sm">아직 플래시카드가 없어요.</div>
          <Link href="/study" className="btn-primary">
            복습 큐에서 카드 만들기
          </Link>
        </section>
      ) : (
        <>
          <section className="card space-y-4 p-5">
            <div>
              <div className="label mb-2">모드</div>
              <div className="grid grid-cols-3 gap-2">
                <ModeBtn
                  active={mode === "flip"}
                  onClick={() => setMode("flip")}
                  icon={Eye}
                  label="플립"
                  desc="답 보고 자가채점"
                />
                <ModeBtn
                  active={mode === "multi"}
                  onClick={() => setMode("multi")}
                  icon={Target}
                  label="객관식"
                  desc={canMulti ? "4지선다 자동" : "카드 4+ 필요"}
                  disabled={!canMulti}
                />
                <ModeBtn
                  active={mode === "mixed"}
                  onClick={() => setMode("mixed")}
                  icon={Shuffle}
                  label="혼합"
                  desc={canMulti ? "둘 섞어서" : "카드 4+ 필요"}
                  disabled={!canMulti}
                />
              </div>
            </div>
            <div>
              <div className="label mb-2">카드 수</div>
              <div className="grid grid-cols-3 gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      count === n
                        ? "border-brand-500/60 bg-brand-500/10 text-brand-500"
                        : "border-white/10 text-muted hover:bg-white/5"
                    }`}
                  >
                    {Math.min(n, cards.length)}개
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                보유 카드 {cards.length}개 — {actualCount}개로 세션 생성
              </div>
            </div>
            <button
              onClick={start}
              disabled={cards.length === 0}
              className="btn-primary w-full justify-center py-3"
            >
              <Play className="h-4 w-4" />
              시작
            </button>
          </section>
          <div className="text-center text-[11px] text-muted">
            💡 결과 화면에서 틀린 카드만 SRS 로 다시 보내 복습 큐에 투입
          </div>
        </>
      )}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
  desc,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Target;
  label: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
        active
          ? "border-brand-500/60 bg-brand-500/10"
          : "border-white/10 hover:bg-white/5"
      }`}
    >
      <Icon className={`mb-1 h-4 w-4 ${active ? "text-brand-500" : "text-muted"}`} />
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[10px] text-muted">{desc}</div>
    </button>
  );
}

function PlayScreen({
  question,
  index,
  total,
  flipped,
  picked,
  onFlip,
  onAnswerFlip,
  onAnswerMulti,
  onQuit,
}: {
  question: Question;
  index: number;
  total: number;
  flipped: boolean;
  picked: number | null;
  onFlip: () => void;
  onAnswerFlip: (correct: boolean) => void;
  onAnswerMulti: (i: number) => void;
  onQuit: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(t);
  }, [question.cardId]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-2 text-xs">
        <button onClick={onQuit} className="btn-ghost py-1 text-xs">
          종료
        </button>
        <div className="text-muted">
          {index + 1} / {total}
        </div>
        <div className="flex items-center gap-1 font-mono text-muted">
          <Zap className="h-3 w-3 text-accent-500" />
          {(elapsed / 1000).toFixed(1)}초
        </div>
      </header>

      <div className="h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {question.type === "flip" ? (
        <>
          <div
            onClick={!flipped ? onFlip : undefined}
            className={`card min-h-[220px] p-6 ${
              !flipped ? "cursor-pointer hover:border-brand-500/40" : "border-accent-500/40"
            }`}
          >
            <div className="label text-[10px]">질문</div>
            <div className="mt-2 whitespace-pre-wrap text-lg font-semibold">
              {question.front}
            </div>
            {flipped && (
              <>
                <div className="my-4 border-t border-white/5" />
                <div className="label text-[10px]">답</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {question.back}
                </div>
              </>
            )}
            {!flipped && (
              <div className="mt-6 text-center text-[11px] text-muted">
                <Eye className="mr-1 inline h-3 w-3" />
                카드 클릭 또는 Space 로 답 보기
              </div>
            )}
          </div>
          {flipped ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAnswerFlip(false)}
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 py-3 text-sm text-rose-200 hover:bg-rose-500/20"
              >
                <XCircle className="mr-1 inline h-4 w-4" />
                틀렸음 (1)
              </button>
              <button
                onClick={() => onAnswerFlip(true)}
                className="rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm text-accent-500 hover:bg-accent-500/20"
              >
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                맞았음 (2)
              </button>
            </div>
          ) : (
            <button onClick={onFlip} className="btn-primary w-full justify-center">
              <Eye className="h-4 w-4" />
              답 보기
            </button>
          )}
        </>
      ) : (
        <>
          <div className="card min-h-[160px] p-6">
            <div className="label text-[10px]">질문</div>
            <div className="mt-2 whitespace-pre-wrap text-lg font-semibold">
              {question.front}
            </div>
          </div>
          <div className="grid gap-2">
            {question.choices?.map((c, i) => {
              const isCorrect = i === question.answerIndex;
              const isPicked = picked === i;
              const revealed = picked !== null;
              return (
                <button
                  key={i}
                  onClick={() => onAnswerMulti(i)}
                  disabled={picked !== null}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                    revealed
                      ? isCorrect
                        ? "border-accent-500/60 bg-accent-500/10"
                        : isPicked
                          ? "border-rose-500/60 bg-rose-500/10"
                          : "border-white/5 opacity-50"
                      : "border-white/10 hover:border-brand-500/40 hover:bg-white/5"
                  }`}
                >
                  <kbd className="shrink-0 rounded border border-white/10 bg-bg-elevated/60 px-1.5 py-0.5 font-mono text-[10px]">
                    {i + 1}
                  </kbd>
                  <span className="flex-1 whitespace-pre-wrap">{c}</span>
                  {revealed && isCorrect && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-500" />
                  )}
                  {revealed && isPicked && !isCorrect && (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ResultScreen({
  answers,
  questions,
  cards,
  startedAt,
  onPlayAgain,
  onRetryWrong,
}: {
  answers: Answer[];
  questions: Question[];
  cards: Flashcard[];
  startedAt: number;
  onPlayAgain: () => void;
  onRetryWrong: () => Promise<void>;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const totalSec = Math.round((Date.now() - startedAt) / 1000);
  const avgSec = total === 0 ? 0 : Math.round((totalSec / total) * 10) / 10;
  // 점수 = 정답당 100점 + 평균속도 보너스
  const speedBonus = Math.max(0, Math.round((10 - avgSec) * 10)) * correct;
  const score = correct * 100 + speedBonus;
  const wrong = answers.filter((a) => !a.correct);

  const cardById = useMemo(
    () => new Map(cards.map((c) => [c.id, c])),
    [cards],
  );
  const qById = useMemo(
    () => new Map(questions.map((q) => [q.cardId, q])),
    [questions],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="text-center">
        <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
          <Trophy className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">결과</h1>
      </header>

      <section className="card p-6 text-center">
        <div className="text-5xl font-bold">
          {score}
          <span className="ml-1 text-base font-normal text-muted">점</span>
        </div>
        <div className="mt-2 text-sm text-muted">
          {correct} / {total} 정답 · {pct}%
        </div>
        <div className="mt-1 text-[11px] text-muted">
          총 {totalSec}초 · 문제당 평균 {avgSec}초
          {speedBonus > 0 && ` · 속도 보너스 +${speedBonus}`}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-rose-500/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {wrong.length > 0 && (
        <section className="card p-5">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-200">
            <XCircle className="h-4 w-4" />
            틀린 카드 {wrong.length}개
          </div>
          <ul className="space-y-2">
            {wrong.map((a) => {
              const c = cardById.get(a.cardId);
              const q = qById.get(a.cardId);
              if (!c) return null;
              return (
                <li
                  key={a.cardId}
                  className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs"
                >
                  <div className="font-semibold">{c.front}</div>
                  <div className="mt-1 text-muted-strong">→ {c.back}</div>
                  {q?.type === "multi" && typeof a.pickedIndex === "number" && (
                    <div className="mt-0.5 text-[10px] text-rose-200">
                      당신 선택: {q.choices?.[a.pickedIndex]}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button onClick={onPlayAgain} className="btn-ghost justify-center py-2">
          <RotateCcw className="h-4 w-4" />
          다른 세션 시작
        </button>
        {wrong.length > 0 && (
          <button
            onClick={onRetryWrong}
            className="btn-primary justify-center py-2"
            title="틀린 카드를 복습 큐로 보내 다시 외우기 (SRS again)"
          >
            <Flame className="h-4 w-4" />
            틀린 카드 복습 보내기
          </button>
        )}
        <Link href="/study" className="btn-ghost justify-center py-2 sm:col-span-2">
          <ChevronRight className="h-4 w-4" />
          복습 큐로 돌아가기
        </Link>
      </div>
    </div>
  );
}
