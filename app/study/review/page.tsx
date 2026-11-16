"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  ArrowLeft,
  Eye,
  RotateCcw,
} from "lucide-react";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  ease: number;
  interval: number;
  reps: number;
}
type Rating = "again" | "hard" | "good" | "easy";

export default function ReviewSessionPage() {
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(0);

  const current = queue[index];

  const fetchQueue = useCallback(async () => {
    const r = await fetch("/api/study/cards?due=1", { cache: "no-store" });
    const data = await r.json();
    setQueue(data.cards ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  async function rate(rating: Rating) {
    if (!current) return;
    await fetch("/api/study/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        cardId: current.id,
        rating,
      }),
    });
    setReviewed((n) => n + 1);
    setFlipped(false);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      // 큐 끝 — 재조회해서 again 처리된 카드까지 소화
      setLoading(true);
      await fetchQueue();
      setIndex(0);
    }
  }

  // 키보드: Space=flip, 1/2/3/4=rating
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName && ["INPUT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (flipped) {
        if (e.key === "1") rate("again");
        else if (e.key === "2") rate("hard");
        else if (e.key === "3") rate("good");
        else if (e.key === "4") rate("easy");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, current, index, queue]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        복습 큐 불러오는 중…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-md space-y-5 pt-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-500/15 text-accent-500">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">오늘 복습 완료 🎉</h1>
        <p className="text-sm text-muted">
          {reviewed > 0 && `${reviewed}개 카드 복습 끝. `}
          다음 due 는 자료 추가·AI 생성·시간이 지나면 다시 쌓입니다.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/study" className="btn-ghost text-xs">
            <ArrowLeft className="h-3 w-3" />
            카드 목록
          </Link>
          <Link href="/dashboard" className="btn-primary text-xs">
            대시보드
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link href="/study" className="btn-ghost py-1 text-xs">
          <ArrowLeft className="h-3 w-3" />
          종료
        </Link>
        <div className="text-xs text-muted">
          {index + 1} / {queue.length} · 복습 {reviewed}개
          <span className="ml-2 inline-flex items-center gap-1 text-accent-500">
            <Flame className="h-3 w-3" />
          </span>
        </div>
      </header>

      <div
        onClick={() => !flipped && setFlipped(true)}
        className={`card min-h-[260px] cursor-pointer p-6 transition-all ${
          flipped ? "border-accent-500/40" : "hover:border-brand-500/40"
        }`}
      >
        <div className="label text-[10px]">앞면 — 질문</div>
        <div className="mt-2 whitespace-pre-wrap text-lg font-semibold">
          {current.front}
        </div>
        {flipped && (
          <>
            <div className="my-4 border-t border-white/5" />
            <div className="label text-[10px]">뒷면 — 답</div>
            <div className="mt-2 whitespace-pre-wrap text-sm">
              {current.back}
            </div>
          </>
        )}
        {!flipped && (
          <div className="mt-6 text-center text-[11px] text-muted">
            <Eye className="mr-1 inline h-3 w-3" />
            카드를 클릭하거나 <kbd className="rounded border border-white/10 px-1">Space</kbd> 로 답 보기
          </div>
        )}
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          <RateButton k="1" label="다시" tone="rose" onClick={() => rate("again")} />
          <RateButton k="2" label="어려움" tone="amber" onClick={() => rate("hard")} />
          <RateButton k="3" label="좋음" tone="brand" onClick={() => rate("good")} />
          <RateButton k="4" label="쉬움" tone="accent" onClick={() => rate("easy")} />
        </div>
      ) : (
        <button
          onClick={() => setFlipped(true)}
          className="btn-primary w-full justify-center"
        >
          <Eye className="h-4 w-4" />
          답 보기 (Space)
        </button>
      )}

      <div className="text-center text-[10px] text-muted">
        <RotateCcw className="mr-1 inline h-3 w-3" />
        간격 반복 (SM-2) — 쉬울수록 다음 간격이 길어집니다
      </div>
    </div>
  );
}

function RateButton({
  k,
  label,
  tone,
  onClick,
}: {
  k: string;
  label: string;
  tone: "rose" | "amber" | "brand" | "accent";
  onClick: () => void;
}) {
  const color =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
        : tone === "brand"
          ? "border-brand-500/40 bg-brand-500/10 text-brand-500 hover:bg-brand-500/20"
          : "border-accent-500/40 bg-accent-500/10 text-accent-500 hover:bg-accent-500/20";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-xs transition-colors ${color}`}
    >
      <kbd className="rounded bg-white/10 px-1 text-[10px]">{k}</kbd>
      {label}
    </button>
  );
}
