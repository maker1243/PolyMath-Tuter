"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  Lightbulb,
  BookOpen,
  Code2,
  FileText,
  GraduationCap,
  SkipForward,
} from "lucide-react";
import type { TutorMessage, SkillLevel } from "@/lib/types";
import {
  buildContextBlock,
  loadMessages,
  loadSession,
  saveMessages,
  type LearningSession,
} from "@/lib/session-store";
import { withAiCredentials } from "@/lib/user-settings";
import { randomId } from "@/lib/random-id";
import {
  TutorCodeRunner,
  detectCodeTask,
  type CodeTask,
} from "@/components/TutorCodeRunner";
import { renderWithMermaid } from "@/components/MermaidChart";

const DIRECT_KEY = "polymath:tutor:direct";

export default function TutorSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const level = (search.get("level") ?? "intermediate") as SkillLevel;
  const mode = search.get("mode") ?? "single";
  const goal = search.get("goal") ?? "";

  const [session, setSession] = useState<LearningSession | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  // 건너뛰기(직접 답변) 모드 — ON 이면 이후 모든 질문에 적용. localStorage 유지.
  const [directMode, setDirectMode] = useState(false);
  const [codeTask, setCodeTask] = useState<CodeTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 어시스턴트의 최신 메시지에서 코드 블록·코딩 과제 신호 감지 → 패널 자동 노출
  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.length > 0);
    if (!lastAssistant) return;
    const detected = detectCodeTask(lastAssistant.content);
    if (detected && detected.seed !== codeTask?.seed) {
      setCodeTask(detected);
    }
  }, [messages, codeTask?.seed]);

  useEffect(() => {
    const s = loadSession(sessionId);
    setSession(s);

    // 과거 세션 복원 시도 — 메시지가 저장돼 있으면 그걸 로드
    const restored = loadMessages(sessionId);
    if (restored && restored.messages.length > 0) {
      setMessages(restored.messages as TutorMessage[]);
      return;
    }

    // 신규 세션 — 환영 메시지 생성
    const parts: string[] = [`세션 ${sessionId} 가 시작되었습니다.`];
    if (goal) parts.push(`목표: "${goal}"`);
    if (s?.subjects.length) {
      parts.push(
        `오늘의 과목: ${s.subjects.join(", ")}. 커리큘럼의 핵심 개념을 함께 짚어볼게요.`,
      );
    }
    if (s?.sources.length) {
      parts.push(
        `업로드하신 자료 ${s.sources.length}개를 바탕으로 질문을 던져드립니다.`,
      );
    }
    if (!s?.subjects.length && !s?.sources.length) {
      parts.push("학습하고 싶은 개념이나 디버깅이 필요한 코드를 공유해 주세요.");
    }
    setMessages([
      {
        id: "sys-1",
        role: "assistant",
        content: parts.join(" "),
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [sessionId, goal]);

  // 메시지 변경 시 자동 저장 (debounce 500ms) — "sys-1" 혼자인 초기 상태는 저장 안 함
  useEffect(() => {
    const meaningful =
      messages.length > 1 ||
      (messages.length === 1 && messages[0].id !== "sys-1");
    if (!meaningful) return;
    const t = window.setTimeout(() => {
      saveMessages(sessionId, messages);
    }, 500);
    return () => window.clearTimeout(t);
  }, [messages, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // 건너뛰기 모드 복원 + 저장
  useEffect(() => {
    try {
      const v = localStorage.getItem(DIRECT_KEY);
      if (v === "1") setDirectMode(true);
    } catch {
      /* ignore */
    }
  }, []);
  function toggleDirect() {
    setDirectMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DIRECT_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function send(opts?: { text?: string; revealMode?: "socratic" | "direct" }) {
    const text = (opts?.text ?? input).trim();
    if (!text || pending) return;
    // 명시적 opts 가 우선 — 없으면 directMode 토글 상태 사용
    const revealMode: "socratic" | "direct" =
      opts?.revealMode ?? (directMode ? "direct" : "socratic");

    const userMsg: TutorMessage = {
      id: randomId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantId = randomId();
    const assistantPlaceholder: TutorMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    const base = [...messages, userMsg];
    setMessages([...base, assistantPlaceholder]);
    setInput("");
    setPending(true);

    const contextLines = [`모드: ${mode}, 목표: ${goal}`];
    if (session) contextLines.push(buildContextBlock(session));

    try {
      const res = await fetch("/api/tutor/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withAiCredentials({
            level,
            context: contextLines.filter(Boolean).join("\n\n"),
            revealMode,
            messages: base
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        ),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";
      // setMessages 를 rAF 로 batch — 매 chunk 마다 리렌더하면 끊김처럼 보임
      let rafPending = false;
      let pendingContent = "";
      const flushContent = () => {
        rafPending = false;
        const content = pendingContent;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content } : m,
          ),
        );
      };
      const scheduleFlush = () => {
        if (rafPending) return;
        rafPending = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(flushContent);
        } else {
          setTimeout(flushContent, 16);
        }
      };

      const SPLIT = /\r?\n\r?\n/;
      const processEvent = (evt: string) => {
        const line = evt.trim();
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        let parsed: {
          delta?: string;
          done?: boolean;
          error?: string;
          expanded?: string;
          imageError?: string;
          videoCaptioned?: Array<{
            videoId: string;
            lineCount: number;
            lang: string;
          }>;
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          return; // malformed JSON chunk — skip only this one
        }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta !== undefined) {
          assembled += parsed.delta;
          pendingContent = assembled;
          scheduleFlush();
        }
        if (parsed.videoCaptioned && parsed.videoCaptioned.length > 0) {
          // AI 응답 맨 앞에 "📹 자막 N줄 자동 포함" 뱃지 삽입
          const badge = parsed.videoCaptioned
            .map(
              (v) =>
                `_📹 **${v.videoId}** 자막 ${v.lineCount}줄 자동 포함 (${v.lang})_`,
            )
            .join("  ");
          assembled = badge + "\n\n" + assembled;
          pendingContent = assembled;
          scheduleFlush();
        }
        if (parsed.expanded !== undefined) {
          // image-gen directive 가 실제 이미지로 치환된 최종 텍스트
          assembled = parsed.expanded;
          pendingContent = assembled;
          scheduleFlush();
        }
        if (parsed.imageError) {
          assembled =
            assembled + `\n\n> ⚠️ 이미지 생성 실패: ${parsed.imageError}`;
          pendingContent = assembled;
          scheduleFlush();
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // 스트림 종료 — decoder 와 buffer 플러시
          buffer += decoder.decode(); // final flush of multibyte
          if (buffer.trim()) {
            // 마지막에 남은 event (완전한 \n\n 못 받았어도)
            processEvent(buffer);
            buffer = "";
          }
          // 마지막 pending 내용을 즉시 반영 (rAF 전에 종료되는 것 방지)
          if (rafPending) {
            rafPending = false;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: pendingContent }
                  : m,
              ),
            );
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(SPLIT);
        buffer = events.pop() ?? "";
        for (const evt of events) processEvent(evt);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `⚠ 튜터가 응답하지 못했습니다.\n\n${message}\n\n[설정](/settings) 에서 공급자·모델·API 키를 확인해 주세요. 키가 없어도 데모 모드로 자동 폴백됩니다.`,
              }
            : m,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  function openEmptyCodeRunner() {
    setCodeTask({
      language: "javascript",
      code: "// 여기에 코드를 작성해 보세요.\n\n",
      seed: `manual-${Date.now()}`,
    });
  }

  function sendCodeResult(summary: string) {
    setInput(summary);
  }

  const gridClass = codeTask
    ? "grid gap-6 lg:grid-cols-[minmax(360px,1fr)_minmax(320px,420px)_240px]"
    : "grid gap-6 lg:grid-cols-[1fr_320px]";

  return (
    <div className={gridClass}>
      {/* Chat */}
      <section className="card flex h-[calc(100vh-10rem)] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">AI 튜터 세션</div>
            <div className="truncate text-xs text-muted">
              #{sessionId} · {mode} · {level}
            </div>
          </div>
          {!codeTask && (
            <button
              onClick={openEmptyCodeRunner}
              className="btn-ghost text-xs"
              title="코드 실습 패널 열기"
            >
              <Code2 className="h-3.5 w-3.5" />
              코드 실습
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                showContinue={isLast && m.role === "assistant" && !pending && m.content.length > 0 && m.id !== "sys-1"}
                onContinue={() =>
                  void send({
                    text: "방금 답변이 중간에 끊긴 것 같아. 바로 이어서 계속 적어줘. 반복 없이 자연스럽게 연결.",
                  })
                }
                onRedrawDiagram={() =>
                  void send({
                    text: "방금 다이어그램의 mermaid 코드에 문법 오류가 있어 렌더가 실패했어. 다이어그램 부분만 다시, 더 단순하게 그려줘 (한글 노드 라벨은 반드시 \"...\" 로 감싸고, 특수문자·따옴표 쓰지 말기, flowchart TD 또는 LR 사용). 전체 설명을 다시 쓰지 말고 다이어그램 블럭만 보내.",
                  })
                }
              />
            );
          })}
          {pending && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-bg-elevated/60 px-3 py-2 text-sm text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              튜터가 생각하는 중…
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted">
              {directMode ? (
                <>
                  <span className="text-amber-300">● 건너뛰기 ON</span> —
                  이후 모든 질문에 바로 답을 받습니다
                </>
              ) : (
                <>
                  소크라테스 모드 — 반문이 어려우면 오른쪽 토글로 바로 답
                </>
              )}
            </span>
            <button
              onClick={toggleDirect}
              disabled={pending}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                directMode
                  ? "border-amber-400/60 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15"
              }`}
              title={
                directMode
                  ? "건너뛰기 끄기 (소크라테스 반문으로 복귀)"
                  : "건너뛰기 켜기 — 이후 질문에 바로 답"
              }
              aria-pressed={directMode}
            >
              <SkipForward className="h-3 w-3" />
              건너뛰기 {directMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="질문을 입력하거나 코드를 붙여넣고 Enter로 전송 (Shift+Enter 줄바꿈)"
              className="input resize-none"
            />
            <button
              onClick={() => void send()}
              disabled={pending || !input.trim()}
              className="btn-primary h-10 shrink-0"
              aria-label="전송"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Code runner (조건부) */}
      {codeTask && (
        <TutorCodeRunner
          task={codeTask}
          onClose={() => setCodeTask(null)}
          onSubmitResult={sendCodeResult}
        />
      )}

      {/* Side panel */}
      <aside className="space-y-4">
        <HintPanel />
        <SubjectsPanel session={session} />
        <SourcesPanel session={session} />
        <ConceptPanel session={session} />
      </aside>
    </div>
  );
}

function SubjectsPanel({ session }: { session: LearningSession | null }) {
  const subjects = session?.subjects ?? [];
  if (!subjects.length) return null;
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <GraduationCap className="h-4 w-4 text-accent-500" />
        과목 ({subjects.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <span
            key={s}
            className="rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-0.5 text-xs text-white"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourcesPanel({ session }: { session: LearningSession | null }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-brand-500" />
        세션 자료 ({session?.sources.length ?? 0})
      </div>
      {!session?.sources.length ? (
        <div className="text-xs text-muted">
          업로드된 자료가 없습니다. /learn 에서 자료를 추가하면 튜터가 자동으로 반영합니다.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {session.sources.map((s) => (
            <li
              key={s.id}
              className="truncate rounded-lg border border-white/5 bg-bg-elevated/60 px-2 py-1 text-xs"
              title={s.name}
            >
              <span className="mr-1 text-muted">{s.kind.toUpperCase()}</span>
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  showContinue,
  onContinue,
  onRedrawDiagram,
}: {
  message: TutorMessage;
  showContinue?: boolean;
  onContinue?: () => void;
  onRedrawDiagram?: () => void;
}) {
  const isUser = message.role === "user";
  // 다이어그램·그림·이미지가 포함된 assistant 메시지는 좁은 사이드바에서 쪼그라들지 않게 너비 제약 완화
  const hasVisualBlock =
    !isUser &&
    (/```(mermaid|svg|plot|chart|tts|ipa|hanja)\s/.test(message.content) ||
      /!\[[^\]]*\]\((data:image\/|https?:\/\/)/.test(message.content));
  const widthClass = hasVisualBlock ? "max-w-full w-full" : "max-w-[85%]";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`${widthClass} whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-brand-500/90 text-white"
            : "border border-white/5 bg-bg-elevated/60 text-white"
        }`}
      >
        {isUser
          ? message.content
          : renderWithMermaid(message.content, { onDiagramRetry: onRedrawDiagram })}
      </div>
      {showContinue && onContinue && (
        <button
          onClick={onContinue}
          className="rounded-full border border-accent-500/40 bg-accent-500/5 px-2.5 py-0.5 text-[11px] text-accent-500 hover:bg-accent-500/15"
          title="답변이 끊긴 것 같다면 이어서 생성"
        >
          ▶ 이어서 쓰기
        </button>
      )}
    </div>
  );
}

