"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

const GROUPS: { title: string; items: { keys: string; desc: string }[] }[] = [
  {
    title: "글로벌",
    items: [
      { keys: "?", desc: "이 단축키 가이드 열기/닫기" },
      { keys: "Esc", desc: "열린 모달·패널 닫기" },
    ],
  },
  {
    title: "협업 룸",
    items: [
      { keys: "@", desc: "채팅창에서 참여자 멘션 자동완성" },
      { keys: "Ctrl/⌘ + Enter", desc: "AI 튜터 질문 전송" },
      { keys: "↑ / ↓", desc: "멘션 드롭다운 네비게이션" },
      { keys: "Enter / Tab", desc: "멘션 선택" },
    ],
  },
  {
    title: "AI 튜터",
    items: [
      { keys: "Enter", desc: "메시지 전송" },
      { keys: "Shift + Enter", desc: "줄바꿈" },
      {
        keys: "건너뛰기 ON/OFF",
        desc: "입력창 위 토글 — ON 이면 이후 모든 질문에 반문 없이 바로 답",
      },
    ],
  },
  {
    title: "Monaco 에디터",
    items: [
      { keys: "Ctrl/⌘ + F", desc: "코드 안에서 찾기" },
      { keys: "Ctrl/⌘ + /", desc: "주석 토글" },
      { keys: "Alt + ↑/↓", desc: "줄 이동" },
    ],
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 입력 필드에서는 트리거 안 함
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        t?.isContentEditable;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="card w-full max-w-lg space-y-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="h-4 w-4 text-brand-500" />
            키보드 단축키
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="rounded p-1 text-muted hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="label mb-2">{g.title}</div>
              <ul className="space-y-1 text-xs">
                {g.items.map((it) => (
                  <li
                    key={it.keys}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-muted-strong">{it.desc}</span>
                    <kbd className="rounded border border-white/10 bg-bg-elevated/60 px-1.5 py-0.5 font-mono text-[10px]">
                      {it.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted">
          <kbd className="rounded border border-white/10 px-1 py-0.5">?</kbd>{" "}
          로 언제든 다시 열 수 있어요.
        </div>
      </div>
    </div>
  );
}
