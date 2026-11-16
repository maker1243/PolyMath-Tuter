import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Code2,
  Users,
  Trophy,
  LineChart,
  Share2,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "다중 소스 멀티모달 입력",
    desc: "PDF, 전공 서적, 소스 코드(.py/.js), API 명세서까지 한 번에 업로드하고 수준에 맞춰 요약합니다.",
    href: "/learn",
  },
  {
    icon: Sparkles,
    title: "AI 튜터 & 단계별 힌트 디버거",
    desc: "정답을 바로 주지 않습니다. 'X번째 줄 변수 타입을 확인해 보세요'처럼 소크라테스식 힌트를 제공합니다.",
    href: "/tutor",
  },
  {
    icon: Code2,
    title: "원클릭 즉시 실행 샌드박스",
    desc: "로컬 환경 설정 없이 브라우저에서 바로 코드를 실행하고 터미널 로그를 확인합니다.",
    href: "/sandbox",
  },
  {
    icon: Users,
    title: "실시간 협동 코딩 룸",
    desc: "팀원들과 같은 화면에서 코드를 수정하고 AI가 던지는 공통 미션을 함께 해결합니다.",
    href: "/collab",
  },
  {
    icon: Trophy,
    title: "실시간 AI 퀴즈 배틀",
    desc: "공부한 내용 기반으로 AI가 즉석에서 문제를 출제하고 학습자들이 대결하며 복습합니다.",
    href: "/quiz",
  },
  {
    icon: LineChart,
    title: "취약점 히트맵 & 리포트",
    desc: "자주 틀리는 에러 패턴과 개념을 시각화하고, 망각 곡선에 맞춰 복습 알림을 보냅니다.",
    href: "/dashboard",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-bg-surface/60 px-6 py-16 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-strong">
            <Sparkles className="h-3.5 w-3.5 text-accent-500" />
            학습 + AI + 소프트웨어 + 온라인 — 네 축이 하나의 플랫폼으로
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            개념부터 실전 디버깅까지,
            <br />
            <span className="bg-gradient-to-r from-brand-500 via-accent-500 to-brand-500 bg-clip-text text-transparent">
              당신의 학습 페이스메이커.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-strong sm:text-lg">
            단방향 주입식 학습과 따로 노는 이론·실습 환경을 벗어나세요. PolyMath Tutor는
            개인 맞춤형 이론 학습, 소크라테스식 코딩 디버깅, 실시간 협업·게이미피케이션을
            하나의 흐름으로 묶습니다.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            자료가 없어도 괜찮아요 — 과목만 골라도 바로 세션이 시작됩니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/signup" className="btn-primary">
              무료로 가입하기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/collab" className="btn-ghost">
              협업 룸 둘러보기
            </Link>
            <Link href="/sandbox" className="btn-ghost">
              샌드박스 체험
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            가입 없이도 쓸 수 있지만 — <strong>로그인</strong> 하면 학습 기록이
            영구 저장되고 대시보드에 쌓입니다.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">핵심 기능</h2>
            <p className="mt-1 text-sm text-muted">개념 문해력 · 실전 디버깅 · 협업 · 복습까지</p>
          </div>
          <Link
            href="/learn"
            className="hidden text-sm text-muted-strong hover:text-white sm:inline-flex sm:items-center sm:gap-1"
          >
            전체 둘러보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, href }) => (
            <Link
              key={title}
              href={href}
              className="card group p-5 transition-all hover:border-brand-500/40 hover:shadow-glow"
            >
              <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 p-2.5">
                <Icon className="h-5 w-5 text-brand-500" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
                바로가기 <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="card p-6 sm:p-10">
        <h2 className="text-2xl font-semibold">학습이 이렇게 흐릅니다</h2>
        <p className="mt-1 text-sm text-muted">
          업로드 → AI 요약 → 실습 → 디버깅 힌트 → 팀 복습 → 포트폴리오 자동 생성
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-5">
          {[
            { n: 1, t: "자료 업로드", d: "PDF·코드·명세서를 한번에" },
            { n: 2, t: "모드 선택", d: "단일 집중 또는 복합 융합" },
            { n: 3, t: "AI 튜터 세션", d: "요약 카드·힌트·질문" },
            { n: 4, t: "협업·퀴즈", d: "팀원과 함께 실시간 복습" },
            { n: 5, t: "포트폴리오", d: "공유 가능한 학습 아카이브" },
          ].map(({ n, t, d }) => (
            <li
              key={n}
              className="rounded-2xl border border-white/5 bg-bg-elevated/60 p-4"
            >
              <div className="mb-2 text-xs text-muted">STEP {n}</div>
              <div className="text-sm font-semibold">{t}</div>
              <div className="mt-1 text-xs text-muted">{d}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* Portfolio hint */}
      <section className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-accent-500/5 p-8 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-strong">
            <Share2 className="h-3.5 w-3.5" />
            학습 퍼블릭 포트폴리오
          </div>
          <h3 className="text-xl font-semibold">배운 걸 바로 공유 가능한 웹 페이지로.</h3>
          <p className="mt-1 text-sm text-muted">
            요약 노트, 해결한 문제, 성공한 코드를 조합해 공유 링크 하나로 보내세요.
          </p>
        </div>
        <Link href="/portfolio/demo" className="btn-primary">
          샘플 포트폴리오 보기 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
