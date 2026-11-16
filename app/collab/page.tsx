"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Hash,
  Zap,
  Radio,
  Sparkles,
  Loader2,
  Crown,
  Wallet,
  Star,
  Package,
  X,
} from "lucide-react";
import { withAiCredentials } from "@/lib/user-settings";
import { ROOM_TEMPLATES, type RoomTemplate } from "@/lib/room-templates";
import { useFavorites } from "@/lib/use-favorites";

interface LiveRoom {
  id: string;
  name: string | null;
  mission: {
    title: string;
    subject: string;
    difficulty: string;
    language: string;
  } | null;
  participants: number;
  messages: number;
  hasHost: boolean;
  hostWalletEnabled: boolean;
  startedAt: number;
  lastActivity: number;
}

const SUBJECTS = [
  "알고리즘",
  "자료구조",
  "웹 프론트엔드",
  "백엔드/API",
  "데이터 사이언스",
  "머신러닝/딥러닝",
  "운영체제",
  "네트워크",
  "데이터베이스",
  "함수형 프로그래밍",
];

const DIFFICULTIES = ["입문", "중급", "고급"];

export default function CollabIndex() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [name, setName] = useState("");
  // AI 미션 생성 폼
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"javascript" | "python">("javascript");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const {
    favorites,
    togglePin,
    remove: removeFav,
    clear: clearAuto,
    isPinned,
  } = useFavorites();

  useEffect(() => {
    let active = true;
    async function fetchRooms() {
      try {
        const res = await fetch("/api/collab/rooms", { cache: "no-store" });
        const data = (await res.json()) as { rooms: LiveRoom[] };
        if (!active) return;
        // 최근 활동 순으로 정렬
        const sorted = [...data.rooms].sort(
          (a, b) => b.lastActivity - a.lastActivity,
        );
        setRooms(sorted);
      } catch {
        /* ignore */
      }
    }
    void fetchRooms();
    const t = setInterval(fetchRooms, 5_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/\s+/g, "-").slice(0, 20) || "room";
    setName("");
    // 서버에 "참여" 하면 자동 생성됨 → 바로 이동
    router.push(`/collab/${id}`);
  }

  async function openTemplate(tpl: RoomTemplate) {
    if (templateLoading) return;
    setTemplateLoading(tpl.id);
    try {
      const res = await fetch("/api/collab/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: tpl.subject,
          difficulty: tpl.difficulty,
          language: tpl.language,
          topic: tpl.title,
          template: {
            title: tpl.title,
            description: tpl.description,
            initialCode: tpl.initialCode,
          },
        }),
      });
      const data = await res.json();
      if (data.roomId) router.push(`/collab/${data.roomId}`);
    } finally {
      setTemplateLoading(null);
    }
  }

  async function generateMission() {
    if (generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const payload = withAiCredentials({
        subject,
        difficulty,
        topic: topic.trim(),
        language,
      });
      const res = await fetch("/api/collab/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        roomId?: string;
        error?: string;
      };
      if (!res.ok || !data.roomId) {
        throw new Error(data.error ?? "방 생성 실패");
      }
      router.push(`/collab/${data.roomId}`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "방 생성 실패");
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">실시간 협업 룸</h1>
        <p className="text-sm text-muted">
          팀원이나 스터디원들과 같은 코드 위에서 동시 편집하고, AI가 던지는 공통 미션을
          함께 해결합니다. 아래 목록은 <strong>이 서버의 모든 활성 방</strong>입니다.
        </p>
      </header>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="label flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-500" />
            AI 미션으로 새 방 열기
          </div>
          <div className="text-[11px] text-muted">
            설정 ▸ AI 공급자 키가 있으면 Claude/Gemini/Groq, 없으면 데모 미션
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            aria-label="과목"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="input"
            aria-label="난이도"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "javascript" | "python")}
            className="input"
            aria-label="언어"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="세부 주제 (선택)"
            className="input md:col-span-1"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[11px] text-rose-300">{genError ?? ""}</div>
          <button
            onClick={generateMission}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 미션 작성 중…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 미션 생성 & 방 열기
              </>
            )}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="label">직접 이름으로 방 만들기 (AI 없이)</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="예: cpu-scheduling"
            className="input"
          />
          <button onClick={create} className="btn-primary">
            <Plus className="h-4 w-4" />
            만들기
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          입력한 이름이 바로 방 ID가 됩니다. 다른 참여자가 같은 ID 로 들어오면 함께
          볼 수 있어요.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-strong">
            <Package className="h-3.5 w-3.5 text-brand-500" />
            빠른 시작 템플릿 (AI 호출 없음)
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROOM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              disabled={templateLoading === t.id}
              className="card p-3 text-left transition-colors hover:border-brand-500/40 disabled:opacity-50"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-lg">{t.emoji}</span>
                <div className="flex gap-1">
                  <span className="chip py-0 text-[10px]">{t.subject}</span>
                  <span className="chip py-0 text-[10px]">{t.difficulty}</span>
                </div>
              </div>
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                {t.description}
              </div>
              {templateLoading === t.id && (
                <div className="mt-1 text-[10px] text-accent-500">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> 방 생성 중…
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {favorites.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              <h2 className="text-sm font-semibold text-muted-strong">
                즐겨찾기 ({favorites.length})
              </h2>
              <span className="text-[10px] text-muted">
                ⭐ 는 고정 · 그 외는 최근 방문 (자동)
              </span>
            </div>
            <button
              onClick={clearAuto}
              className="text-[11px] text-muted hover:text-rose-300"
              title="⭐ 고정 외 자동 추가분만 지움"
            >
              자동 기록 지우기
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((e) => {
              const r = rooms.find((x) => x.id === e.id);
              return r ? (
                <RoomCard
                  key={e.id}
                  room={r}
                  isFav={e.pinned}
                  onToggleFav={togglePin}
                />
              ) : (
                <div
                  key={e.id}
                  className="card relative flex items-center justify-between p-4 text-sm transition-colors hover:border-brand-500/40"
                >
                  <Link
                    href={`/collab/${e.id}`}
                    className="inline-flex items-center gap-1.5 hover:text-white"
                  >
                    <Hash className="h-3 w-3" />
                    {e.id}
                    <span className="text-[10px] text-muted">
                      · {timeAgo(e.at)}
                    </span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePin(e.id)}
                      aria-label={e.pinned ? "고정 해제" : "⭐ 고정"}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${e.pinned ? "fill-amber-300 text-amber-300" : "text-muted"}`}
                      />
                    </button>
                    <button
                      onClick={() => removeFav(e.id)}
                      aria-label="목록에서 제거"
                      className="text-muted hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-strong">
            열린 방 ({rooms.length})
          </h2>
          <span className="text-[11px] text-muted">5초마다 자동 갱신</span>
        </div>
        {rooms.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            아직 활성 방이 없어요. 위에서 템플릿·AI 미션으로 열거나 이름으로 직접
            만들어보세요.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                isFav={isPinned(r.id)}
                onToggleFav={togglePin}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoomCard({
  room: r,
  isFav,
  onToggleFav,
}: {
  room: LiveRoom;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  const isLive = r.participants > 0;
  const title = r.mission?.title ?? r.name ?? `방 #${r.id}`;
  return (
    <div className="card relative p-4 transition-colors hover:border-brand-500/40">
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleFav(r.id);
        }}
        className="absolute right-2 top-2 rounded p-1 hover:bg-white/5"
        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
        title={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
      >
        <Star
          className={`h-3.5 w-3.5 ${isFav ? "fill-amber-300 text-amber-300" : "text-muted"}`}
        />
      </button>
      <Link href={`/collab/${r.id}`} className="block pr-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Hash className="h-3 w-3" />
            {r.id}
          </div>
          <div className={`chip ${isLive ? "text-accent-500" : ""}`}>
            {isLive ? (
              <Radio className="h-3 w-3 animate-pulse" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            {r.participants}
          </div>
        </div>
        <div className="line-clamp-2 text-base font-semibold">{title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          {r.mission && (
            <>
              <span className="chip py-0 text-[10px]">{r.mission.subject}</span>
              <span className="chip py-0 text-[10px]">
                {r.mission.difficulty}
              </span>
              <span className="chip py-0 text-[10px]">
                {r.mission.language}
              </span>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-muted">
            {r.hasHost && (
              <span
                title="호스트 있음"
                className="inline-flex items-center gap-0.5 text-amber-300"
              >
                <Crown className="h-3 w-3" />
              </span>
            )}
            {r.hostWalletEnabled && (
              <span
                title="AI 공용 지갑 열림"
                className="inline-flex items-center gap-0.5 text-accent-500"
              >
                <Wallet className="h-3 w-3" />
              </span>
            )}
            {r.messages > 0 ? (
              <span className="inline-flex items-center gap-1 text-brand-500">
                <Zap className="h-3 w-3" />
                채팅 {r.messages}
              </span>
            ) : (
              <span className="text-muted">새 방</span>
            )}
          </span>
          <span className="text-muted">{timeAgo(r.lastActivity)}</span>
        </div>
      </Link>
    </div>
  );
}

function timeAgo(t: number): string {
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
