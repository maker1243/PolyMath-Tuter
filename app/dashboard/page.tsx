"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Flame,
  Users,
  Sparkles,
  Terminal,
  Paperclip,
  MessageSquare,
  Lightbulb,
  LogIn as LogInIcon,
  Download,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import Link from "next/link";

type ActivityType =
  | "room_join"
  | "code_run"
  | "ai_ask"
  | "file_upload"
  | "message_sent"
  | "mission_created"
  | "tutor_ask"
  | "card_review"
  | "card_created"
  | "source_added"
  | "quiz_completed";

interface Activity {
  id: string;
  type: ActivityType;
  roomId?: string;
  meta?: Record<string, unknown>;
  at: number;
}

interface Summary {
  totalActivities: number;
  byType: Record<ActivityType, number>;
  streakDays: number;
  distinctRooms: number;
  weekMinutes: { day: string; count: number }[];
  weekByType: {
    day: string;
    dateKey: string;
    byType: Record<ActivityType, number>;
  }[];
  recent: Activity[];
}

const LABEL: Record<ActivityType, { label: string; icon: typeof Users; color: string }> = {
  room_join: { label: "방 입장", icon: LogInIcon, color: "#5b7cfa" },
  code_run: { label: "코드 실행", icon: Terminal, color: "#22d3b4" },
  ai_ask: { label: "AI 질문 (룸)", icon: Sparkles, color: "#8b5cf6" },
  file_upload: { label: "파일 공유", icon: Paperclip, color: "#f59e0b" },
  message_sent: { label: "메시지", icon: MessageSquare, color: "#38bdf8" },
  mission_created: { label: "AI 미션", icon: Lightbulb, color: "#ec4899" },
  tutor_ask: { label: "튜터 질문", icon: Sparkles, color: "#a78bfa" },
  card_review: { label: "카드 복습", icon: Terminal, color: "#10b981" },
  card_created: { label: "카드 생성", icon: Lightbulb, color: "#059669" },
  source_added: { label: "자료 추가", icon: Lightbulb, color: "#eab308" },
  quiz_completed: { label: "퀴즈 완료", icon: Terminal, color: "#f43f5e" },
};