function HintPanel() {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="h-4 w-4 text-accent-500" />
        단계별 힌트 모드
      </div>
      <p className="text-xs text-muted">
        튜터는 정답을 바로 알려주지 않고 "N번째 줄의 변수 타입을 확인해 보세요"처럼
        스스로 오류를 찾도록 유도합니다.
      </p>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-muted-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          Lv.1 — 범위 좁히기
        </div>
        <div className="flex items-center gap-2 text-muted-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500/70" />
          Lv.2 — 질문 던지기
        </div>
        <div className="flex items-center gap-2 text-muted-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500/40" />
          Lv.3 — 반례 제시
        </div>
      </div>
    </div>
  );
}

function ConceptPanel({ session }: { session: LearningSession | null }) {
  const [cards, setCards] = useState<
    Array<{ id: string; title: string; summary: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function extract() {
    if (!session) {
      setErr("세션 정보를 불러오지 못했습니다.");
      return;
    }
    if (!session.sources.length && !session.subjects.length) {
      setErr("자료나 과목 중 하나 이상이 있어야 추출할 수 있습니다.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const subjectLine = session.subjects.length
        ? `선택한 과목: ${session.subjects.join(", ")}\n이 과목들의 핵심 개념 ${
            session.sources.length ? "과 아래 자료" : ""
          }에서 중요한 개념을 뽑아 주세요.\n\n`
        : "";
      const sourceText = session.sources
        .map((s) => `${s.name}\n${s.preview}`)
        .join("\n\n");
      const text = subjectLine + sourceText;
      const res = await fetch("/api/concept-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withAiCredentials({ text, level: session.level, count: 4 }),
        ),
      });
      const data = (await res.json()) as {
        cards?: Array<{ id: string; title: string; summary: string }>;
        error?: string;
      };
      if (data.cards) setCards(data.cards);
      else setErr(data.error ?? "실패");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <BookOpen className="h-4 w-4 text-brand-500" />
        개념 카드
      </div>
      {cards.length === 0 ? (
        <div className="text-xs text-muted">
          선택한 과목이나 업로드 자료에서 핵심 개념을 자동 추출해 복습 노트로 쌓습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/5 bg-bg-elevated/60 p-3"
            >
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-1 text-xs text-muted">{c.summary}</div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={extract}
        disabled={loading}
        className="btn-ghost mt-3 w-full"
      >
        <Code2 className="h-4 w-4" />
        {loading ? "추출 중…" : cards.length ? "다시 추출" : "자료에서 개념 추출"}
      </button>
      {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
    </div>
  );
}
