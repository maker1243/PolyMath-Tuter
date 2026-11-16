"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { withAiCredentials } from "@/lib/user-settings";
import { SUBJECT_GROUPS } from "@/lib/subjects";

interface DrillCard {
  front: string;
  back: string;
  hint?: string;
}

type Level = "beginner" | "intermediate" | "advanced";

export default function CustomDrillPage() {
  const [groupId, setGroupId] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [level, setLevel] = useState<Level>("intermediate");
  const [count, setCount] = useState(10);

  const [cards, setCards] = useState<DrillCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<Array<"known" | "unknown">>([]);
  const scoreReportedRef = useRef(false);

  const group = useMemo(
    () => SUBJECT_GROUPS.find((g) => g.id === groupId),
    [groupId],
  );

  const phase: "setup" | "loading" | "playing" | "done" = loading
    ? "loading"
    : cards.length === 0
      ? "setup"
      : idx < cards.length
        ? "playing"
        : "done";

  async function start() {
    if (!groupId) {
      setError("분야를 먼저 선택하세요");
      return;
    }
    if (!topic.trim()) {
      setError("세부 주제를 입력하세요 (예: '미분방정식 선형 독립성', '비즈니스 이메일 표현')");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    setCards([]);
    setIdx(0);
    setFlipped(false);
    setShowHint(false);
    setLog([]);
    scoreReportedRef.current = false;
    try {
      const res = await fetch("/api/apps/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withAiCredentials({ groupId, subject, topic, level, count }),
        ),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        cards: DrillCard[];
        fallbackReason?: string;
      };
      if (!data.cards || data.cards.length === 0) {
        throw new Error("카드가 생성되지 않았어요");
      }
      setCards(data.cards);
      if (data.fallbackReason) setNotice(data.fallbackReason);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function mark(result: "known" | "unknown") {
    setLog((prev) => [...prev, result]);
    setFlipped(false);
    setShowHint(false);
    setIdx((i) => i + 1);
  }

  function reset() {
    setCards([]);
    setIdx(0);
    setFlipped(false);
    setShowHint(false);
    setLog([]);
    setError(null);
    setNotice(null);
    scoreReportedRef.current = false;
  }

  // 활동 로그 (완료 시 1회)
  if (
    phase === "done" &&
    !scoreReportedRef.current &&
    typeof window !== "undefined"
  ) {
    scoreReportedRef.current = true;
    const known = log.filter((x) => x === "known").length;
    void fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "card_review",
        meta: {
          app: "custom_drill",
          group: group?.label ?? "",
          topic,
          total: cards.length,
          known,
        },
      }),
    }).catch(() => {});
  }

  const card = cards[idx];
  const progress = cards.length > 0 ? (idx / cards.length) * 100 : 0;
  const knownCount = log.filter((x) => x === "known").length;
  const unknownCount = log.filter((x) => x === "unknown").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/apps"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          학습 앱 목록
        </Link>
      </div>

      <header>
        <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 p-3">
          <Sparkles className="h-6 w-6 text-brand-500" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">커스텀 드릴</h1>
        <p className="mt-2 text-sm text-muted">
          분야를 고르고 <b className="text-white">세부 주제를 직접 입력</b>하면 AI 가 그에 맞춘 Q·A 플래시카드를 만들어줍니다.
          예: &ldquo;조선 전기 왕조 사건&rdquo;, &ldquo;비즈니스 영어 회의 표현&rdquo;, &ldquo;트랜스포머 self-attention 수식&rdquo;.
        </p>
      </header>

      {phase === "setup" && (
        <section className="space-y-5 rounded-2xl border border-white/5 bg-bg-elevated/40 p-5">
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-strong">
              1. 분야 선택
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SUBJECT_GROUPS.map((g) => {
                const active = groupId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGroupId(g.id);
                      setSubject("");
                    }}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-accent-500/60 bg-accent-500/10 text-white"
                        : "border-white/5 bg-bg-elevated/60 text-muted-strong hover:border-white/10 hover:bg-bg-elevated hover:text-white"
                    }`}
                  >
                    <div className="text-lg">{g.emoji}</div>
                    <div className="mt-1 text-xs font-semibold">{g.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {group && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-strong">
                2. 중분류 (선택 — 클릭하면 아래 주제에 반영)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.subjects.map((s) => {
                  const active = subject === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSubject(active ? "" : s);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-accent-500/60 bg-accent-500/10 text-white"
                          : "border-white/10 bg-bg-elevated/60 text-muted hover:bg-bg-elevated hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold text-muted-strong">
              3. 세부 주제 (자유 입력, 필수)
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                group
                  ? `예: ${group.subjects[0] ?? "관심 주제"} 중 '구체적으로 외우고 싶은 것' 을 자유롭게`
                  : "먼저 분야를 선택하세요"
              }
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-accent-500/50 focus:outline-none"
            />
            <div className="mt-1 text-[10px] text-muted">
              {topic.length}/120자 · 구체적일수록 좋은 카드가 나옵니다.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-strong">
                레벨
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full rounded-lg border border-white/10 bg-bg px-2 py-1.5 text-sm text-white focus:border-accent-500/50 focus:outline-none"
              >
                <option value="beginner">입문</option>
                <option value="intermediate">중급</option>
                <option value="advanced">심화</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-strong">
                카드 수
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-bg px-2 py-1.5 text-sm text-white focus:border-accent-500/50 focus:outline-none"
              >
                <option value={5}>5장</option>
                <option value={10}>10장</option>
                <option value={15}>15장</option>
                <option value={20}>20장</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={start}
            disabled={!groupId || !topic.trim()}
            className="w-full rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            AI 로 카드 {count}장 생성
          </button>
        </section>
      )}

      {phase === "loading" && (
        <section className="flex items-center justify-center rounded-2xl border border-white/5 bg-bg-elevated/40 py-20">
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
            <div className="text-sm">
              AI 가 &ldquo;{topic}&rdquo; 관련 카드를 만들고 있어요…
            </div>
          </div>
        </section>
      )}

      {phase === "playing" && card && (
        <section className="space-y-4">
          {notice && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              {notice}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {idx + 1} / {cards.length} · {group?.label} ·{" "}
              <b className="text-white">{topic}</b>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-emerald-400">알아요 {knownCount}</span>
              <span className="text-rose-400">몰라요 {unknownCount}</span>
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-bg-elevated/60 p-6 text-center transition hover:border-accent-500/40"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {flipped ? "답" : "질문"}
            </div>
            <div className="whitespace-pre-wrap text-base text-white sm:text-lg">
              {flipped ? card.back : card.front}
            </div>
            {!flipped && card.hint && (
              <div className="mt-2">
                {showHint ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200">
                    💡 {card.hint}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(true);
                    }}
                    className="text-[11px] text-muted hover:text-white"
                  >
                    힌트 보기
                  </button>
                )}
              </div>
            )}
            <div className="mt-2 text-[10px] text-muted">
              카드 클릭 → 뒤집기
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => mark("unknown")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10"
            >
              <X className="h-4 w-4" />
              몰라요
            </button>
            <button
              type="button"
              onClick={() => mark("known")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
            >
              <Check className="h-4 w-4" />
              알아요
            </button>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="space-y-5 rounded-2xl border border-white/5 bg-bg-elevated/40 p-6 text-center">
          <div className="mx-auto inline-flex rounded-full bg-gradient-to-br from-amber-400/20 to-amber-500/10 p-4">
            <Trophy className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">완료!</h2>
            <p className="mt-1 text-sm text-muted">
              {group?.label} · {topic}
            </p>
          </div>
          <div className="mx-auto flex max-w-xs items-center justify-around rounded-xl border border-white/5 bg-bg-elevated/60 py-3">
            <div className="text-center">
              <div className="text-xs text-muted">알아요</div>
              <div className="text-xl font-bold text-emerald-400">
                {knownCount}
              </div>
            </div>
            <div className="h-10 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-xs text-muted">몰라요</div>
              <div className="text-xl font-bold text-rose-400">
                {unknownCount}
              </div>
            </div>
            <div className="h-10 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-xs text-muted">정답률</div>
              <div className="text-xl font-bold text-white">
                {cards.length
                  ? Math.round((knownCount / cards.length) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIdx(0);
                setFlipped(false);
                setShowHint(false);
                setLog([]);
                scoreReportedRef.current = false;
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2 text-sm text-muted-strong hover:bg-white/5 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              같은 세트 다시
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              새 주제로
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
