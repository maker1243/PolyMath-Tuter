"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";

export function PasswordSection() {
  const { user, loading } = useCurrentUser();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (loading) return null;
  if (!user) {
    return (
      <section className="card space-y-2 p-5">
        <div className="label flex items-center gap-1">
          <KeyRound className="h-3 w-3" />
          비밀번호 변경
        </div>
        <p className="text-xs text-muted">
          로그인한 사용자만 이용할 수 있습니다.
        </p>
      </section>
    );
  }

  async function submit() {
    setMsg(null);
    if (newPassword !== confirm) {
      setMsg({ ok: false, text: "새 비밀번호와 확인이 일치하지 않습니다" });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ ok: false, text: "새 비밀번호는 8자 이상이어야 합니다" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "변경 실패" });
      } else {
        setMsg({ ok: true, text: "비밀번호를 변경했습니다. 다른 기기는 재로그인이 필요합니다." });
        setOld("");
        setNew("");
        setConfirm("");
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "네트워크 오류" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <div className="label flex items-center gap-1">
          <KeyRound className="h-3 w-3" />
          비밀번호 변경
        </div>
        <div className="text-xs text-muted">
          변경하면 다른 기기·브라우저의 세션은 모두 로그아웃됩니다 (현재 탭 제외).
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="password"
          placeholder="현재 비밀번호"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOld(e.target.value)}
          className="input"
        />
        <input
          type="password"
          placeholder="새 비밀번호 (8자 이상)"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          className="input"
        />
        <input
          type="password"
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
        />
      </div>
      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            msg.ok
              ? "border border-accent-500/30 bg-accent-500/10 text-accent-500"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {msg.text}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={submitting || !oldPassword || !newPassword || !confirm}
          className="btn-primary py-1 text-xs"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              변경 중…
            </>
          ) : (
            "비밀번호 변경"
          )}
        </button>
      </div>
    </section>
  );
}
