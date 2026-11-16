"use client";

import { useEffect, useState } from "react";
import { UserCircle2, Loader2, Check } from "lucide-react";
import {
  emitAuthChanged,
  useCurrentUser,
} from "@/lib/use-current-user";

export function ProfileSection() {
  const { user, loading, refresh } = useCurrentUser();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState(false);

  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user]);

  if (loading || !user) return null;

  async function saveName() {
    if (!name.trim() || name === user?.displayName) return;
    setSaving(true);
    try {
      const r = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (r.ok) {
        setSavedName(true);
        setTimeout(() => setSavedName(false), 1500);
        emitAuthChanged();
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <div className="label flex items-center gap-1">
          <UserCircle2 className="h-3 w-3" />
          프로필
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted">표시 이름</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="input"
            placeholder="표시 이름"
          />
          <button
            onClick={saveName}
            disabled={saving || !name.trim() || name === user.displayName}
            className="btn-primary py-1 text-xs"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : savedName ? (
              <>
                <Check className="h-3 w-3" />
                저장됨
              </>
            ) : (
              "저장"
            )}
          </button>
        </div>
        <div className="text-[11px] text-muted">
          이메일: {user.email} · 알림 on/off 는 각 협업 룸 상단의 🔔 토글로
          관리됩니다.
        </div>
      </div>
    </section>
  );
}