interface FeedbackStats {
  total: number;
  up: number;
  down: number;
  upRate: number;
  byCategory: Record<string, number>;
  byProvider: Record<string, { up: number; down: number }>;
  recentNegative: {
    id: string;
    rating: string;
    reason?: string;
    category?: string;
    answerPreview?: string;
    provider?: string;
    at: number;
  }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState<string>("");
  const [fb, setFb] = useState<FeedbackStats | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, f] = await Promise.all([
        fetch("/api/activity", { cache: "no-store" }),
        fetch("/api/feedback", { cache: "no-store" }),
      ]);
      if (a.ok) {
        const d = await a.json();
        setSummary(d.summary);
        setName(d.user?.displayName ?? "");
      }
      if (f.ok) {
        const d = await f.json();
        setFb(d.stats);
      }
    })();
  }, []);

  if (!summary) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        학습 기록을 불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {name ? `${name} 님의 학습 대시보드` : "학습 대시보드"}
          </h1>
          <p className="text-sm text-muted">
            서버에 영구 저장된 당신의 모든 활동. 익명 모드로 쓴 기록은 포함되지 않습니다.
          </p>
        </div>
        <a
          href="/api/activity?format=csv"
          download
          className="btn-ghost text-xs"
          title="활동 기록 CSV 다운로드"
        >
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </a>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Flame}
          label="연속 학습"
          value={`${summary.streakDays}일`}
          tone="accent"
        />
        <Kpi
          icon={Flame}
          label="오늘 활동"
          value={`${summary.weekMinutes[summary.weekMinutes.length - 1]?.count ?? 0}건`}
          tone="accent"
        />
        <Kpi
          icon={Users}
          label="참여한 방"
          value={`${summary.distinctRooms}개`}
          tone="brand"
        />
        <Kpi
          icon={Terminal}
          label="코드 실행"
          value={`${summary.byType.code_run}회`}
          tone="brand"
        />
        <Kpi
          icon={Sparkles}
          label="AI 질문"
          value={`${summary.byType.ai_ask}회`}
          tone="accent"
        />
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">주간 활동</div>
            <div className="text-xs text-muted">
              최근 7일 ·{" "}
              {showDetail ? "타입별 상세" : "총 횟수"}
            </div>
          </div>
          <button
            onClick={() => setShowDetail((v) => !v)}
            className="btn-ghost text-xs"
            title="D: 상세 보기 토글"
          >
            {showDetail ? "총량 보기" : "상세 보기 (타입별)"}
          </button>
        </div>
        <div className="h-64">
          {showDetail ? (
            <WeeklyDetailChart data={summary.weekByType} />
          ) : (
            <WeeklyTotalChart data={summary.weekMinutes} />
          )}
        </div>
        {showDetail && (
          <WeeklyLegend data={summary.weekByType} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 text-sm font-semibold">활동 종류별 통계</div>
          <ul className="space-y-2">
            {(Object.keys(LABEL) as Activity["type"][]).map((t) => {
              const { label, icon: Icon } = LABEL[t];
              const count = summary.byType[t] ?? 0;
              const max = Math.max(1, ...Object.values(summary.byType));
              const pct = (count / max) * 100;
              return (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  <span className="w-20 shrink-0 text-muted-strong">{label}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <AiQualitySection fb={fb} />
        <section className="card p-5">
          <div className="mb-3 text-sm font-semibold">최근 활동 20개</div>
          {summary.recent.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">
              아직 기록이 없어요. 협업 룸에 참여하거나 AI 미션을 만들어보세요.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {summary.recent.map((a) => {
                const { label, icon: Icon } = LABEL[a.type];
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-bg-elevated/40 px-2 py-1 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted" />
                    <span className="text-muted-strong">{label}</span>
                    {a.roomId && (
                      <Link
                        href={`/collab/${a.roomId}`}
                        className="truncate text-accent-500 hover:underline"
                      >
                        #{a.roomId}
                      </Link>
                    )}
                    <span className="ml-auto text-[10px] text-muted">
                      {formatAgo(a.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function WeeklyTotalChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAct" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3b4" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#22d3b4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} stroke="#8891a3" fontSize={12} />
        <YAxis tickLine={false} axisLine={false} stroke="#8891a3" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "#141821",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "#aab2c3" }}
        />
        <Area type="monotone" dataKey="count" stroke="#22d3b4" strokeWidth={2} fill="url(#gradAct)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function WeeklyDetailChart({
  data,
}: {
  data: Summary["weekByType"];
}) {
  // 사용된 타입만 추출 (0 이 아닌 것)
  const usedTypes = (Object.keys(LABEL) as ActivityType[]).filter((t) =>
    data.some((d) => (d.byType[t] ?? 0) > 0),
  );
  const flat = data.map((d) => {
    const row: Record<string, number | string> = { day: d.day, dateKey: d.dateKey };
    for (const t of usedTypes) row[t] = d.byType[t] ?? 0;
    return row;
  });
  if (usedTypes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        최근 7일간 기록된 활동이 없어요
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={flat} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} stroke="#8891a3" fontSize={12} />
        <YAxis tickLine={false} axisLine={false} stroke="#8891a3" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "#141821",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "#aab2c3" }}
          formatter={(v: number, k: string) => [v, LABEL[k as ActivityType]?.label ?? k]}
        />
        {usedTypes.map((t) => (
          <Bar key={t} dataKey={t} stackId="a" fill={LABEL[t].color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeeklyLegend({ data }: { data: Summary["weekByType"] }) {
  const usedTypes = (Object.keys(LABEL) as ActivityType[]).filter((t) =>
    data.some((d) => (d.byType[t] ?? 0) > 0),
  );
  if (usedTypes.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {usedTypes.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-bg-elevated/40 px-2 py-0.5 text-[10px] text-muted-strong"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: LABEL[t].color }}
          />
          {LABEL[t].label}
        </span>
      ))}
    </div>
  );
}

function AiQualitySection({ fb }: { fb: FeedbackStats | null }) {
  if (!fb || fb.total === 0) {
    return (
      <section className="card p-5">
        <div className="mb-2 text-sm font-semibold">AI 응답 품질</div>
        <div className="text-xs text-muted">
          협업 룸에서 AI 답변에 <ThumbsUp className="mx-1 inline h-3 w-3" /> /
          <ThumbsDown className="mx-1 inline h-3 w-3" /> 평가하면 여기에 쌓입니다.
          👎 시 "어떤 점이 아쉬웠나요?" 폼으로 카테고리·이유 수집.
        </div>
      </section>
    );
  }
  const upPct = Math.round(fb.upRate * 100);
  const CAT_LABEL: Record<string, string> = {
    wrong: "사실 오류",
    unclear: "모호함",
    "off-topic": "주제 벗어남",
    "too-long": "너무 김",
    "too-short": "너무 짧음",
    other: "기타",
  };
  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">AI 응답 품질</div>
        <span className="text-xs text-muted">
          총 {fb.total}건 평가 (👍 {fb.up} · 👎 {fb.down})
        </span>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-strong">긍정 비율</span>
          <span className="font-mono">{upPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-rose-500/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-brand-500"
            style={{ width: `${upPct}%` }}
          />
        </div>
      </div>
      {Object.entries(fb.byCategory).some(([, n]) => n > 0) && (
        <div>
          <div className="mb-1 text-xs text-muted-strong">👎 사유 카테고리</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(fb.byCategory)
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k} className="chip py-0 text-[10px]">
                  {CAT_LABEL[k] ?? k} · {n}
                </span>
              ))}
          </div>
        </div>
      )}
      {Object.keys(fb.byProvider).length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted-strong">공급자별</div>
          <div className="space-y-1">
            {Object.entries(fb.byProvider).map(([p, s]) => {
              const t = s.up + s.down;
              const r = t === 0 ? 0 : Math.round((s.up / t) * 100);
              return (
                <div key={p} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted">{p}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-1.5 rounded-full bg-accent-500"
                      style={{ width: `${r}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-[10px] text-muted">
                    {r}% ({t})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {fb.recentNegative.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted-strong">
            최근 👎 피드백
          </div>
          <ul className="space-y-1.5">
            {fb.recentNegative.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs"
              >
                <div className="mb-0.5 flex items-center gap-1 text-[10px] text-rose-200">
                  {n.category && (
                    <span>{CAT_LABEL[n.category] ?? n.category}</span>
                  )}
                  {n.provider && <span>· {n.provider}</span>}
                  <span className="ml-auto text-muted">
                    {formatAgo(n.at)}
                  </span>
                </div>
                {n.reason && (
                  <div className="text-rose-100">{n.reason}</div>
                )}
                {n.answerPreview && (
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-muted">
                    답변: {n.answerPreview}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function formatAgo(t: number): string {
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-muted">{label}</div>
        <div
          className={`rounded-lg p-1.5 ${
            tone === "brand"
              ? "bg-brand-500/15 text-brand-500"
              : "bg-accent-500/15 text-accent-500"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
