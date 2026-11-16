"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Share2,
  Copy,
  Check,
  Loader2,
  BookOpen,
  Users,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";

interface PublicDeck {
  slug: string;
  title: string;
  content: string;
  kind: string;
  publisherName: string;
  publishedAt: number;
  copyCount: number;
  cards: { front: string; back: string }[];
  totalCards: number;
}

export default function PublicDeckPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const [deck, setDeck] = useState<PublicDeck | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/study/deck/${slug}`, { cache: "no-store" });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      const d = await r.json();
      setDeck(d.deck);
    })();
  }, [slug]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyToMyDeck() {
    if (!user || copying) return;
    setCopying(true);
    const r = await fetch(`/api/study/deck/${slug}`, { method: "POST" });
    if (r.ok) {
      setCopied(true);
      setTimeout(() => router.push("/study"), 1000);
    } else {
      setCopying(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted" />
        <h1 className="text-2xl font-semibold">덱이 없거나 비공개입니다</h1>
        <p className="text-sm text-muted">
          공유자가 공개를 해제했거나, 링크가 잘못되었을 수 있습니다.
        </p>
        <Link href="/study" className="btn-primary">
          내 복습 큐로
        </Link>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        덱을 불러오는 중…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-2">
        <div className="chip w-fit">
          <Share2 className="h-3 w-3 text-accent-500" />
          공개 플래시카드 덱
        </div>
        <h1 className="text-2xl font-semibold">{deck.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            <strong className="text-muted-strong">
              {deck.publisherName}
            </strong>{" "}
            님 공유
          </span>
          <span>
            {new Date(deck.publishedAt).toLocaleDateString()} ·{" "}
            {deck.totalCards}개 카드
          </span>
          {deck.copyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-accent-500">
              <Users className="h-3 w-3" />
              {deck.copyCount}명이 복사
            </span>
          )}
        </div>
      </header>

      {deck.content && (
        <section className="card p-4">
          <div className="label flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            원본 자료 (앞부분)
          </div>
          <div className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs text-muted-strong">
            {deck.content}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={copyLink} className="btn-ghost text-xs">
          {linkCopied ? (
            <>
              <Check className="h-3 w-3" />
              링크 복사됨
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              공유 링크 복사
            </>
          )}
        </button>
        {userLoading ? null : user ? (
          <button
            onClick={copyToMyDeck}
            disabled={copying || copied}
            className="btn-primary flex-1 justify-center text-xs"
          >
            {copying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : copied ? (
              <>
                <Check className="h-3 w-3" />내 덱으로 복사됨 — 이동 중…
              </>
            ) : (
              <>
                <ArrowRight className="h-3 w-3" />내 덱으로 복사 ({deck.totalCards}
                개 카드)
              </>
            )}
          </button>
        ) : (
          <Link
            href={`/auth/login?next=/study/deck/${slug}`}
            className="btn-primary flex-1 justify-center text-xs"
          >
            로그인하고 복사
          </Link>
        )}
      </div>

      <section>
        <div className="mb-2 text-sm font-semibold text-muted-strong">
          카드 미리보기 ({deck.cards.length}
          {deck.cards.length < deck.totalCards && ` / ${deck.totalCards}`})
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {deck.cards.map((c, i) => (
            <div key={i} className="card p-3">
              <div className="text-xs font-semibold">{c.front}</div>
              <div className="mt-1 border-t border-white/5 pt-1 text-[11px] text-muted">
                {c.back}
              </div>
            </div>
          ))}
        </div>
        {deck.totalCards > deck.cards.length && (
          <div className="mt-2 text-center text-[11px] text-muted">
            복사 후 전체 {deck.totalCards}개 카드 모두 사용 가능
          </div>
        )}
      </section>
    </div>
  );
}
