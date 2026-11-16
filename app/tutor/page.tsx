"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  deleteSession as deleteSessionStore,
  listSessions,
  type SessionSummary,
} from "@/lib/session-store";

export default function TutorIndex() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  function remove(id: string) {
    if (!confirm("이 세션을 영구 삭제할까요? 복습 기록도 함께 사라집니다."))
      return;
    deleteSessionStore(id);
    setSessions(listSessions());
  }

  // SSR 중엔 localStorage 접근 불가 → sessions null → 안전한 폴백 UI
  if (sessions === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-16 text-center">
        <div className="h-6 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  const DEFAULT = 6;
  const shown = showAll ? sessions : sessions.slice(0, DEFAULT);
  const mostRecent = sessions[0];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-10">
      {/* Hero: 신규 세션 CTA + 가장 최근 세션 이어가기 */}
      <section className="rounded-3xl border border-white/5 bg-bg-surface/60 p-8 sm:p-10">
        <div className="mb-6 inline-flex rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 p-3">
          <Sparkles className="h-6 w-6 text-brand-500" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">AI 튜터</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          단방향 설명 대신 질문·힌트·반례로 함께 풀어가는 학습. 지난 세션은
          자동으로 저장돼, 아무 때나 이어서 공부할 수 있어요.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/learn" className="btn-primary">
            <Plus className="h-4 w-4" />새 세션 시작
          </Link>
          {mostRecent && (
            <ResumeButton session={mostRecent} />
          )}
        </div>
      </section>

      {/* 지난 세션 이어가기 */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-4 w-4 text-brand-500" />
              지난 세션에서 이어가기
            </h2>
            <p className="mt-1 text-xs text-muted">
              모든 대화가 자동 저장됩니다. 세션을 열면{" "}
              <strong>그 자리에서 대화가 복원</strong>되고,
              저장된 다이어그램·그래프·음성·한문도 그대로 다시 볼 수 있어요.
            </p>
          </div>
          {sessions.length > DEFAULT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-accent-500 hover:underline"
            >
              {showAll ? "접기" : `전체 ${sessions.length}개 보기`}
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-bg-elevated/30 p-8 text-center">
            <p className="text-sm text-muted">
              아직 저장된 세션이 없어요.
            </p>
            <p className="mt-1 text-xs text-muted">
              <Link href="/learn" className="text-accent-500 hover:underline">
                새 세션
              </Link>{" "}
              을 시작하면 자동으로 이 자리에 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((s) => (
              <SessionCard key={s.id} s={s} onDelete={remove} />
            ))}
          </div>
        )}

        {sessions.length > 0 && (
          <div className="pt-2 text-center">
            <Link
              href="/study"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent-500"
            >
              복습 큐에서 검색·플래시카드 변환
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function ResumeButton({ session }: { session: SessionSummary }) {
  const qp = new URLSearchParams();
  qp.set("level", session.level);
  if (session.goal) qp.set("goal", session.goal);
  const href = `/tutor/${encodeURIComponent(session.id)}?${qp.toString()}`;
  const label =
    session.firstUserMessage?.slice(0, 30) ||
    session.goal ||
    session.subjects.join(", ") ||
    "최근 세션";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-accent-500/40 bg-accent-500/10 px-4 py-2 text-sm text-accent-500 hover:bg-accent-500/20"
    >
      <Clock className="h-4 w-4" />
      이어서 — &ldquo;{label}{session.firstUserMessage && session.firstUserMessage.length > 30 ? "…" : ""}&rdquo;
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SessionCard({
  s,
  onDelete,
}: {
  s: SessionSummary;
  onDelete: (id: string) => void;
}) {
  const d = new Date(s.updatedAt);
  const label =
    s.firstUserMessage?.slice(0, 60) ||
    s.goal ||
    s.subjects.join(", ") ||
    `세션 ${s.id.slice(0, 8)}`;
  const subjectBadge = s.subjects[0];
  const qp = new URLSearchParams();
  qp.set("level", s.level);
  if (s.goal) qp.set("goal", s.goal);
  const href = `/tutor/${encodeURIComponent(s.id)}?${qp.toString()}`;
  return (
    <div className="group relative rounded-xl border border-white/5 bg-bg-elevated/40 p-4 transition hover:border-accent-500/40 hover:bg-bg-elevated/60">
      <Link href={href} className="block space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 truncate text-sm font-medium text-white">
            {label}
          </div>
          {subjectBadge && (
            <span className="shrink-0 rounded-full border border-white/10 bg-bg-elevated px-2 py-0.5 text-[9px] text-muted">
              {subjectBadge}
            </span>
          )}
        </div>
        {s.lastAssistantMessage && (
          <div className="line-clamp-2 text-[11px] text-muted">
            {s.lastAssistantMessage}
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(d)}
          </span>
          <span>메시지 {s.messageCount}</span>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(s.id);
        }}
        className="absolute right-2 top-2 hidden rounded-full bg-bg-elevated/80 p-1 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 group-hover:block"
        title="세션 삭제"
        aria-label="세션 삭제"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatRelativeTime(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60_000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 30) return `${day}일 전`;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
