import { Share2, BookOpen, CheckCircle2, Code2 } from "lucide-react";

const SAMPLE = {
  name: "민찬 · 폴리매스 포트폴리오",
  bio: "AI 모델 내부 구조와 TypeScript 엄격 모드를 함께 공부하는 중.",
  summary: [
    {
      title: "셀프 어텐션: Q·K·V 의 의미",
      body: "Q·K 내적으로 가중치를 만들고 V 에 투영. 스케일 √d_k 로 안정화.",
    },
    {
      title: "TypeScript `satisfies` 연산자",
      body: "타입 단언 없이 구체 타입을 보존 — Record 와 동시에 리터럴 타입 유지.",
    },
  ],
  solved: ["재귀 fib → 메모이제이션", "Dijkstra 우선순위 큐 구현", "LRU Cache (O(1))"],
  snippet: `function memoize(fn) {
  const cache = new Map();
  return function(x) {
    if (cache.has(x)) return cache.get(x);
    const v = fn(x);
    cache.set(x, v);
    return v;
  };
}`,
};

export default function PortfolioPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted">퍼블릭 포트폴리오</div>
          <h1 className="mt-1 text-3xl font-bold">{SAMPLE.name}</h1>
          <p className="mt-2 max-w-xl text-muted">{SAMPLE.bio}</p>
        </div>
        <button className="btn-ghost shrink-0">
          <Share2 className="h-4 w-4" />
          공유 링크
        </button>
      </header>

      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-brand-500" />
          요약 노트
        </div>
        <div className="space-y-3">
          {SAMPLE.summary.map((s) => (
            <div key={s.title} className="rounded-xl border border-white/5 bg-bg-elevated/60 p-4">
              <div className="text-sm font-semibold">{s.title}</div>
              <div className="mt-1 text-sm text-muted">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-accent-500" />
          해결한 문제
        </div>
        <ul className="space-y-1.5 text-sm">
          {SAMPLE.solved.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-brand-500" />
          대표 코드
        </div>
        <pre className="overflow-x-auto rounded-xl border border-white/5 bg-black/40 p-4 font-mono text-xs leading-relaxed">
          {SAMPLE.snippet}
        </pre>
      </section>
    </article>
  );
}
