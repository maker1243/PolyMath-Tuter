"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserPlus, Mail, Lock, UserCircle2, Loader2 } from "lucide-react";
import { emitAuthChanged } from "@/lib/use-current-user";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted">로딩 중…</div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "가입 실패");
        setSubmitting(false);
        return;
      }
      emitAuthChanged();
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <header className="space-y-1 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
          <UserPlus className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold">회원가입</h1>
        <p className="text-sm text-muted">
          학습 기록·대시보드·협업 참여 히스토리를 영구 저장합니다.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <label className="block space-y-1">
          <span className="label flex items-center gap-1">
            <UserCircle2 className="h-3 w-3" />
            표시 이름
          </span>
          <input
            required
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="예: 김민찬"
          />
        </label>
        <label className="block space-y-1">
          <span className="label flex items-center gap-1">
            <Mail className="h-3 w-3" />
            이메일
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
          />
        </label>
        <label className="block space-y-1">
          <span className="label flex items-center gap-1">
            <Lock className="h-3 w-3" />
            비밀번호
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="8자 이상"
          />
        </label>
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full justify-center"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              가입 중…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              가입하고 시작하기
            </>
          )}
        </button>
      </form>

      <div className="text-center text-sm text-muted">
        이미 계정이 있나요?{" "}
        <Link
          href={`/auth/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-accent-500 hover:underline"
        >
          로그인
        </Link>
      </div>
    </div>
  );
}
