"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Calculator, Clock, Keyboard, Languages, Sparkles } from "lucide-react";

interface MiniApp {
  href: string;
  title: string;
  desc: string;
  emoji: string;
  icon: typeof Calculator;
  tag: string;
  ready: boolean;
}

const APPS: MiniApp[] = [
  {
    href: "/apps/math-quiz",
    title: "수학 사칙연산 드릴",
    desc: "레벨별 랜덤 문제 출제 → 즉시 채점. 시간 제한, 연속 정답 보너스, 틀린 문제 복습까지. AI 호출 없이 바로 실행.",
    emoji: "🔢",
    icon: Calculator,
    tag: "수학",
    ready: true,
  },
  {
    href: "/apps/vocab-cards",
    title: "영어 단어 카드",
    desc: "주제·레벨 선택 → AI 가 10장 생성 → 뒤집기로 뜻·예문·발음 확인. 알아요/몰라요 체크 후 결과 리포트.",
    emoji: "🗂️",
    icon: Languages,
    tag: "어학",
    ready: true,
  },
  {
    href: "/apps/hanja-cards",
    title: "한자 플래시카드",
    desc: "音·訓·부수·획수. 상용한자 100자 중 레벨별 10~40자 뽑아 플립/4지선다 퀴즈. 🔊 중국어 발음도 재생.",
    emoji: "🀄",
    icon: BookOpen,
    tag: "한문",
    ready: true,
  },
  {
    href: "/apps/code-typing",
    title: "코드 타이핑 드릴",
    desc: "Python/JS/TS 실전 스니펫 (fib, debounce, utility types 등) 보고 그대로 입력. 글자별 하이라이트 + 정확도·WPM·CPM.",
    emoji: "⌨️",
    icon: Keyboard,
    tag: "프로그래밍",
    ready: true,
  },
  {
    href: "/apps/history-quiz",
    title: "역사 연표 퀴즈",
    desc: "한국사·세계사 주요 사건 47개를 4지선다로. 연도 → 사건 / 사건 → 연도 양방향, 틀리면 바로 설명 노출.",
    emoji: "📜",
    icon: Clock,
    tag: "역사",
    ready: true,
  },
];

export default function AppsIndex() {
  const ready = APPS.filter((a) => a.ready);
  const upcoming = APPS.filter((a) => !a.ready);
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-10">
      <header>
        <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 p-3">
          <Sparkles className="h-6 w-6 text-brand-500" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">학습 앱</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          AI 튜터와 별개로 돌아가는 **독립형 학습 미니앱**. 짧은 시간에 집중해서 특정
          스킬을 반복 훈련할 때 쓰세요. 결과는 복습 큐·대시보드에 자동으로 쌓입니다.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-strong">바로 실행</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ready.map((a) => (
            <AppCard key={a.href} app={a} />
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-strong">개발 예정</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((a) => (
              <AppCard key={a.title} app={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AppCard({ app }: { app: MiniApp }) {
  const Inner = (
    <div
      className={`rounded-2xl border p-5 transition ${
        app.ready
          ? "border-white/5 bg-bg-elevated/40 hover:border-accent-500/40 hover:bg-bg-elevated/60"
          : "border-white/5 bg-bg-elevated/20 opacity-60"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="text-3xl">{app.emoji}</div>
        <span className="rounded-full border border-white/10 bg-bg-elevated px-2 py-0.5 text-[10px] text-muted">
          {app.tag}
        </span>
      </div>
      <h3 className="text-base font-semibold">{app.title}</h3>
      <p className="mt-1 text-[11px] text-muted">{app.desc}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-xs text-accent-500">
        {app.ready ? (
          <>
            실행하기 <ArrowRight className="h-3 w-3" />
          </>
        ) : (
          "준비 중…"
        )}
      </div>
    </div>
  );
  return app.ready ? (
    <Link href={app.href} className="block">
      {Inner}
    </Link>
  ) : (
    <div>{Inner}</div>
  );
}
