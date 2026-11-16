"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Code2,
  BookMarked,
  StickyNote,
  Link as LinkIcon,
  X,
  Upload,
  Zap,
  Shuffle,
  Plus,
} from "lucide-react";
import type { LearningMode, LearningSource, SkillLevel, SourceKind } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { readSourceContent, saveSession } from "@/lib/session-store";
import { randomId } from "@/lib/random-id";
import { SUBJECT_GROUPS } from "@/lib/subjects";

const iconFor: Record<SourceKind, typeof FileText> = {
  pdf: FileText,
  code: Code2,
  spec: BookMarked,
  note: StickyNote,
  url: LinkIcon,
};

function detectKind(filename: string): SourceKind {
  const n = filename.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.match(/\.(py|js|ts|tsx|jsx|java|cpp|rs|go)$/)) return "code";
  if (n.match(/\.(json|yaml|yml)$/)) return "spec";
  if (n.match(/\.(md|txt)$/)) return "note";
  return "note";
}

interface SourceWithPreview extends LearningSource {
  preview: string;
}

export default function LearnPage() {
  const router = useRouter();
  const [sources, setSources] = useState<SourceWithPreview[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [mode, setMode] = useState<LearningMode>("single");
  const [level, setLevel] = useState<SkillLevel>("intermediate");
  const [goal, setGoal] = useState("");
  const [reading, setReading] = useState(false);

  function toggleSubject(name: string) {
    setSubjects((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  function addCustomSubject() {
    const v = customSubject.trim();
    if (!v || subjects.includes(v)) {
      setCustomSubject("");
      return;
    }
    setSubjects((prev) => [...prev, v]);
    setCustomSubject("");
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setReading(true);
    const next: SourceWithPreview[] = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: randomId(),
        name: file.name,
        kind: detectKind(file.name),
        size: file.size,
        addedAt: new Date().toISOString(),
        preview: await readSourceContent(file),
      })),
    );
    setSources((prev) => [...prev, ...next]);
    setReading(false);
  }

  function remove(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  const canStart = sources.length > 0 || subjects.length > 0 || goal.trim().length > 0;

  function start() {
    if (!canStart) return;
    const sessionId = randomId().slice(0, 8);
    saveSession({
      id: sessionId,
      createdAt: new Date().toISOString(),
      mode,
      level,
      goal,
      subjects,
      sources,
    });
    const params = new URLSearchParams({ mode, level, goal });
    router.push(`/tutor/${sessionId}?${params.toString()}`);
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold">학습 세션 설정</h1>
        <p className="mt-1 text-sm text-muted">
          과목만 골라도 바로 시작할 수 있고, 자료를 함께 올리면 자료 기반으로 더 깊게 들어갑니다.
        </p>
      </header>

      {/* Subjects */}
      <section className="card p-6">
        <div className="mb-1 flex items-end justify-between">
          <label className="label">1. 과목 선택</label>
          <div className="text-xs text-muted">
            {subjects.length}개 선택됨 · 복수 선택 가능
          </div>
        </div>
        <div className="space-y-4">
          {SUBJECT_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="mb-2 text-xs font-semibold text-muted-strong">
                <span className="mr-1">{g.emoji}</span>
                {g.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.subjects.map((s) => {
                  const active = subjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleSubject(s);
                      }}
                      aria-pressed={active}
                      className={`cursor-pointer select-none rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-brand-500/60 bg-brand-500/15 text-white"
                          : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="label">목록에 없는 과목 직접 추가</div>
          <div className="flex gap-2">
            <input
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomSubject()}
              placeholder="예: 조직행동론, 유기화학, 중세 유럽사"
              className="input"
            />
            <button
              onClick={addCustomSubject}
              disabled={!customSubject.trim()}
              className="btn-ghost shrink-0"
            >
              <Plus className="h-4 w-4" />
              추가
            </button>
          </div>
          {subjects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <span key={s} className="chip">
                  {s}
                  <button
                    onClick={() => toggleSubject(s)}
                    className="ml-1 text-muted hover:text-white"
                    aria-label={`${s} 제거`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Dropzone */}
      <section className="card p-6">
        <div className="mb-1 flex items-end justify-between">
          <label className="label">2. 자료 업로드 (선택)</label>
          <div className="text-xs text-muted">자료가 있으면 그 내용 기반으로 더 깊게</div>
        </div>
        <label
          htmlFor="file-input"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-bg-elevated/40 px-6 py-12 text-center transition-colors hover:border-brand-500/50 hover:bg-brand-500/5"
        >
          <Upload className="mb-3 h-6 w-6 text-brand-500" />
          <div className="text-sm font-medium">파일을 끌어다 놓거나 클릭해서 선택</div>
          <div className="mt-1 text-xs text-muted">
            PDF · .py · .js · .ts · .json · .yaml · .md
          </div>
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {reading && (
          <div className="mt-4 text-xs text-muted">파일 내용을 읽는 중…</div>
        )}

        {sources.length > 0 && (
          <ul className="mt-5 space-y-2">
            {sources.map((s) => {
              const Icon = iconFor[s.kind];
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-bg-elevated/60 px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.kind.toUpperCase()} · {formatBytes(s.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-white"
                    aria-label="제거"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mode */}
      <section className="card p-6">
        <label className="label">3. 학습 모드</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "single"}
            onClick={() => setMode("single")}
            icon={Zap}
            title="단일 집중 모드"
            desc="하나의 개념 또는 기술 스택을 깊게 파고듭니다."
          />
          <ModeCard
            active={mode === "fusion"}
            onClick={() => setMode("fusion")}
            icon={Shuffle}
            title="복합 융합 모드"
            desc="이론과 코딩, 혹은 서로 다른 두 과목/기술을 엮어 입체적으로."
          />
        </div>
      </section>

      {/* Level + goal */}
      <section className="card p-6">
        <label className="label">4. 수준 & 목표</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="label">현재 수준</div>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as SkillLevel[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  aria-pressed={level === lv}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    level === lv
                      ? "border-brand-500/50 bg-brand-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                  }`}
                >
                  {{ beginner: "초급", intermediate: "중급", advanced: "고급" }[lv]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">학습 목표 (선택)</div>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 트랜스포머의 어텐션 원리를 코드로 이해하기"
              className="input"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="text-sm text-muted">
          {subjects.length}개 과목 · {sources.length}개 자료 ·{" "}
          {mode === "single" ? "단일 집중" : "복합 융합"} ·{" "}
          {{ beginner: "초급", intermediate: "중급", advanced: "고급" }[level]}
        </div>
        <button onClick={start} disabled={!canStart} className="btn-primary">
          AI 튜터 시작
        </button>
      </div>
      {!canStart && (
        <div className="text-right text-xs text-muted">
          과목 하나 이상 선택하거나, 자료를 올리거나, 학습 목표를 입력하면 시작할 수 있습니다.
        </div>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Zap;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-5 text-left transition-all ${
        active
          ? "border-brand-500/60 bg-brand-500/10 shadow-glow"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 p-2.5">
        <Icon className="h-5 w-5 text-brand-500" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted">{desc}</div>
    </button>
  );
}
