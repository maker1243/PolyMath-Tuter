"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Sparkles,
  Trash2,
  Loader2,
  Flame,
  Clock,
  Layers,
  Lightbulb,
  FileText,
  Share2,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { withAiCredentials } from "@/lib/user-settings";
import {
  deleteSession as deleteSessionStore,
  listSessions,
  loadMessages,
  searchSessions,
  type SessionSearchHit,
  type SessionSummary,
} from "@/lib/session-store";
import { Search, Youtube } from "lucide-react";

interface Source {
  id: string;
  title: string;
  content: string;
  kind: string;
  createdAt: number;
  isPublic?: boolean;
  publicSlug?: string;
  copyCount?: number;
}
interface Flashcard {
  id: string;
  sourceId?: string;
  front: string;
  back: string;
  interval: number;
  reps: number;
  dueAt: number;
}
interface Stats {
  totalCards: number;
  dueToday: number;
  dueNow: number;
  learning: number;
  mature: number;
  totalSources: number;
}

export default function StudyPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SessionSearchHit[]>([]);
  // 동영상 (YouTube) 자료 폼
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytLang, setYtLang] = useState<"" | "ko" | "en" | "ja" | "zh">("");
  const [ytImporting, setYtImporting] = useState(false);
  const [ytResult, setYtResult] = useState<string | null>(null);

  // 새 자료 폼
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newKind, setNewKind] = useState<"note" | "pdf" | "url" | "code">("note");
  const [adding, setAdding] = useState(false);
  // 수동 카드 폼
  const [manualFront, setManualFront] = useState("");
  const [manualBack, setManualBack] = useState("");

  async function refresh() {
    const [s, c] = await Promise.all([
      fetch("/api/study/sources", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/study/cards", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setSources(s.sources ?? []);
    setCards(c.cards ?? []);
    setStats(c.stats ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  // 검색 쿼리 변화 → 300ms debounce 로 모든 세션 메시지 검색
  useEffect(() => {
    const q = searchQ.trim();
    if (!q) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchHits(searchSessions(q));
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchQ]);

  function removeSession(id: string) {
    if (!confirm("이 세션을 영구 삭제할까요? 복습 기록도 함께 사라집니다.")) return;
    deleteSessionStore(id);
    setSessions(listSessions());
  }

  async function importYoutube() {
    if (ytImporting || !ytUrl.trim()) return;
    setYtImporting(true);
    setYtResult(null);
    try {
      const res = await fetch("/api/study/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: ytUrl.trim(),
          title: ytTitle.trim() || undefined,
          lang: ytLang || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setYtResult(`⚠ ${err?.error ?? `HTTP ${res.status}`}`);
        return;
      }
      const data = (await res.json()) as {
        videoId: string;
        lang?: string;
        lineCount: number;
      };
      setYtResult(
        `✓ "${data.videoId}" 자막 ${data.lineCount}줄 가져옴 (${data.lang ?? "auto"}). 아래 "내 자료" 에서 플래시카드로 변환하세요.`,
      );
      setYtUrl("");
      setYtTitle("");
      await refresh();
    } catch (err) {
      setYtResult(
        `⚠ 가져오기 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setYtImporting(false);
    }
  }

  async function convertSessionToCards(
    session: SessionSummary,
    count = 6,
  ): Promise<{ ok: boolean; created: number; error?: string }> {
    const data = loadMessages(session.id);
    if (!data || data.messages.length < 2) {
      return { ok: false, created: 0, error: "메시지가 너무 적어요" };
    }
    const title =
      session.firstUserMessage?.slice(0, 60) ||
      session.goal ||
      session.subjects.join(", ") ||
      `세션 ${session.id.slice(0, 8)}`;
    const res = await fetch("/api/study/from-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withAiCredentials({
          title,
          messages: data.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          count,
        }),
      ),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, created: 0, error: err?.error ?? `HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      created: number;
      fallbackReason?: string;
    };
    await refresh();
    return {
      ok: true,
      created: json.created,
      error: json.fallbackReason ? `일부 폴백: ${json.fallbackReason}` : undefined,
    };
  }

  async function addSource() {
    if (!newTitle.trim() || !newContent.trim() || adding) return;
    setAdding(true);
    try {
      await fetch("/api/study/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          kind: newKind,
        }),
      });
      setNewTitle("");
      setNewContent("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function togglePublish(src: Source) {
    const action = src.isPublic ? "unpublish" : "publish";
    await fetch("/api/study/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sourceId: src.id }),
    });
    await refresh();
  }

  async function deleteSource(id: string) {
    if (!confirm("자료를 삭제할까요? 생성된 카드는 유지됩니다.")) return;
    await fetch(`/api/study/sources?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await refresh();
  }

  async function generateCards(sourceId: string) {
    setGenerating(sourceId);
    try {
      await fetch("/api/study/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withAiCredentials({ sourceId, count: 8 })),
      });
      await refresh();
    } finally {
      setGenerating(null);
    }
  }

  async function addManualCard() {
    if (!manualFront.trim() || !manualBack.trim()) return;
    await fetch("/api/study/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        front: manualFront,
        back: manualBack,
      }),
    });
    setManualFront("");
    setManualBack("");
    await refresh();
  }

  async function deleteCard(id: string) {
    if (!confirm("카드를 삭제할까요?")) return;
    await fetch(`/api/study/cards?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await refresh();
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        복습 큐 불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">학습 자료 & 복습 큐</h1>
          <p className="text-sm text-muted">
            자료를 올리면 AI 가 플래시카드를 자동 생성 — 간격 반복 (SRS) 로 장기
            기억으로 옮깁니다.
          </p>
        </div>
        {stats && stats.dueNow > 0 && (
          <Link href="/study/review" className="btn-primary">
            <Flame className="h-4 w-4" />
            지금 복습 ({stats.dueNow})
          </Link>
        )}
      </header>

      {stats && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi icon={Clock} label="지금 due" value={`${stats.dueNow}개`} tone="accent" />
          <Kpi icon={Clock} label="오늘 due" value={`${stats.dueToday}개`} tone="brand" />
          <Kpi icon={Layers} label="전체 카드" value={`${stats.totalCards}개`} tone="brand" />
          <Kpi icon={Lightbulb} label="학습 중" value={`${stats.learning}개`} tone="accent" />
          <Kpi icon={FileText} label="자료" value={`${stats.totalSources}개`} tone="brand" />
        </section>
      )}

      <SessionReviewSection
        sessions={sessions}
        expanded={showAllSessions}
        onToggleExpanded={() => setShowAllSessions((v) => !v)}
        onDelete={removeSession}
        onConvert={convertSessionToCards}
        searchQ={searchQ}
        onSearchChange={setSearchQ}
        searchHits={searchHits}
      />

      <section className="card space-y-3 p-5">
        <div className="label flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-brand-500" />새 학습 자료
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_120px]">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="자료 제목 (예: 트랜스포머 어텐션 노트)"
            className="input"
          />
          <select
            value={newKind}
            onChange={(e) =>
              setNewKind(
                e.target.value as "note" | "pdf" | "url" | "code",
              )
            }
            className="input"
          >
            <option value="note">노트</option>
            <option value="pdf">PDF 발췌</option>
            <option value="url">URL/자막</option>
            <option value="code">코드</option>
          </select>
        </div>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="자료 본문을 붙여넣으세요 (최대 100KB). 한국어 OK."
          rows={5}
          className="input resize-y font-mono text-xs"
        />
        <div className="flex justify-end">
          <button
            onClick={addSource}
            disabled={adding || !newTitle.trim() || !newContent.trim()}
            className="btn-primary py-1 text-xs"
          >
            {adding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            자료 추가
          </button>
        </div>
      </section>

      {/* 📹 YouTube 영상 → 자막 자동 추출 */}
      <section className="card space-y-3 p-5">
        <div className="label flex items-center gap-1.5">
          <Youtube className="h-3.5 w-3.5 text-rose-400" />
          동영상 (YouTube) — 자막 자동 추출
        </div>
        <p className="text-[11px] text-muted">
          공개 자막이 있는 영상이면 OK (강의·튜토리얼·TED·세미나 등). 자막 텍스트를
          자료로 저장해, 평소처럼 AI 플래시카드로 변환할 수 있어요.
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_100px]">
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… 또는 youtu.be/… 또는 영상 ID 11자"
            className="input text-xs"
          />
          <input
            value={ytTitle}
            onChange={(e) => setYtTitle(e.target.value)}
            placeholder="자료 제목 (선택 — 비우면 영상 ID)"
            className="input text-xs"
          />
          <select
            value={ytLang}
            onChange={(e) =>
              setYtLang(e.target.value as "" | "ko" | "en" | "ja" | "zh")
            }
            className="input text-xs"
            title="자막 언어 (지정 안 하면 ko → en → auto 순 시도)"
          >
            <option value="">자동</option>
            <option value="ko">한국어</option>
            <option value="en">영어</option>
            <option value="ja">일본어</option>
            <option value="zh">중국어</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          {ytResult ? (
            <span
              className={`text-[11px] ${
                ytResult.startsWith("✓") ? "text-accent-500" : "text-amber-300"
              }`}
            >
              {ytResult}
            </span>
          ) : (
            <span className="text-[10px] text-muted">
              {" "}
            </span>
          )}
          <button
            onClick={importYoutube}
            disabled={ytImporting || !ytUrl.trim()}
            className="btn-primary py-1 text-xs"
          >
            {ytImporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Youtube className="h-3 w-3" />
            )}
            {ytImporting ? "자막 가져오는 중…" : "자막 가져오기"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-strong">
          <BookOpen className="h-3.5 w-3.5 text-brand-500" />
          내 자료 ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <div className="card p-6 text-center text-xs text-muted">
            아직 자료가 없어요. 위에 노트·발췌·URL 요약을 올려보세요.
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => {
              const cardCount = cards.filter((c) => c.sourceId === s.id).length;
              const busy = generating === s.id;
              return (
                <SourceCard
                  key={s.id}
                  src={s}
                  cardCount={cardCount}
                  busy={busy}
                  onGenerate={() => generateCards(s.id)}
                  onDelete={() => deleteSource(s.id)}
                  onTogglePublish={() => togglePublish(s)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-strong">
          <Layers className="h-3.5 w-3.5 text-accent-500" />내 카드 (
          {cards.length})
        </h2>

        <div className="card mb-3 space-y-2 p-3">
          <div className="label flex items-center gap-1 text-[10px]">
            수동으로 카드 하나 추가
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={manualFront}
              onChange={(e) => setManualFront(e.target.value)}
              placeholder="앞면 (질문)"
              className="input text-xs"
            />
            <input
              value={manualBack}
              onChange={(e) => setManualBack(e.target.value)}
              placeholder="뒷면 (답)"
              className="input text-xs"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={addManualCard}
              disabled={!manualFront.trim() || !manualBack.trim()}
              className="btn-ghost py-0.5 text-[11px]"
            >
              <Plus className="h-3 w-3" />
              추가
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="card p-6 text-center text-xs text-muted">
            카드가 없어요. 자료에서 AI 로 생성하거나 위에서 수동으로 추가하세요.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cards.slice(0, 30).map((c) => {
              const due = c.dueAt <= Date.now();
              return (
                <div
                  key={c.id}
                  className={`card p-3 ${due ? "border-accent-500/40" : ""}`}
                >
                  <div className="line-clamp-2 text-sm font-semibold">
                    {c.front}
                  </div>
                  <div className="mt-1 line-clamp-3 text-xs text-muted">
                    {c.back}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
                    <span>
                      {due ? "⏰ 지금 due" : `${timeTo(c.dueAt)} 후`} · reps{" "}
                      {c.reps}
                    </span>
                    <button
                      onClick={() => deleteCard(c.id)}
                      className="rounded p-0.5 text-rose-300 opacity-0 hover:bg-rose-500/10 group-hover:opacity-100"
                      title="카드 삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {cards.length > 30 && (
              <div className="col-span-full text-center text-[11px] text-muted">
                … 외 {cards.length - 30}개
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceCard({
  src,
  cardCount,
  busy,
  onGenerate,
  onDelete,
  onTogglePublish,
}: {
  src: Source;
  cardCount: number;
  busy: boolean;
  onGenerate: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const shareUrl =
    src.isPublic && src.publicSlug && typeof window !== "undefined"
      ? `${window.location.origin}/study/deck/${src.publicSlug}`
      : null;
  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{src.title}</div>
            {src.isPublic && (
              <span className="chip py-0 text-[10px] text-accent-500">
                <Share2 className="h-2.5 w-2.5" />
                공개
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">
            {src.kind} · {cardCount}개 카드 · {src.content.length}자 ·{" "}
            {new Date(src.createdAt).toLocaleDateString()}
            {src.copyCount && src.copyCount > 0
              ? ` · ${src.copyCount}명이 복사`
              : ""}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-muted">
            {src.content.slice(0, 300)}
          </div>
          {src.isPublic && shareUrl && (
            <div className="mt-1.5 flex items-center gap-1 rounded border border-accent-500/20 bg-accent-500/5 px-2 py-1 text-[10px]">
              <span className="truncate font-mono text-accent-500">
                {shareUrl}
              </span>
              <button
                onClick={copyLink}
                className="shrink-0 rounded p-0.5 text-accent-500 hover:bg-accent-500/10"
                title="공유 링크 복사"
              >
                {linkCopied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={onGenerate}
            disabled={busy}
            className="btn-primary py-0.5 text-[11px]"
            title="AI 로 플래시카드 자동 생성"
          >
            {busy ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                생성 중
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                AI 카드
              </>
            )}
          </button>
          <button
            onClick={onTogglePublish}
            disabled={cardCount === 0}
            className={`rounded border px-1.5 py-0.5 text-[11px] ${
              src.isPublic
                ? "border-accent-500/40 bg-accent-500/10 text-accent-500 hover:bg-accent-500/20"
                : "border-white/10 text-muted hover:bg-white/5"
            } disabled:opacity-40`}
            title={
              cardCount === 0
                ? "먼저 카드를 생성하세요"
                : src.isPublic
                  ? "공유 해제"
                  : "공개 덱으로 공유"
            }
          >
            {src.isPublic ? (
              <>
                <Lock className="inline h-3 w-3" />
                비공개
              </>
            ) : (
              <>
                <Share2 className="inline h-3 w-3" />
                공유
              </>
            )}
          </button>
          <button
            onClick={onDelete}
            className="rounded border border-rose-500/20 bg-rose-500/5 px-1.5 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="inline h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function timeTo(ts: number): string {
  const d = ts - Date.now();
  if (d < 60_000) return "곧";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}분`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}시간`;
  return `${Math.floor(d / 86_400_000)}일`;
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone: "brand" | "accent";
}) {
  return (
    <div className="card p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] text-muted">{label}</div>
        <div
          className={`rounded p-1 ${
            tone === "brand"
              ? "bg-brand-500/15 text-brand-500"
              : "bg-accent-500/15 text-accent-500"
          }`}
        >
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function SessionReviewSection({
  sessions,
  expanded,
  onToggleExpanded,
  onDelete,
  onConvert,
  searchQ,
  onSearchChange,
  searchHits,
}: {
  sessions: SessionSummary[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onDelete: (id: string) => void;
  onConvert: (
    s: SessionSummary,
    count?: number,
  ) => Promise<{ ok: boolean; created: number; error?: string }>;
  searchQ: string;
  onSearchChange: (q: string) => void;
  searchHits: SessionSearchHit[];
}) {
  const DEFAULT_SHOW = 4;
  const shown = expanded ? sessions : sessions.slice(0, DEFAULT_SHOW);
  const isSearching = searchQ.trim().length > 0;

  if (sessions.length === 0) {
    return (
      <section className="card space-y-2 p-5">
        <div className="label flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-brand-500" />지난 학습 세션
        </div>
        <p className="text-xs text-muted">
          아직 저장된 세션이 없어요. <Link href="/tutor" className="text-accent-500 hover:underline">AI 튜터</Link> 에서 질문·대화를 시작하면 자동으로 저장되고, 여기서 아무 때나 이어 가거나 복습할 수 있어요.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="label flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-brand-500" />
          지난 학습 세션 ({sessions.length})
        </div>
        {sessions.length > DEFAULT_SHOW && !isSearching && (
          <button
            onClick={onToggleExpanded}
            className="text-[11px] text-accent-500 hover:underline"
          >
            {expanded ? "접기" : `전체 보기 (${sessions.length})`}
          </button>
        )}
      </div>

      {/* 검색바 — 모든 과거 세션의 질문·답변을 가로지름 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={searchQ}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="과거 질문·답변 검색 (예: 미분, 학이시습지, GDP…)"
          className="input w-full pl-7 text-xs"
        />
        {searchQ && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-white"
            title="검색 지우기"
          >
            ✕
          </button>
        )}
      </div>

      {isSearching ? (
        searchHits.length === 0 ? (
          <div className="rounded border border-white/5 bg-bg-elevated/30 p-4 text-center text-xs text-muted">
            &quot;{searchQ}&quot; 와 일치하는 질문·답변이 없어요.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-muted">
              {searchHits.length}개 세션에서 매치 발견 — 스니펫 클릭 시 대화로
              이동
            </div>
            {searchHits.map((h) => (
              <SessionSearchResult key={h.summary.id} hit={h} query={searchQ} />
            ))}
          </div>
        )
      ) : (
        <>
          <p className="text-[11px] text-muted">
            세션 제목을 클릭하면 <strong>대화가 이어집니다</strong>. &quot;📝 복습 카드로&quot; 를
            누르면 그 세션의 핵심 Q&amp;A 가 <strong>자동 플래시카드로 변환</strong>되어 아래 SRS
            큐에 들어갑니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((s) => (
              <SessionReviewCard
                key={s.id}
                s={s}
                onDelete={onDelete}
                onConvert={onConvert}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** 검색 결과 1건: 세션 메타 + 매치된 스니펫 (하이라이트) */
function SessionSearchResult({
  hit,
  query,
}: {
  hit: SessionSearchHit;
  query: string;
}) {
  const s = hit.summary;
  const q = query.trim();
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
    <div className="rounded-lg border border-white/5 bg-bg-elevated/40 p-3 transition hover:border-accent-500/40 hover:bg-bg-elevated/60">
      <Link href={href} className="block">
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
        <div className="mt-2 space-y-1.5">
          {hit.matches.map((m, i) => (
            <div
              key={m.messageId + i}
              className="rounded border border-white/5 bg-bg-elevated/30 px-2 py-1.5 text-[11px]"
            >
              <div className="mb-0.5 text-[9px] text-muted">
                {m.role === "user" ? "🙋 학습자" : "🤖 튜터"} ·{" "}
                {formatRelativeTime(new Date(m.createdAt))}
              </div>
              <div className="whitespace-pre-wrap text-muted-strong">
                {highlightQuery(m.excerpt, q)}
              </div>
            </div>
          ))}
        </div>
      </Link>
    </div>
  );
}

/** 쿼리와 일치하는 부분을 <mark> 로 감싸 하이라이트 */
function highlightQuery(text: string, query: string): React.ReactNode[] {
  const q = query.toLowerCase();
  if (!q) return [text];
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const lower = text.toLowerCase();
  let key = 0;
  while (i < text.length) {
    const pos = lower.indexOf(q, i);
    if (pos < 0) {
      nodes.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    }
    if (pos > i) nodes.push(<span key={key++}>{text.slice(i, pos)}</span>);
    nodes.push(
      <mark
        key={key++}
        className="rounded bg-accent-500/30 px-0.5 text-white"
      >
        {text.slice(pos, pos + q.length)}
      </mark>,
    );
    i = pos + q.length;
  }
  return nodes;
}

function SessionReviewCard({
  s,
  onDelete,
  onConvert,
}: {
  s: SessionSummary;
  onDelete: (id: string) => void;
  onConvert: (
    s: SessionSummary,
    count?: number,
  ) => Promise<{ ok: boolean; created: number; error?: string }>;
}) {
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<string | null>(null);
  const d = new Date(s.updatedAt);
  const label =
    s.firstUserMessage?.slice(0, 50) ||
    s.goal ||
    s.subjects.join(", ") ||
    `세션 ${s.id.slice(0, 8)}`;
  const subjectBadge = s.subjects[0];
  const query = new URLSearchParams();
  query.set("level", s.level);
  if (s.goal) query.set("goal", s.goal);
  const href = `/tutor/${encodeURIComponent(s.id)}?${query.toString()}`;

  async function handleConvert(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (converting) return;
    setConverting(true);
    setConvertResult(null);
    try {
      const r = await onConvert(s, 6);
      if (r.ok) {
        setConvertResult(`✓ ${r.created}장 생성`);
      } else {
        setConvertResult(`⚠ ${r.error ?? "실패"}`);
      }
      setTimeout(() => setConvertResult(null), 4000);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="group relative rounded-lg border border-white/5 bg-bg-elevated/40 p-3 transition hover:border-accent-500/40 hover:bg-bg-elevated/60">
      <Link href={href} className="block space-y-1.5">
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
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
        <button
          onClick={handleConvert}
          disabled={converting || s.messageCount < 2}
          className="inline-flex items-center gap-1 rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-[10px] text-accent-500 hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            s.messageCount < 2
              ? "대화가 거의 없어서 변환할 내용이 부족해요"
              : "이 세션의 핵심 Q&A 를 플래시카드로 자동 변환"
          }
        >
          {converting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {converting ? "생성 중…" : "📝 복습 카드로"}
        </button>
        {convertResult && (
          <span
            className={`text-[10px] ${
              convertResult.startsWith("✓")
                ? "text-accent-500"
                : "text-amber-300"
            }`}
          >
            {convertResult}
          </span>
        )}
      </div>
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
