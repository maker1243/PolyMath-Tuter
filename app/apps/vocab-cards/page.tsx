"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { withAiCredentials } from "@/lib/user-settings";
import { TTS_LANGUAGES, cancelSpeech, isTtsAvailable, speak } from "@/lib/tts";

interface VocabCard {
  word: string;
  ipa?: string;
  meaning: string;
  example: string;
  exampleTr: string;
}

type Level = "beginner" | "intermediate" | "advanced";
type Lang = "en" | "es" | "ja" | "zh" | "fr" | "de";

const LANG_TTS: Record<Lang, string> = {
  en: "en-US",
  es: "es-ES",
  ja: "ja-JP",
  zh: "zh-CN",
  fr: "fr-FR",
  de: "de-DE",
};

const TOPICS: Array<{ id: string; label: string }> = [
  { id: "daily", label: "일상 대화" },
  { id: "business", label: "비즈니스" },
  { id: "travel", label: "여행" },
  { id: "academic", label: "학술" },
  { id: "tech", label: "IT·기술" },
  { id: "food", label: "음식·요리" },
];

export default function VocabCardsPage() {
  const [level, setLevel] = useState<Level>("intermediate");
  const [lang, setLang] = useState<Lang>("en");
  const [topic, setTopic] = useState("daily");
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<Array<"known" | "unknown">>([]);
  const ttsAvailable = isTtsAvailable();
  const scoreReportedRef = useRef(false);

  const phase: "setup" | "loading" | "playing" | "done" =
    loading
      ? "loading"
      : cards.length === 0
        ? "setup"
        : idx < cards.length
          ? "playing"
          : "done";

  async function start() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setCards([]);
    setIdx(0);
    setFlipped(false);
    setLog([]);
    scoreReportedRef.current = false;
    try {
      const res = await fetch("/api/apps/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withAiCredentials({ level, lang, topic, count })),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        cards: VocabCard[];
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

  function playWord() {
    if (phase !== "playing" || !ttsAvailable) return;
    const card = cards[idx];
    speak(card.word, { lang: LANG_TTS[lang], rate: 0.85 });
  }

  function next(result?: "known" | "unknown") {
    if (phase !== "playing") return;
    if (result) setLog((prev) => [...prev, result]);
    cancelSpeech();
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  function reset() {
    cancelSpeech();
    setCards([]);
    setIdx(0);
    setFlipped(false);
    setLog([]);
    setError(null);
    setNotice(null);
    scoreReportedRef.current = false;
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

  // 완료 시 활동 로그
  useEffect(() => {
    if (phase !== "done" || scoreReportedRef.current) return;
    scoreReportedRef.current = true;
    fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "vocab_drill",
        meta: {
          lang,
          level,
          topic,
          count: cards.length,
          known: stats.known,
          unknown: stats.unknown,
          accuracy: stats.accuracy,
        },
      }),
    }).catch(() => {
      /* non-critical */
    });
  }, [phase, stats, cards.length, lang, level, topic]);

  const current = cards[idx];

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
              {idx + 1} / {cards.length}
            </span>
            <span className="text-accent-500">알아요 {stats.known}</span>
            <span className="text-rose-300">몰라요 {stats.unknown}</span>
          </div>
        )}
      </div>

      <header>
        <div className="mb-2 text-3xl">🗂️</div>
        <h1 className="text-2xl font-bold">영어 단어 카드</h1>
        <p className="mt-1 text-xs text-muted">
          언어·레벨·주제를 고르면 AI 가 10장을 만들어요. 카드를 클릭해 뒤집고, 발음도
          들어 보세요.
        </p>
      </header>

      {phase === "setup" && (
        <div className="card space-y-5 p-6">
          <div>
            <div className="label">언어</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LANG_TTS) as Lang[]).map((l) => {
                const info = TTS_LANGUAGES.find((x) => x.code === LANG_TTS[l]);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      lang === l
                        ? "border-brand-500/60 bg-brand-500/15 text-white"
                        : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                    }`}
                  >
                    {info ? `${info.flag} ${info.label}` : l}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label">레벨</div>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
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
                  {{ beginner: "초급", intermediate: "중급", advanced: "고급" }[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">주제</div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  aria-pressed={topic === t.id}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    topic === t.id
                      ? "border-brand-500/60 bg-brand-500/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">카드 수</div>
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

          <button
            type="button"
            onClick={start}
            className="btn-primary w-full py-3 text-base"
          >
            카드 만들기
          </button>
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>
      )}

      {phase === "loading" && (
        <div className="card p-10 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-accent-500" />
          <p className="text-sm text-muted">AI 가 카드를 만들고 있어요…</p>
        </div>
      )}

      {phase === "playing" && current && (
        <div className="space-y-4">
          {notice && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200">
              {notice}
            </div>
          )}
          {/* 진행률 바 */}
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(idx / cards.length) * 100}%` }}
            />
          </div>

          {/* 카드 */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="card flex min-h-[260px] w-full flex-col items-center justify-center gap-3 p-8 transition hover:border-accent-500/40"
          >
            {!flipped ? (
              <>
                <div
                  className="text-center text-4xl font-semibold text-white"
                  lang={lang}
                  dir="auto"
                >
                  {current.word}
                </div>
                {current.ipa && (
                  <div className="font-serif text-lg text-muted-strong">
                    {current.ipa}
                  </div>
                )}
                <div className="mt-4 text-[10px] text-muted">카드 클릭 → 뜻 보기</div>
              </>
            ) : (
              <>
                <div className="text-center text-2xl font-semibold text-white">
                  {current.meaning}
                </div>
                {current.example && (
                  <div className="mt-3 space-y-1 text-center">
                    <div className="text-sm text-muted-strong" lang={lang} dir="auto">
                      “{current.example}”
                    </div>
                    <div className="text-xs text-muted">{current.exampleTr}</div>
                  </div>
                )}
                <div className="mt-2 text-[10px] text-muted">카드 클릭 → 단어 보기</div>
              </>
            )}
          </button>

          {/* 컨트롤 */}
          <div className="flex gap-2">
            {ttsAvailable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playWord();
                }}
                className="btn-ghost flex-1"
                title="원어민 발음"
              >
                <Volume2 className="h-4 w-4" />
                발음 듣기
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => next("unknown")}
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 py-3 text-sm text-rose-200 hover:bg-rose-500/20"
            >
              <X className="mr-1 inline h-4 w-4" />
              몰라요 (복습)
            </button>
            <button
              type="button"
              onClick={() => next("known")}
              className="rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm text-accent-500 hover:bg-accent-500/20"
            >
              <Check className="mr-1 inline h-4 w-4" />
              알아요 (다음)
            </button>
          </div>
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
              <h3 className="text-sm font-semibold">
                몰랐던 단어 ({stats.unknown}개)
              </h3>
              <ul className="space-y-1.5">
                {cards
                  .filter((_, i) => log[i] === "unknown")
                  .map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between rounded border border-white/5 bg-bg-elevated/40 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-white" lang={lang}>
                          {c.word}
                        </span>
                        {c.ipa && (
                          <span className="ml-1 font-serif text-muted">{c.ipa}</span>
                        )}
                        <span className="ml-2 text-muted-strong">— {c.meaning}</span>
                      </div>
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
