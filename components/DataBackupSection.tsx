"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  ShieldAlert,
  Upload,
} from "lucide-react";

type RestoreState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | {
      kind: "ok";
      mode: "merge" | "replace";
      usersAdded: number;
      usersUpdated: number;
      sessionsAdded: number;
      skipped: number;
    }
  | { kind: "error"; message: string };

export function DataBackupSection({ isOwner }: { isOwner: boolean }) {
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [state, setState] = useState<RestoreState>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ kind: "uploading" });
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSON 형식이 아닙니다");
      }
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: parsed, mode: restoreMode }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: "merge" | "replace";
        usersAdded?: number;
        usersUpdated?: number;
        sessionsAdded?: number;
        skipped?: number;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setState({
        kind: "ok",
        mode: data.mode ?? restoreMode,
        usersAdded: data.usersAdded ?? 0,
        usersUpdated: data.usersUpdated ?? 0,
        sessionsAdded: data.sessionsAdded ?? 0,
        skipped: data.skipped ?? 0,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!isOwner) {
    return (
      <section className="rounded-2xl border border-white/5 bg-bg-elevated/30 p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-strong">
          <ShieldAlert className="h-4 w-4" />
          데이터 백업 · 복원
        </div>
        <p className="text-xs text-muted">
          이 인스턴스의 <b className="text-white">오너(= 가장 먼저 가입한 계정)</b>
          만 전체 백업/복원을 할 수 있어요. 본인의 학습 데이터는 브라우저
          localStorage 에 자동 저장되므로 재배포와 무관하게 유지됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/5 bg-bg-elevated/40 p-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          데이터 백업 · 복원 <span className="text-xs text-muted">(오너 전용)</span>
        </div>
        <p className="text-xs text-muted">
          서버에 저장된 <b className="text-white">전체 사용자 계정·세션</b>을 JSON
          으로 받아두고, 재배포로 서버가 초기화됐을 때 다시 올리면 복구됩니다.
          <br />
          파일에는 비밀번호 해시가 포함되므로 <b className="text-amber-300">안전한 곳에 보관</b>하세요 (타인 공유 금지).
        </p>
      </div>

      {/* 다운로드 */}
      <div className="rounded-xl border border-white/5 bg-bg px-4 py-3">
        <div className="mb-2 text-xs font-semibold text-muted-strong">
          1. 지금 상태 백업하기
        </div>
        <a
          href="/api/admin/backup"
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Download className="h-4 w-4" />
          auth-backup.json 다운로드
        </a>
        <div className="mt-1 text-[10px] text-muted">
          GET /api/admin/backup · 매번 눌러서 최신본으로 갱신하세요.
        </div>
      </div>

      {/* 업로드 */}
      <div className="rounded-xl border border-white/5 bg-bg px-4 py-3">
        <div className="mb-2 text-xs font-semibold text-muted-strong">
          2. 백업 파일로 복원하기
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <ModeChip
            active={restoreMode === "merge"}
            onClick={() => setRestoreMode("merge")}
            label="병합 (추천)"
            desc="같은 id 는 최신으로 덮어쓰고 새 id 만 추가"
          />
          <ModeChip
            active={restoreMode === "replace"}
            onClick={() => setRestoreMode("replace")}
            label="교체"
            desc="현재 전체를 지우고 백업으로 완전 대체"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-bg-elevated px-3 py-1.5 text-sm text-muted-strong hover:bg-white/5 hover:text-white">
          <Upload className="h-4 w-4" />
          백업 파일 선택
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>

      {/* 결과 */}
      {state.kind === "uploading" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          복원 중…
        </div>
      )}
      {state.kind === "ok" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            복원 완료 ({state.mode === "replace" ? "전체 교체" : "병합"})
          </div>
          <div className="mt-1 text-emerald-300/80">
            사용자 추가 {state.usersAdded} · 갱신 {state.usersUpdated} · 세션 추가{" "}
            {state.sessionsAdded} · 건너뜀 {state.skipped}
          </div>
        </div>
      )}
      {state.kind === "error" && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="rounded-lg border border-white/5 bg-bg px-3 py-2 text-[11px] leading-5 text-muted">
        💡 <b className="text-white">자동 분리 저장</b>: 서버 환경변수{" "}
        <code className="rounded bg-white/5 px-1">POLYMATH_AUTH_DIR</code> 를 다른
        경로로 지정하면 인증 데이터만 별도 영구 볼륨에 저장할 수 있습니다. 설정 안
        하면 <code className="rounded bg-white/5 px-1">POLYMATH_DATA_DIR</code> 와
        동일한 위치를 씁니다.
      </div>
    </section>
  );
}

function ModeChip({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
        active
          ? "border-accent-500/60 bg-accent-500/10 text-white"
          : "border-white/10 bg-bg-elevated/60 text-muted hover:text-white"
      }`}
      title={desc}
    >
      {label}
    </button>
  );
}
