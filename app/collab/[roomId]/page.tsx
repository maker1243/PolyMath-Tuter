"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Users,
  Send,
  Zap,
  Pencil,
  Wifi,
  WifiOff,
  GitBranch,
  Save,
  Play,
  Terminal,
  AlertTriangle,
  Paperclip,
  Download,
  History,
  FileText,
  Bell,
  BellOff,
  Sparkles,
  Bot,
  Crown,
  UserX,
  Trash2,
  Settings,
  ThumbsUp,
  ThumbsDown,
  QrCode,
  Copy,
  Check,
  Share2,
  Search,
  RefreshCw,
  RotateCcw,
  X as XIcon,
} from "lucide-react";
import * as Y from "yjs";
import {
  getIdentity,
  hexOf,
  identityFromUser,
  initial,
  setIdentity,
  type CollabIdentity,
} from "@/lib/collab-identity";
import { useCurrentUser } from "@/lib/use-current-user";
import { recordVisit } from "@/lib/use-favorites";
import { renderWithMermaid } from "@/components/MermaidChart";
import type {
  ChatMessage,
  CodeState,
  CollabEvent,
  CursorPos,
  Mission,
  Participant,
  RunResult,
  SharedFile,
  TypingState,
} from "@/lib/collab-store";
import type { editor as MonacoNs } from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

type ConnState = "connecting" | "live" | "offline";

function uint8ToBase64(arr: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode.apply(
      null,
      Array.from(arr.subarray(i, i + chunk)) as number[],
    );
  }
  return btoa(s);
}

function base64ToUint8(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

function isMentionOf(text: string, name: string): boolean {
  if (!name) return false;
  // @이름 또는 @이름의 앞부분(-prefix 제거) 둘 다 매칭
  const base = name.replace(/-\w+$/, "");
  const needles = [name, base].filter((s) => s.length >= 2);
  for (const n of needles) {
    const re = new RegExp("@" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(text)) return true;
  }
  return false;
}

// Lazy-shared AudioContext
let _ac: AudioContext | null = null;
function beep(hz: number, ms = 120) {
  if (typeof window === "undefined") return;
  try {
    _ac =
      _ac ??
      new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    const ctx = _ac;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    g.gain.value = 0.08;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + ms / 1000,
    );
    osc.stop(ctx.currentTime + ms / 1000 + 0.02);
  } catch {
    /* audio blocked */
  }
}

export default function CollabRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [identity, setIdent] = useState<CollabIdentity | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conn, setConn] = useState<ConnState>("connecting");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [codeMeta, setCodeMeta] = useState<CodeState | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [typings, setTypings] = useState<TypingState[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [joinedAt] = useState<number>(() => Date.now());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  // 알림(10번)
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(false);
  const [unseen, setUnseen] = useState<number>(0);
  const notifyRef = useRef<boolean>(false);
  notifyRef.current = notifyEnabled;
  const originalTitleRef = useRef<string>("");
  // 호스트·방 관리 (6번)
  const [hostPid, setHostPid] = useState<string>("");
  const [roomName, setRoomName] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [deleted, setDeleted] = useState(false);
  // AI 튜터 (2번)
  const [showAiAsk, setShowAiAsk] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAsking, setAiAsking] = useState(false);
  const [aiDirect, setAiDirect] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  // 멘션 자동완성 (3)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const chatInputRef = useRef<HTMLInputElement>(null);
  // QR 공유 (8)
  const [showShare, setShowShare] = useState(false);
  // 호스트 지갑 상태 (키는 서버에만)
  const [wallet, setWallet] = useState<
    { enabled: true; provider: string; ownerName: string } | { enabled: false }
  >({ enabled: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const runScrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const hbRef = useRef<number | null>(null);
  const editorRef = useRef<MonacoNs.IStandaloneCodeEditor | null>(null);
  const cursorDebounceRef = useRef<number | null>(null);
  const chatTypingDebounceRef = useRef<number | null>(null);
  const codeTypingDebounceRef = useRef<number | null>(null);
  const codeTypingStopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Yjs refs — 컴포넌트 lifetime 유지
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const bindingRef = useRef<{ destroy: () => void } | null>(null);
  // 서버에서 받은 echo 를 중복 전파하지 않기 위한 flag
  const applyingRemoteRef = useRef(false);
  // pid -> ContentWidget
  const cursorWidgetsRef = useRef<Map<string, MonacoNs.IContentWidget>>(
    new Map(),
  );
  const identityRef = useRef<CollabIdentity | null>(null);
  identityRef.current = identity;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // Y.Doc 를 컴포넌트 라이프타임 1회 생성 + update 리스너도 같이 등록
  // (별도 useEffect 로 분리하면 StrictMode·HMR 에서 리스너가 doc 과 분리될 수 있음)
  if (ydocRef.current === null) {
    const doc = new Y.Doc();
    ydocRef.current = doc;
    ytextRef.current = doc.getText("code");
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // 서버 echo 는 POST 안 함
      const id = identityRef.current;
      const rid = roomIdRef.current;
      if (!id || !rid) return;
      const b64 = uint8ToBase64(update);
      fetch(`/api/collab/${rid}/y/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: id.id, update: b64 }),
      }).catch(() => {
        /* 네트워크 실패 — 다음 update 가 보완 */
      });
    };
    doc.on("update", onUpdate);
  }

  const { user: currentUser, loading: userLoading } = useCurrentUser();

  // 방 입장 → 최근 방문 기록 (localStorage)
  useEffect(() => {
    if (roomId) recordVisit(roomId);
  }, [roomId]);

  // 1) 아이덴티티 로드 — 로그인 사용자면 user 기반, 아니면 익명 (sessionStorage)
  useEffect(() => {
    if (userLoading) return;
    if (currentUser) {
      const id = identityFromUser(currentUser);
      setIdentity(id);
      setIdent(id);
    } else {
      setIdent(getIdentity());
    }
    if (typeof window !== "undefined") {
      originalTitleRef.current = document.title;
      try {
        const v = window.localStorage.getItem("polymath:collab:notify");
        if (v === "1") setNotifyEnabled(true);
      } catch {
        /* ignore */
      }
    }
  }, [currentUser, userLoading]);

  // 창 포커스 시 미읽음 카운트 초기화
  useEffect(() => {
    function onVis() {
      if (!document.hidden) {
        setUnseen(0);
        document.title = originalTitleRef.current || "PolyMath Tutor";
      }
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  // unseen 변경 시 title 반영
  useEffect(() => {
    const base = originalTitleRef.current || "PolyMath Tutor";
    document.title = unseen > 0 ? `(${unseen}) ${base}` : base;
  }, [unseen]);

  function toggleNotify() {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    try {
      window.localStorage.setItem("polymath:collab:notify", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next && typeof Notification !== "undefined") {
      if (
        Notification.permission === "default" ||
        Notification.permission === "denied"
      ) {
        void Notification.requestPermission();
      }
    }
  }

  function notifyNew(ev: {
    kind: "message" | "mention" | "join";
    title: string;
  }) {
    // 창이 보이고 있고 멘션 아님 → 조용히 unseen 안 올림
    const hidden = typeof document !== "undefined" && document.hidden;
    if (hidden || ev.kind === "mention") {
      setUnseen((n) => n + 1);
    }
    if (!notifyRef.current) return;
    // 소리
    beep(ev.kind === "mention" ? 880 : ev.kind === "join" ? 520 : 660);
    // 데스크톱 알림 (권한 있고 창이 숨겨졌을 때만)
    if (
      hidden &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(ev.title, {
          tag: "polymath-collab",
          silent: false,
        });
      } catch {
        /* ignore */
      }
    }
  }

  // 컴포넌트 unmount 시 binding 만 정리.
  // Y.Doc 는 destroy 하지 않음 — StrictMode 가 render 를 재실행하지 않을 수 있어
  // doc 를 destroy 하면 리스너·바인딩이 참조하는 doc 와 Monaco 가 참조하는 doc 가
  // 어긋나 "코드 수정이 전파되지 않음" 상태가 됨. 페이지 전체가 사라지면 GC 가 수거.
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, []);

  // 3) SSE 연결 — identity 가 준비되면 접속
  useEffect(() => {
    if (!identity || !roomId) return;

    const qs = new URLSearchParams({
      pid: identity.id,
      name: identity.name,
      color: identity.color,
    });
    const es = new EventSource(`/api/collab/${roomId}/stream?${qs}`);
    esRef.current = es;
    setConn("connecting");

    es.onopen = () => setConn("live");
    es.onerror = () => setConn("offline");
    es.onmessage = (ev) => {
      let data: CollabEvent | { type: "ready"; pid: string };
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === "ready") {
        setConn("live");
        return;
      }
      if (data.type === "snapshot") {
        setParticipants(data.participants);
        setMessages(data.messages);
        setRuns(data.runs ?? []);
        setFiles(data.files ?? []);
        setTypings((data.typings ?? []).filter((t) => t.pid !== identity.id));
        setStartedAt(data.startedAt ?? null);
        setMission(data.mission ?? null);
        setHostPid(data.hostPid ?? "");
        setRoomName(data.name ?? null);
        setWallet(data.hostWallet ?? { enabled: false });
        setCodeMeta(data.code);
        if (data.yState && ydocRef.current) {
          applyingRemoteRef.current = true;
          try {
            Y.applyUpdate(
              ydocRef.current,
              base64ToUint8(data.yState),
              "remote",
            );
          } finally {
            queueMicrotask(() => (applyingRemoteRef.current = false));
          }
        }
        for (const c of data.cursors) {
          if (c.pid !== identity.id) upsertRemoteCursor(c);
        }
      } else if (data.type === "y_update") {
        // 서버가 보낸 모든 update 를 받되, 자기 자신이 origin 인 echo 는
        // 이미 로컬에 반영되었으므로 applyUpdate 가 no-op 이 되어 안전함.
        // 그러나 'remote' origin 으로 적용해 로컬 핸들러가 다시 POST 하지 않게 함.
        if (ydocRef.current) {
          applyingRemoteRef.current = true;
          try {
            Y.applyUpdate(
              ydocRef.current,
              base64ToUint8(data.update),
              "remote",
            );
          } finally {
            queueMicrotask(() => (applyingRemoteRef.current = false));
          }
        }
      } else if (data.type === "code") {
        setCodeMeta(data.code);
      } else if (data.type === "cursor") {
        if (data.cursor.pid !== identity.id) upsertRemoteCursor(data.cursor);
      } else if (data.type === "run") {
        // 자기 자신 Run 은 로컬 echo 로 이미 추가됨 — SSE echo 는 skip
        if (data.run.pid === identity.id) return;
        setRuns((prev) => [...prev, data.run].slice(-20));
      } else if (data.type === "typing") {
        if (data.typing.pid === identity.id) return; // 자기 자신 skip
        setTypings((prev) => {
          const without = prev.filter(
            (t) => !(t.pid === data.typing.pid && t.kind === data.typing.kind),
          );
          return [...without, data.typing];
        });
      } else if (data.type === "typing_cleared") {
        setTypings((prev) =>
          prev.filter((t) => !(t.pid === data.pid && t.kind === data.kind)),
        );
      } else if (data.type === "file_added") {
        setFiles((prev) => {
          if (prev.some((f) => f.id === data.file.id)) return prev;
          return [...prev, data.file].slice(-50);
        });
      } else if (data.type === "file_removed") {
        setFiles((prev) => prev.filter((f) => f.id !== data.fileId));
      } else if (data.type === "participant_joined") {
        setParticipants((prev) => {
          const without = prev.filter((p) => p.id !== data.participant.id);
          return [...without, data.participant].sort(
            (a, b) => a.joinedAt - b.joinedAt,
          );
        });
        if (data.participant.id !== identity.id) {
          notifyNew({
            kind: "join",
            title: `${data.participant.name} 님이 입장`,
          });
        }
      } else if (data.type === "participant_left") {
        setParticipants((prev) => prev.filter((p) => p.id !== data.pid));
        removeRemoteCursor(data.pid);
      } else if (data.type === "message_updated") {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.message.id ? data.message : m)),
        );
      } else if (data.type === "message") {
        setMessages((prev) => [...prev, data.message].slice(-200));
        if (data.message.pid !== identity.id) {
          const mentioned = isMentionOf(data.message.text, identity.name);
          notifyNew({
            kind: mentioned ? "mention" : "message",
            title: mentioned
              ? `${data.message.name} 님이 당신을 언급`
              : `${data.message.name}: ${data.message.text.slice(0, 60)}`,
          });
        }
      } else if (data.type === "mission") {
        setMission(data.mission);
      } else if (data.type === "host_changed") {
        setHostPid(data.hostPid);
      } else if (data.type === "room_renamed") {
        setRoomName(data.name);
      } else if (data.type === "kicked") {
        if (data.pid === identity.id) {
          setKicked(true);
          esRef.current?.close();
        }
      } else if (data.type === "room_deleted") {
        setDeleted(true);
        esRef.current?.close();
      } else if (data.type === "wallet_changed") {
        setWallet(data.wallet);
      }
    };

    hbRef.current = window.setInterval(() => {
      void fetch(`/api/collab/${roomId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: identity.id }),
      }).catch(() => {});
    }, 10_000);

    return () => {
      es.close();
      esRef.current = null;
      if (hbRef.current !== null) window.clearInterval(hbRef.current);
      hbRef.current = null;
    };
  }, [identity, roomId]);

  // 메시지/실행 로그/파일 변경 시 하단 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, files]);
  useEffect(() => {
    runScrollRef.current?.scrollTo({ top: runScrollRef.current.scrollHeight });
  }, [runs]);
  // typing TTL — 4.5초 지난 항목 자동 제거 (서버 cleared 이벤트 유실 대비)
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      setTypings((prev) => prev.filter((x) => now - x.at < 4500));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  function acceptMention(name: string) {
    const el = chatInputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? input.length;
    const before = input.slice(0, caret);
    const after = input.slice(caret);
    const m = before.match(/@(\S*)$/);
    if (!m) return;
    const insertAt = caret - m[0].length;
    // 이름에서 "-xxxx" 접미사는 제거해 짧게
    const short = name.replace(/-\w+$/, "");
    const next = input.slice(0, insertAt) + "@" + short + " " + after;
    setInput(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const nc = insertAt + short.length + 2;
      el.focus();
      el.setSelectionRange(nc, nc);
    });
  }

  function postCursor(line: number, col: number) {
    const id = identityRef.current;
    if (!id) return;
    if (cursorDebounceRef.current !== null)
      window.clearTimeout(cursorDebounceRef.current);
    cursorDebounceRef.current = window.setTimeout(() => {
      fetch(`/api/collab/${roomId}/cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: id.id,
          name: id.name,
          color: id.color,
          line,
          col,
        }),
      }).catch(() => {});
    }, 80);
  }

  function postTyping(kind: "chat" | "code") {
    const id = identityRef.current;
    const rid = roomIdRef.current;
    if (!id || !rid) return;
    fetch(`/api/collab/${rid}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pid: id.id,
        name: id.name,
        color: id.color,
        kind,
      }),
    }).catch(() => {});
  }

  function notifyChatTyping() {
    // 1.5초마다 한 번만 서버에 알림 (debounce)
    if (chatTypingDebounceRef.current !== null) return;
    postTyping("chat");
    chatTypingDebounceRef.current = window.setTimeout(() => {
      chatTypingDebounceRef.current = null;
    }, 1500);
  }

  function notifyCodeTyping() {
    if (codeTypingDebounceRef.current === null) {
      postTyping("code");
      codeTypingDebounceRef.current = window.setTimeout(() => {
        codeTypingDebounceRef.current = null;
      }, 1500);
    }
    // 2.5초 멈추면 상태가 자연 소멸하도록 추가 트리거 없음
    if (codeTypingStopRef.current !== null)
      window.clearTimeout(codeTypingStopRef.current);
    codeTypingStopRef.current = window.setTimeout(() => {
      codeTypingStopRef.current = null;
    }, 2500);
  }

  async function askAi(overrideQuestion?: string, overrideDirect?: boolean) {
    const id = identityRef.current;
    const q = (overrideQuestion ?? aiQuestion).trim();
    if (!id || !q || aiAsking) return;
    setAiAsking(true);
    try {
      // 코드 selection 가져오기 (옵셔널)
      let selection: string | undefined;
      const ed = editorRef.current;
      if (ed) {
        const sel = ed.getSelection();
        const model = ed.getModel();
        if (sel && model && !sel.isEmpty()) {
          selection = model.getValueInRange(sel);
        }
      }
      // AI settings 를 request body 에 자동 주입
      const settingsRaw = window.localStorage.getItem("polymath:ai-settings");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : null;
      const provider = settings?.provider ?? "claude";
      const apiKey = settings?.keys?.[provider];
      const model = settings?.models?.[provider];
      const geminiAuth = settings?.geminiAuth;
      const img = settings?.image;
      const imageEnabled = Boolean(img?.enabled);
      const imageProvider = img?.provider;
      const imageKey = img?.keys?.[img?.provider];

      const res = await fetch(`/api/collab/${roomId}/ai-ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          selection,
          provider,
          apiKey,
          model,
          geminiAuth,
          revealMode: (overrideDirect ?? aiDirect) ? "direct" : "socratic",
          imageEnabled,
          imageProvider,
          imageKey,
        }),
      });
      if (res.ok) {
        if (!overrideQuestion) setAiQuestion("");
        setShowAiAsk(false);
      }
    } catch {
      /* AI 호출 실패 — 서버는 데모 응답으로 폴백함 */
    } finally {
      setAiAsking(false);
    }
  }

  /** 공유 코드 흐름을 mermaid 다이어그램으로 요약 요청 (direct 모드). */
  async function askAiDiagramThisCode() {
    const prompt =
      "아래 공유 코드의 **전체 흐름**(제어 흐름·주요 함수 호출·조건 분기) 을 " +
      "mermaid flowchart 다이어그램 **1개** 로 요약해 주세요. " +
      "노드 라벨은 한국어, 식별자는 원어. " +
      "짧은 설명 2~3문장 + mermaid 블럭 (그 외 코드는 넣지 마세요).";
    await askAi(prompt, true);
  }

  async function hostAction(
    action: "kick" | "rename" | "delete",
    extra?: { targetPid?: string; name?: string | null },
  ) {
    const id = identityRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/collab/${roomId}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ byPid: id.id, action, ...extra }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function uploadFile(file: File) {
    const id = identityRef.current;
    if (!id || uploading) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("파일이 5MB를 초과합니다");
      window.setTimeout(() => setUploadError(null), 3000);
      return;
    }
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.set("pid", id.id);
    form.set("file", file);
    try {
      const res = await fetch(`/api/collab/${roomId}/file`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "업로드 실패" }));
        setUploadError(err.error ?? "업로드 실패");
        window.setTimeout(() => setUploadError(null), 3000);
      } else {
        const data = (await res.json()) as { ok: true; file: SharedFile };
        // 로컬 즉시 반영 (SSE broadcast 가 지연·누락돼도 자기 UI 는 갱신)
        setFiles((prev) => {
          if (prev.some((f) => f.id === data.file.id)) return prev;
          return [...prev, data.file].slice(-50);
        });
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 실패");
      window.setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function upsertRemoteCursor(c: CursorPos) {
    const editor = editorRef.current;
    if (!editor) return;
    const existing = cursorWidgetsRef.current.get(c.pid);
    if (existing) {
      const node = existing.getDomNode();
      const label = node.querySelector(".polymath-cursor-label");
      if (label && label.textContent !== c.name) label.textContent = c.name;
      (existing as unknown as { _pos: { lineNumber: number; column: number } })._pos = {
        lineNumber: c.line,
        column: c.col,
      };
      editor.layoutContentWidget(existing);
      return;
    }
    const widget = buildCursorWidget(c);
    cursorWidgetsRef.current.set(c.pid, widget);
    editor.addContentWidget(widget);
    requestAnimationFrame(() => {
      try {
        editor.layoutContentWidget(widget);
      } catch {
        /* editor gone */
      }
    });
  }

  function removeRemoteCursor(pid: string) {
    const editor = editorRef.current;
    const w = cursorWidgetsRef.current.get(pid);
    if (editor && w) editor.removeContentWidget(w);
    cursorWidgetsRef.current.delete(pid);
  }

  async function send() {
    if (!identity) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await fetch(`/api/collab/${roomId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: identity.id,
          name: identity.name,
          color: identity.color,
          text,
        }),
      });
    } catch {
      setInput(text);
    }
  }

  async function deleteMsg(messageId: string) {
    const id = identityRef.current;
    if (!id) return;
    if (!confirm("이 메시지를 삭제할까요?")) return;
    try {
      await fetch(`/api/collab/${roomId}/message`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, pid: id.id }),
      });
    } catch {
      /* ignore */
    }
  }

  async function regenerateAi(lastQuestion: string) {
    setAiQuestion(lastQuestion);
    setShowAiAsk(true);
  }

  async function resetCode() {
    const id = identityRef.current;
    if (!id) return;
    if (!confirm("코드를 초기 상태로 되돌릴까요? 되돌릴 수 없습니다.")) return;
    try {
      await fetch(`/api/collab/${roomId}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-code", byPid: id.id }),
      });
    } catch {
      /* ignore */
    }
  }

  async function reactToAi(
    messageId: string,
    rating: "up" | "down" | "clear",
    extras?: { reason?: string; category?: string },
  ) {
    const id = identityRef.current;
    if (!id) return;
    try {
      await fetch(`/api/collab/${roomId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          pid: id.id,
          rating,
          reason: extras?.reason,
          category: extras?.category,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  async function runCode() {
    const id = identityRef.current;
    const editor = editorRef.current;
    if (!id || !editor || running) return;
    const code = editor.getValue();
    const lang = mission?.language === "python" ? "python" : "javascript";
    setRunning(true);
    const result =
      lang === "python"
        ? await runPythonLocal(code, 15000)
        : await runJsInWorker(code, 5000);
    setRunning(false);
    // 로컬 즉시 반영 — 서버 broadcast 가 지연·실패해도 자기 UI 는 갱신
    const localRun: RunResult = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pid: id.id,
      name: id.name,
      color: id.color,
      language: lang,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      at: Date.now(),
    };
    setRuns((prev) => [...prev, localRun].slice(-20));
    try {
      await fetch(`/api/collab/${roomId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: id.id,
          name: id.name,
          color: id.color,
          language: lang,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
        }),
      });
    } catch {
      /* 서버 전파 실패 — 로컬 echo 만 */
    }
  }

  function saveName() {
    if (!identity) return;
    const nextName = draftName.trim().slice(0, 24);
    if (!nextName || nextName === identity.name) {
      setEditingName(false);
      return;
    }
    const next = { ...identity, name: nextName };
    setIdentity(next);
    setIdent(next);
    setEditingName(false);
  }

  const me = identity;
  const myColor = me?.color ?? "bg-brand-500";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted">협업 룸 #{roomId}</div>
          <h1 className="text-2xl font-semibold">
            {roomName ?? "실시간 공통 미션"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleNotify}
            className={`chip ${notifyEnabled ? "text-accent-500" : ""}`}
            title={
              notifyEnabled
                ? "알림 켜짐 (끄려면 클릭)"
                : "알림 꺼짐 (켜려면 클릭)"
            }
          >
            {notifyEnabled ? (
              <Bell className="h-3 w-3" />
            ) : (
              <BellOff className="h-3 w-3" />
            )}
            {unseen > 0 ? `알림 ${unseen}` : notifyEnabled ? "알림 켜짐" : "알림"}
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="chip hover:text-white"
            title="방 공유 (QR·URL)"
          >
            <Share2 className="h-3 w-3" />
            공유
          </button>
          <ConnBadge state={conn} />
          <div className="chip">
            <Users className="h-3 w-3" />
            {participants.length}명 참여
          </div>
          <div className="flex -space-x-2">
            {participants.slice(0, 6).map((p) => {
              const online = Date.now() - p.lastSeen < 20_000;
              return (
                <div
                  key={p.id}
                  title={
                    p.name +
                    (me?.id === p.id ? " (나)" : "") +
                    (p.id === hostPid ? " · 호스트" : "") +
                    (online ? " · 공부 중" : " · 자리비움")
                  }
                  className={`relative grid h-7 w-7 place-items-center rounded-full border-2 border-bg text-[11px] font-semibold text-white ${p.color} ${
                    me?.id === p.id ? "ring-2 ring-white/40" : ""
                  }`}
                >
                  {initial(p.name)}
                  {p.id === hostPid && (
                    <Crown className="absolute -right-1 -top-1 h-3 w-3 text-amber-300 drop-shadow" />
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-bg ${
                      online ? "bg-accent-500" : "bg-muted"
                    }`}
                    aria-hidden
                  />
                </div>
              );
            })}
            {participants.length > 6 && (
              <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-bg-elevated text-[10px] text-muted-strong">
                +{participants.length - 6}
              </div>
            )}
          </div>
          {me?.id === hostPid && (
            <button
              onClick={() => setShowAdmin(true)}
              className="chip text-amber-300"
              title="방 관리 (호스트 전용)"
            >
              <Settings className="h-3 w-3" />
              관리
            </button>
          )}
        </div>
      </header>

      {kicked && (
        <Overlay
          title="방에서 내보내졌습니다"
          body="호스트가 당신을 이 방에서 내보냈습니다."
          roomId={roomId}
        />
      )}
      {deleted && (
        <Overlay
          title="방이 삭제되었습니다"
          body="호스트가 이 방을 삭제했습니다. 새 방을 열거나 다른 방에 합류하세요."
          roomId={roomId}
        />
      )}
      {showShare && (
        <ShareModal roomId={roomId} onClose={() => setShowShare(false)} />
      )}
      {showAdmin && me?.id === hostPid && (
        <AdminModal
          currentName={roomName}
          participants={participants}
          hostPid={hostPid}
          wallet={wallet}
          onClose={() => setShowAdmin(false)}
          onRename={async (name) => {
            await hostAction("rename", { name });
          }}
          onKick={async (targetPid) => {
            await hostAction("kick", { targetPid });
          }}
          onDelete={async () => {
            const ok = await hostAction("delete");
            if (ok) setShowAdmin(false);
          }}
          onResetCode={async () => {
            await resetCode();
            setShowAdmin(false);
          }}
          onOpenWallet={async () => {
            const myPid = identityRef.current?.id ?? "";
            try {
              const raw = window.localStorage.getItem("polymath:ai-settings");
              const s = raw ? JSON.parse(raw) : null;
              const provider = s?.provider;
              const apiKey = s?.keys?.[provider];
              if (!provider || !apiKey) {
                alert(
                  "설정에서 AI 공급자 키를 먼저 저장하세요. 그 키가 방 공용 지갑으로 등록됩니다.",
                );
                return false;
              }
              const r = await fetch(`/api/collab/${roomId}/host`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "wallet-open",
                  byPid: myPid,
                  provider,
                  apiKey,
                  model: s.models?.[provider],
                  geminiAuth: s.geminiAuth,
                }),
              });
              return r.ok;
            } catch {
              return false;
            }
          }}
          onCloseWallet={async () => {
            const myPid = identityRef.current?.id ?? "";
            try {
              const r = await fetch(`/api/collab/${roomId}/host`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "wallet-close", byPid: myPid }),
              });
              return r.ok;
            } catch {
              return false;
            }
          }}
        />
      )}

      {me && (
        <div className="card flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <div
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white ${myColor}`}
            >
              {initial(me.name)}
            </div>
            {editingName ? (
              <>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  autoFocus
                  className="input py-1 text-xs"
                />
                <button onClick={saveName} className="btn-primary py-1 text-xs">
                  저장
                </button>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <span className="font-semibold">{me.name}</span>
                  <span className="ml-1 text-xs text-muted">(나)</span>
                </div>
                <button
                  onClick={() => {
                    setDraftName(me.name);
                    setEditingName(true);
                  }}
                  className="rounded p-1 text-muted hover:bg-white/5 hover:text-white"
                  aria-label="이름 변경"
                  title="이름 변경"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted">
            아이디 {me.id.slice(0, 8)}… · 다른 탭·창을 열면 새 참여자로 접속됩니다
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>공유 에디터 — shared.js</span>
              <CodeTypingIndicator typings={typings} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runCode}
                disabled={running || conn !== "live"}
                className="btn-primary flex items-center gap-1.5 py-1 text-xs"
                aria-label="실행"
              >
                <Play className="h-3 w-3" />
                {running
                  ? "실행 중…"
                  : `실행 (${mission?.language === "python" ? "Py" : "JS"})`}
              </button>
              <div className="chip">
                <Zap className="h-3 w-3 text-accent-500" />
                CRDT 동기화
              </div>
            </div>
          </div>
          <div className="h-[460px]">
            <MonacoEditor
              defaultValue=""
              onMount={(ed) => {
                editorRef.current = ed;
                const doc = ydocRef.current;
                const ytext = ytextRef.current;
                const model = ed.getModel();
                if (doc && ytext && model) {
                  // y-monaco 는 ESM + window 사용 → onMount(클라이언트) 에서 dynamic import
                  import("y-monaco")
                    .then(({ MonacoBinding }) => {
                      if (!editorRef.current) return; // unmount race
                      bindingRef.current = new MonacoBinding(
                        ytext,
                        model,
                        new Set([ed]),
                        null,
                      );
                    })
                    .catch((err) => {
                      console.error("[polymath] y-monaco load failed:", err);
                    });
                }
                ed.onDidChangeCursorPosition((e) => {
                  postCursor(e.position.lineNumber, e.position.column);
                });
                // 코드 변경 시 "코드 수정 중" presence 전송
                ed.onDidChangeModelContent(() => {
                  notifyCodeTyping();
                });
                // Debug 핸들: 테스트/디버그 콘솔에서 모델·Y.Doc 접근
                (window as unknown as { __polymath?: unknown }).__polymath = {
                  editor: ed,
                  model,
                  ydoc: doc,
                  ytext,
                };
              }}
              language={mission?.language === "python" ? "python" : "javascript"}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
          <RunInlineOverlay runs={runs} meId={me?.id} />
          <div className="flex items-center justify-between border-t border-white/5 bg-bg-elevated/40 px-4 py-1.5 text-[11px] text-muted">
            <SyncStatus meta={codeMeta} meId={me?.id} />
            <span className="text-muted">
              Yjs CRDT · 자동 저장 · 서버 재시작 안전
            </span>
          </div>
        </section>

        <aside className="card flex h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs">
            <span className="text-muted">실시간 채팅 · 파일 공유</span>
            <span className="text-muted">
              메시지 {messages.length} · 파일 {files.length}
            </span>
          </div>
          <div className="relative border-b border-white/5 bg-bg-elevated/30 p-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
            <input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="메시지 검색…"
              className="input pl-7 text-xs"
            />
            {chatSearch && (
              <button
                onClick={() => setChatSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                aria-label="검색 지우기"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-3">
            <HistoryBadge
              startedAt={startedAt}
              joinedAt={joinedAt}
              messageCount={messages.length}
            />
            <Timeline
              messages={messages}
              files={files}
              roomId={roomId}
              meId={me?.id}
              meName={me?.name}
              onReact={reactToAi}
              onDelete={deleteMsg}
              onRegenerate={regenerateAi}
              onRedrawDiagram={() =>
                void askAi(
                  "방금 다이어그램의 mermaid 코드에 문법 오류가 있어 렌더가 실패했어. 다이어그램 부분만 다시, 더 단순하게 그려줘 (한글 노드 라벨은 반드시 \"...\" 로 감싸고, 특수문자·따옴표 쓰지 말기, flowchart TD 또는 LR 사용). 전체 설명을 다시 쓰지 말고 다이어그램 블럭만 보내.",
                  true,
                )
              }
              searchQuery={chatSearch}
            />
          </div>
          {/* AI 튜터 호출 패널 */}
          {showAiAsk ? (
            <div className="space-y-2 border-t border-white/5 bg-accent-500/5 p-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-accent-500">
                <span className="inline-flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  AI 튜터에게 질문 (공유 코드·선택 영역 자동 포함)
                </span>
                <WalletHint wallet={wallet} />
              </div>
              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) askAi();
                  if (e.key === "Escape") setShowAiAsk(false);
                }}
                placeholder="예: fib 가 왜 느릴까요? 어떻게 개선할 수 있는지 힌트만 주세요"
                rows={2}
                className="input w-full resize-none text-sm"
                autoFocus
              />
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={askAiDiagramThisCode}
                  disabled={aiAsking}
                  className="rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-accent-200 hover:bg-accent-500/20 disabled:opacity-50"
                  title="공유 코드의 제어 흐름을 mermaid 다이어그램으로 요약"
                >
                  📊 코드 흐름 그려줘
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
                <label className="inline-flex cursor-pointer items-center gap-1 text-amber-200">
                  <input
                    type="checkbox"
                    checked={aiDirect}
                    onChange={(e) => setAiDirect(e.target.checked)}
                    className="h-3 w-3 accent-amber-400"
                  />
                  건너뛰기 — 힌트 없이 바로 답
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAiAsk(false)}
                    className="btn-ghost py-1 text-xs"
                    disabled={aiAsking}
                  >
                    취소
                  </button>
                  <button
                    onClick={() => askAi()}
                    disabled={aiAsking || !aiQuestion.trim()}
                    className="btn-primary py-1 text-xs"
                  >
                    {aiAsking
                      ? "AI 답변 중…"
                      : aiDirect
                        ? "바로 답 받기"
                        : "AI 에 질문"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {/* typing indicator (chat) */}
          <ChatTypingIndicator typings={typings} />
          {uploadError && (
            <div className="border-t border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-200">
              {uploadError}
            </div>
          )}
          <div className="border-t border-white/5 p-2">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={conn !== "live" || !me || uploading}
                className="rounded-xl border border-white/5 bg-bg-elevated/60 px-2 text-muted hover:text-white disabled:opacity-50"
                aria-label="파일 첨부"
                title="파일 첨부 (최대 5MB)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowAiAsk((v) => !v)}
                disabled={conn !== "live" || !me}
                className={`rounded-xl border px-2 disabled:opacity-50 ${
                  showAiAsk
                    ? "border-accent-500/40 bg-accent-500/15 text-accent-500"
                    : "border-white/5 bg-bg-elevated/60 text-muted hover:text-white"
                }`}
                aria-label="AI 튜터 호출"
                title="AI 튜터에게 질문 (방 전체 공유)"
              >
                <Bot className="h-4 w-4" />
              </button>
              <div className="relative flex-1">
                <input
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    if (v.length > 0) notifyChatTyping();
                    // 멘션 감지: caret 앞쪽 `@...` 패턴
                    const caret = e.target.selectionStart ?? v.length;
                    const before = v.slice(0, caret);
                    const m = before.match(/@(\S*)$/);
                    if (m) {
                      setMentionQuery(m[1]);
                      setMentionIndex(0);
                    } else {
                      setMentionQuery(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    const filtered = mentionCandidates(
                      participants,
                      mentionQuery,
                      me?.id,
                    );
                    if (mentionQuery !== null && filtered.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex((i) => (i + 1) % filtered.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex(
                          (i) => (i - 1 + filtered.length) % filtered.length,
                        );
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        acceptMention(filtered[mentionIndex].name);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMentionQuery(null);
                        return;
                      }
                    }
                    if (e.key === "Enter") send();
                  }}
                  placeholder={
                    uploading
                      ? "파일 업로드 중…"
                      : me
                        ? `${me.name} 로 메시지 보내기 (@ 로 멘션)`
                        : "접속 중…"
                  }
                  disabled={conn !== "live" || !me || uploading}
                  className="input"
                />
                {mentionQuery !== null && (
                  <MentionDropdown
                    candidates={mentionCandidates(
                      participants,
                      mentionQuery,
                      me?.id,
                    )}
                    activeIndex={mentionIndex}
                    onPick={(name) => acceptMention(name)}
                  />
                )}
              </div>
              <button
                onClick={send}
                disabled={conn !== "live" || !input.trim() || uploading}
                className="btn-primary"
                aria-label="전송"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 실행 로그 패널 — 모두에게 broadcast */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted">
            <Terminal className="h-3 w-3" />
            실행 결과 (방 전체 공유)
          </div>
          <span className="text-muted">{runs.length}건</span>
        </div>
        <div
          ref={runScrollRef}
          className="max-h-[220px] space-y-2 overflow-auto p-3"
        >
          {runs.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted">
              아직 실행 로그가 없습니다. 상단의 <b>실행</b> 버튼을 눌러 코드를 돌려보세요.
            </div>
          ) : (
            runs.map((r) => <RunLogItem key={r.id} run={r} meId={me?.id} />)
          )}
        </div>
      </section>

      <MissionPanel mission={mission} />
    </div>
  );
}

function MissionPanel({ mission }: { mission: Mission | null }) {
  if (!mission) {
    return (
      <section className="card p-4">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted">
          <Sparkles className="h-3 w-3 text-accent-500" />
          AI가 던진 공통 미션
        </div>
        <div className="text-sm text-muted">
          <strong>fib(35)</strong> 를 1초 미만으로 돌아가게 만들어 보세요. 함께 코드를
          수정하고 가장 빠른 풀이를 투표합시다.
          <span className="ml-1 text-[11px] text-muted">
            (/collab 에서 AI 미션을 자동 생성해 열 수 있습니다)
          </span>
        </div>
      </section>
    );
  }
  return (
    <section className="card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted">
          <Sparkles className="h-3 w-3 text-accent-500" />
          AI 미션
        </span>
        <span className="chip">{mission.subject}</span>
        <span className="chip">{mission.difficulty}</span>
        <span className="chip">{mission.language}</span>
        <span className="text-[10px] text-muted">by {mission.generatedBy}</span>
      </div>
      <div className="text-base font-semibold">{mission.title}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-muted-strong">
        {mission.description}
      </div>
    </section>
  );
}

function mentionCandidates(
  participants: Participant[],
  query: string | null,
  meId?: string,
): Participant[] {
  if (query === null) return [];
  const q = query.toLowerCase();
  return participants
    .filter((p) => p.id !== meId)
    .filter((p) => {
      const short = p.name.replace(/-\w+$/, "").toLowerCase();
      return short.includes(q) || p.name.toLowerCase().includes(q);
    })
    .slice(0, 5);
}

function MentionDropdown({
  candidates,
  activeIndex,
  onPick,
}: {
  candidates: Participant[];
  activeIndex: number;
  onPick: (name: string) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-white/10 bg-bg-elevated/95 px-3 py-1.5 text-[11px] text-muted shadow-lg backdrop-blur">
        매칭되는 참여자가 없습니다
      </div>
    );
  }
  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-white/10 bg-bg-elevated/95 p-1 text-xs shadow-lg backdrop-blur">
      {candidates.map((p, i) => (
        <button
          key={p.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(p.name);
          }}
          className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${
            i === activeIndex ? "bg-white/10" : "hover:bg-white/5"
          }`}
        >
          <span
            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-white ${p.color}`}
          >
            {initial(p.name)}
          </span>
          <span className="truncate">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

function RunInlineOverlay({
  runs,
  meId,
}: {
  runs: RunResult[];
  meId: string | undefined;
}) {
  const last = runs[runs.length - 1];
  if (!last) return null;
  const hasErr = last.stderr.trim().length > 0;
  const out = (last.stdout || last.stderr).trim();
  const preview = out.split("\n").slice(-1)[0]?.slice(0, 120) || "(출력 없음)";
  const who = last.pid === meId ? "나" : last.name;
  return (
    <div
      className={`flex items-center gap-2 border-t px-4 py-1 text-[11px] ${
        hasErr
          ? "border-rose-500/30 bg-rose-500/5 text-rose-200"
          : "border-accent-500/30 bg-accent-500/5 text-accent-500"
      }`}
    >
      <Play className="h-3 w-3 shrink-0" />
      <span className="shrink-0">
        최근 실행 ({who} · {last.durationMs}ms):
      </span>
      <span className="truncate font-mono text-white/90">{preview}</span>
    </div>
  );
}

function ShareModal({
  roomId,
  onClose,
}: {
  roomId: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    const full = typeof window !== "undefined"
      ? `${window.location.origin}/collab/${roomId}`
      : "";
    setUrl(full);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
    if (!full) return;
    // qrcode 를 클라이언트에서 dynamic import (SSR 안전)
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(full, {
          width: 256,
          margin: 1,
          color: { dark: "#0b0d12", light: "#ffffff" },
        }),
      )
      .then(setQrDataUrl)
      .catch(() => {
        /* ignore */
      });
  }, [roomId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `PolyMath 협업 룸 #${roomId}`,
        text: "같이 공부해요! 아래 링크로 바로 입장 가능합니다.",
        url,
      });
      setShareStatus("공유 완료");
      setTimeout(() => setShareStatus(null), 1500);
    } catch (e) {
      // 사용자가 취소하면 AbortError — 조용히 무시
      if ((e as DOMException)?.name !== "AbortError") {
        setShareStatus("공유 실패");
        setTimeout(() => setShareStatus(null), 2000);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4 text-accent-500" />방 공유
          </div>
          <button onClick={onClose} className="btn-ghost py-1 text-xs">
            닫기
          </button>
        </div>
        <div className="grid place-items-center rounded-xl border border-white/5 bg-white p-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="방 QR 코드" width={224} height={224} />
          ) : (
            <div className="grid h-56 w-56 place-items-center text-xs text-muted">
              QR 생성 중…
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="label">초대 URL</div>
          <div className="flex gap-2">
            <input value={url} readOnly className="input text-xs" />
            <button
              onClick={copy}
              className="btn-primary py-1 text-xs"
              aria-label="URL 복사"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  복사
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted">
            QR 을 폰 카메라로 찍거나 URL 을 공유하면 참여자가 바로 입장합니다.
          </p>
        </div>
        {canNativeShare && (
          <button
            onClick={nativeShare}
            className="btn-primary w-full justify-center py-2 text-xs"
            title="OS 기본 공유 메뉴 (카톡·메시지·메일 등)"
          >
            <Share2 className="h-3 w-3" />
            {shareStatus ?? "네이티브 공유 메뉴 열기"}
          </button>
        )}
      </div>
    </div>
  );
}

type TimelineItem =
  | { kind: "message"; m: ChatMessage; t: number }
  | { kind: "file"; f: SharedFile; t: number };

function Timeline({
  messages,
  files,
  roomId,
  meId,
  meName,
  onReact,
  onDelete,
  onRegenerate,
  onRedrawDiagram,
  searchQuery,
}: {
  messages: ChatMessage[];
  files: SharedFile[];
  roomId: string;
  meId: string | undefined;
  meName?: string;
  onReact: (messageId: string, rating: "up" | "down" | "clear") => void;
  onDelete: (messageId: string) => void;
  onRegenerate: (lastQuestion: string) => void;
  onRedrawDiagram?: () => void;
  searchQuery: string;
}) {
  const q = searchQuery.trim().toLowerCase();
  const filteredMessages = q
    ? messages.filter(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q),
      )
    : messages;
  const filteredFiles = q
    ? files.filter((f) => f.name.toLowerCase().includes(q))
    : files;
  const items: TimelineItem[] = [
    ...filteredMessages.map((m) => ({ kind: "message" as const, m, t: m.at })),
    ...filteredFiles.map((f) => ({ kind: "file" as const, f, t: f.at })),
  ].sort((a, b) => a.t - b.t);

  if (items.length === 0) {
    return (
      <div className="pt-6 text-center text-xs text-muted">
        아직 메시지나 공유된 파일이 없습니다. 첫 메시지를 보내보세요.
      </div>
    );
  }

  // 날짜 그룹
  const groups: { label: string; items: TimelineItem[] }[] = [];
  for (const it of items) {
    const label = dateLabel(it.t);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-2">
          <div className="relative my-2 flex items-center">
            <div className="h-px flex-1 bg-white/5" />
            <span className="mx-2 text-[10px] text-muted">{g.label}</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          {g.items.map((it) =>
            it.kind === "message" ? (
              <ChatBubble
                key={"m-" + it.m.id}
                msg={it.m}
                meId={meId}
                meName={meName}
                onReact={onReact}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onRedrawDiagram={onRedrawDiagram}
              />
            ) : (
              <FileBubble
                key={"f-" + it.f.id}
                file={it.f}
                roomId={roomId}
                meId={meId}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function dateLabel(t: number): string {
  const d = new Date(t);
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = today.getDate();
  const start = new Date(y, m, day).getTime();
  const diff = Math.floor((start - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HistoryBadge({
  startedAt,
  joinedAt,
  messageCount,
}: {
  startedAt: number | null;
  joinedAt: number;
  messageCount: number;
}) {
  if (!startedAt || messageCount === 0) return null;
  if (startedAt > joinedAt - 60_000) return null; // 거의 방금 생성된 방
  const d = new Date(startedAt);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="mb-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-bg-elevated/50 px-3 py-1.5 text-[10px] text-muted">
      <History className="h-3 w-3 text-accent-500" />
      이전 대화 {messageCount}개 복원됨 · 방 개설 {stamp}
    </div>
  );
}

function ChatTypingIndicator({ typings }: { typings: TypingState[] }) {
  const chatList = typings.filter((t) => t.kind === "chat");
  if (chatList.length === 0) return null;
  const names = chatList.slice(0, 3).map((t) => t.name).join(", ");
  const extra = chatList.length > 3 ? ` 외 ${chatList.length - 3}명` : "";
  return (
    <div className="border-t border-white/5 bg-bg-elevated/30 px-3 py-1 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <TypingDots />
        {names}
        {extra} 입력 중…
      </span>
    </div>
  );
}

function CodeTypingIndicator({ typings }: { typings: TypingState[] }) {
  const codeList = typings.filter((t) => t.kind === "code");
  if (codeList.length === 0) return null;
  const names = codeList.slice(0, 2).map((t) => t.name).join(", ");
  const extra = codeList.length > 2 ? ` 외 ${codeList.length - 2}명` : "";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 text-[10px] text-accent-500">
      <TypingDots />
      {names}
      {extra} 코드 수정 중
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
    </span>
  );
}

function FileBubble({
  file,
  roomId,
  meId,
}: {
  file: SharedFile;
  roomId: string;
  meId: string | undefined;
}) {
  const isMe = file.pid === meId;
  const uploader = file.pid === meId ? "나" : file.pid.slice(0, 6);
  return (
    <div
      className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bg-elevated text-muted-strong`}
        title={uploader}
      >
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div className={`min-w-0 flex-1 ${isMe ? "text-right" : ""}`}>
        <div className="text-[10px] text-muted">
          파일 공유
          {isMe && <span className="ml-1">(나)</span>}
          <span className="ml-1.5">
            {new Date(file.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <a
          href={`/api/collab/${roomId}/file/${file.id}`}
          download={file.name}
          className={`mt-0.5 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/5 bg-bg-elevated/60 px-3 py-1.5 text-sm hover:bg-bg-elevated`}
        >
          <Download className="h-3.5 w-3.5 shrink-0 text-accent-500" />
          <span className="min-w-0 truncate">{file.name}</span>
          <span className="shrink-0 text-[10px] text-muted">
            {formatBytes(file.size)}
          </span>
        </a>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function ChatBubble({
  msg,
  meId,
  meName,
  onReact,
  onDelete,
  onRegenerate,
  onRedrawDiagram,
}: {
  msg: ChatMessage;
  meId: string | undefined;
  meName?: string;
  onReact?: (
    messageId: string,
    rating: "up" | "down" | "clear",
    extras?: { reason?: string; category?: string },
  ) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (lastQuestion: string) => void;
  onRedrawDiagram?: () => void;
}) {
  const [showFbForm, setShowFbForm] = useState(false);
  const [fbReason, setFbReason] = useState("");
  const [fbCategory, setFbCategory] = useState<string>("wrong");
  const [fbSent, setFbSent] = useState(false);
  const isMe = msg.pid === meId;
  const isAi = msg.role === "ai";
  const isDeleted = !!msg.deleted;
  const isMentioned =
    !!meName &&
    !isMe &&
    !isAi &&
    new RegExp(
      "@" + meName.replace(/-\w+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    ).test(msg.text);
  const upCount = msg.reactions?.up.length ?? 0;
  const downCount = msg.reactions?.down.length ?? 0;
  const myRating = meId
    ? msg.reactions?.up.includes(meId)
      ? "up"
      : msg.reactions?.down.includes(meId)
        ? "down"
        : null
    : null;
  return (
    <div className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
      <div
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ${msg.color}`}
        title={msg.name}
      >
        {isAi ? <Bot className="h-3.5 w-3.5" /> : initial(msg.name)}
      </div>
      <div className={`min-w-0 flex-1 ${isMe ? "text-right" : ""}`}>
        <div className="text-[10px] text-muted">
          {isAi ? (
            <span className="inline-flex items-center gap-1 text-accent-500">
              <Sparkles className="h-2.5 w-2.5" />
              AI 튜터
            </span>
          ) : (
            msg.name
          )}
          {isMe && <span className="ml-1">(나)</span>}
          <span className="ml-1.5">
            {new Date(msg.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div
          className={`group relative mt-0.5 inline-block max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-sm ${
            isDeleted
              ? "border border-white/5 bg-bg-elevated/30 italic text-muted"
              : isAi
                ? "border border-accent-500/30 bg-accent-500/10 text-white"
                : isMe
                  ? "bg-brand-500/80 text-white"
                  : "border border-white/5 bg-bg-elevated/60 text-white"
          } ${isMentioned ? "ring-2 ring-amber-400/70" : ""}`}
        >
          {isAi && !isDeleted
            ? renderWithMermaid(msg.text, { onDiagramRetry: onRedrawDiagram })
            : msg.text}
          {isMe && !isDeleted && !isAi && onDelete && (
            <button
              onClick={() => onDelete(msg.id)}
              className="absolute -right-6 top-1 hidden rounded p-0.5 text-rose-300 hover:bg-rose-500/10 group-hover:block"
              title="메시지 삭제"
              aria-label="메시지 삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        {isMentioned && (
          <div className={`mt-0.5 text-[10px] text-amber-300 ${isMe ? "text-right" : ""}`}>
            🔔 당신이 멘션되었습니다
          </div>
        )}
        {isAi && !isDeleted && onReact && (
          <div className={`mt-1 flex gap-2 text-[10px] ${isMe ? "justify-end" : ""}`}>
            <button
              onClick={() =>
                onReact(msg.id, myRating === "up" ? "clear" : "up")
              }
              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-white/5 ${
                myRating === "up" ? "text-accent-500" : "text-muted"
              }`}
              title="도움됐어요"
            >
              <ThumbsUp className="h-3 w-3" />
              {upCount > 0 ? upCount : ""}
            </button>
            <button
              onClick={() => {
                if (myRating === "down") {
                  onReact(msg.id, "clear");
                  setShowFbForm(false);
                } else {
                  onReact(msg.id, "down");
                  setShowFbForm(true);
                  setFbSent(false);
                }
              }}
              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-white/5 ${
                myRating === "down" ? "text-rose-300" : "text-muted"
              }`}
              title="아쉬웠어요 — 왜 그런지 알려주면 품질이 올라갑니다"
            >
              <ThumbsDown className="h-3 w-3" />
              {downCount > 0 ? downCount : ""}
            </button>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate("")}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-muted hover:bg-white/5 hover:text-white"
                title="새 질문으로 다시 물어보기"
              >
                <RefreshCw className="h-3 w-3" />
                다시
              </button>
            )}
          </div>
        )}
        {isAi && !isDeleted && showFbForm && !fbSent && (
          <div className="mt-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[11px]">
            <div className="mb-1 text-rose-200">
              어떤 점이 아쉬웠나요? (선택)
            </div>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {[
                { v: "wrong", l: "사실 오류" },
                { v: "unclear", l: "모호함" },
                { v: "off-topic", l: "주제 벗어남" },
                { v: "too-long", l: "너무 김" },
                { v: "too-short", l: "너무 짧음" },
                { v: "other", l: "기타" },
              ].map((c) => (
                <button
                  key={c.v}
                  onClick={() => setFbCategory(c.v)}
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                    fbCategory === c.v
                      ? "border-rose-400/60 bg-rose-500/20 text-rose-200"
                      : "border-white/10 text-muted hover:bg-white/5"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
            <textarea
              value={fbReason}
              onChange={(e) => setFbReason(e.target.value)}
              placeholder="구체적으로 (선택)…"
              rows={2}
              className="input w-full resize-none text-[11px]"
            />
            <div className="mt-1 flex justify-end gap-1">
              <button
                onClick={() => setShowFbForm(false)}
                className="btn-ghost py-0.5 text-[10px]"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  onReact?.(msg.id, "down", {
                    reason: fbReason,
                    category: fbCategory,
                  });
                  setFbSent(true);
                  setTimeout(() => setShowFbForm(false), 1200);
                }}
                className="btn-primary py-0.5 text-[10px]"
              >
                전송
              </button>
            </div>
          </div>
        )}
        {fbSent && (
          <div className="mt-1 text-[10px] text-accent-500">
            ✓ 피드백 저장됨 — 대시보드 → AI 응답 품질에서 확인
          </div>
        )}
      </div>
    </div>
  );
}

function WalletHint({
  wallet,
}: {
  wallet: { enabled: true; provider: string; ownerName: string } | { enabled: false };
}) {
  // 사용자 자기 키는 모름 (localStorage 를 매번 읽을 수도 있지만 간단히 wallet 여부만 표시)
  if (wallet.enabled) {
    return (
      <span className="text-[10px] text-amber-300">
        호스트 지갑 사용 가능 (요청자 키 없으면 {wallet.ownerName} 부담 · {wallet.provider})
      </span>
    );
  }
  return (
    <span className="text-[10px] text-muted">
      요청자 키 사용 · 없으면 데모 응답
    </span>
  );
}

function AdminModal({
  currentName,
  participants,
  hostPid,
  wallet,
  onClose,
  onRename,
  onKick,
  onDelete,
  onResetCode,
  onOpenWallet,
  onCloseWallet,
}: {
  currentName: string | null;
  participants: Participant[];
  hostPid: string;
  wallet: { enabled: true; provider: string; ownerName: string } | { enabled: false };
  onClose: () => void;
  onRename: (name: string | null) => Promise<void>;
  onKick: (pid: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onResetCode: () => Promise<void>;
  onOpenWallet: () => Promise<boolean | void>;
  onCloseWallet: () => Promise<boolean | void>;
}) {
  const [name, setName] = useState(currentName ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="h-4 w-4 text-amber-300" />
            방 관리 (호스트)
          </div>
          <button onClick={onClose} className="btn-ghost py-1 text-xs">
            닫기
          </button>
        </div>

        <div className="space-y-1">
          <div className="label">방 이름</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="방 이름 (비우면 기본값)"
              className="input"
            />
            <button
              onClick={async () => {
                await onRename(name.trim() ? name.trim() : null);
              }}
              className="btn-primary py-1 text-xs"
            >
              저장
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="label">참여자</div>
          <ul className="space-y-1">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-bg-elevated/40 px-2 py-1 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-white ${p.color}`}
                  >
                    {initial(p.name)}
                  </div>
                  <span>{p.name}</span>
                  {p.id === hostPid && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300">
                      <Crown className="h-2.5 w-2.5" />
                      호스트
                    </span>
                  )}
                </div>
                {p.id !== hostPid && (
                  <button
                    onClick={async () => {
                      await onKick(p.id);
                    }}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
                    title="강퇴"
                  >
                    <UserX className="h-3 w-3" />
                    강퇴
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="label">코드</div>
          <button
            onClick={onResetCode}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
          >
            <RotateCcw className="h-3 w-3" />
            초기 코드로 되돌리기
          </button>
          <div className="text-[10px] text-muted">
            현재 Y.Text 내용을 지우고 fib(35) 샘플로 리셋합니다. 되돌릴 수 없습니다.
          </div>
        </div>

        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="label">AI 공용 지갑</div>
          {wallet.enabled ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs">
              <div>
                <div className="text-amber-200">
                  열려있음 · {wallet.provider} ({wallet.ownerName})
                </div>
                <div className="text-[10px] text-muted">
                  키 없는 참여자 질문도 당신 계정으로 결제됩니다
                </div>
              </div>
              <button
                onClick={async () => {
                  await onCloseWallet();
                }}
                className="rounded px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
              >
                닫기
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-bg-elevated/40 px-2 py-1.5 text-xs">
              <div>
                <div>닫힘 — 각자 자기 키로만 호출</div>
                <div className="text-[10px] text-muted">
                  열면 설정의 현재 AI 공급자/키가 방 공용으로 등록됩니다 (디스크 저장 X)
                </div>
              </div>
              <button
                onClick={async () => {
                  await onOpenWallet();
                }}
                className="btn-primary py-1 text-xs"
              >
                내 키로 열기
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1 border-t border-white/5 pt-3">
          <div className="label text-rose-300">위험 구역</div>
          {confirmDelete ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-rose-200">
                정말 방을 삭제할까요? 되돌릴 수 없습니다.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn-ghost py-1 text-xs"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    await onDelete();
                  }}
                  className="rounded-xl bg-rose-500/80 px-3 py-1 text-xs text-white hover:bg-rose-500"
                >
                  삭제 확정
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />이 방 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Overlay({
  title,
  body,
  roomId: _roomId,
}: {
  title: string;
  body: string;
  roomId: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card max-w-sm space-y-3 p-6 text-center">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted">{body}</div>
        <a href="/collab" className="btn-primary inline-flex">
          협업 룸 목록으로
        </a>
      </div>
    </div>
  );
}

function RunLogItem({ run, meId }: { run: RunResult; meId: string | undefined }) {
  const isMe = run.pid === meId;
  const hasErr = run.stderr.trim().length > 0;
  const [copied, setCopied] = useState(false);
  async function copyOutput() {
    try {
      const text = [run.stdout, run.stderr].filter(Boolean).join("\n---\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="rounded-lg border border-white/5 bg-bg-elevated/50">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <div
            className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white ${run.color}`}
          >
            {initial(run.name)}
          </div>
          <span className="text-muted-strong">
            {run.name}
            {isMe && <span className="ml-1 text-muted">(나)</span>}
          </span>
          <span className="chip py-0 text-[10px]">{run.language}</span>
          <span className="text-muted">{run.durationMs}ms</span>
          {hasErr && (
            <span className="flex items-center gap-1 text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              오류
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyOutput}
            className="rounded p-0.5 text-muted hover:bg-white/5 hover:text-white"
            aria-label="출력 복사"
            title="출력 복사"
          >
            {copied ? <Check className="h-3 w-3 text-accent-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <span className="text-muted">
            {new Date(run.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
      {run.stdout.trim().length > 0 && (
        <pre className="whitespace-pre-wrap break-words px-3 py-1.5 font-mono text-[11px] text-white/90">
          {run.stdout}
        </pre>
      )}
      {hasErr && (
        <pre className="whitespace-pre-wrap break-words border-t border-white/5 px-3 py-1.5 font-mono text-[11px] text-rose-300">
          {run.stderr}
        </pre>
      )}
      {run.stdout.trim().length === 0 && !hasErr && (
        <div className="px-3 py-1.5 text-[11px] text-muted">(출력 없음)</div>
      )}
    </div>
  );
}

function SyncStatus({
  meta,
  meId,
}: {
  meta: CodeState | null;
  meId: string | undefined;
}) {
  if (!meta || meta.rev === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <GitBranch className="h-3 w-3" />
        rev 0
      </span>
    );
  }
  const who =
    meta.lastEditor === meId
      ? "나"
      : meta.lastEditorName || meta.lastEditor.slice(0, 6);
  const ago = Math.max(0, Math.round((Date.now() - meta.updatedAt) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5">
      <Save className="h-3 w-3 text-accent-500" />
      <span className="text-muted-strong">
        rev {meta.rev} · {who}
      </span>
      <span className="text-muted">{ago}초 전</span>
    </span>
  );
}

function buildCursorWidget(c: CursorPos): MonacoNs.IContentWidget {
  const hex = hexOf(c.color);
  const node = document.createElement("div");
  node.className = "polymath-remote-cursor";
  node.style.cssText = [
    "position: relative",
    "width: 0",
    "height: 1.2em",
    "pointer-events: none",
    `border-left: 2px solid ${hex}`,
  ].join(";");

  const label = document.createElement("div");
  label.className = "polymath-cursor-label";
  label.textContent = c.name;
  label.style.cssText = [
    "position: absolute",
    "top: -1.1em",
    "left: -1px",
    `background: ${hex}`,
    "color: white",
    "font-size: 10px",
    "line-height: 1",
    "padding: 2px 4px",
    "border-radius: 3px 3px 3px 0",
    "white-space: nowrap",
    "font-family: Inter, sans-serif",
  ].join(";");
  node.appendChild(label);

  const self = {
    _pos: { lineNumber: c.line, column: c.col },
    getId: () => `polymath-cursor-${c.pid}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: self._pos,
      preference: [0 /* EXACT */, 2 /* BELOW fallback */],
    }),
  };
  return self as unknown as MonacoNs.IContentWidget;
}

function ConnBadge({ state }: { state: ConnState }) {
  if (state === "live") {
    return (
      <div className="chip text-accent-500">
        <Wifi className="h-3 w-3" />
        LIVE
      </div>
    );
  }
  if (state === "connecting") {
    return (
      <div className="chip">
        <Wifi className="h-3 w-3 animate-pulse" />
        접속 중
      </div>
    );
  }
  return (
    <div className="chip text-amber-300">
      <WifiOff className="h-3 w-3" />
      재접속 대기
    </div>
  );
}

interface JsRunResult {
  stdout: string;
  stderr: string;
  durationMs: number;
}

async function runPythonLocal(
  code: string,
  timeoutMs: number,
): Promise<JsRunResult> {
  const start = Date.now();
  try {
    const { runPython } = await import("@/lib/pyodide");
    const result = await Promise.race<JsRunResult>([
      runPython(code).then((r) => ({
        stdout: r.stdout,
        stderr: r.stderr,
        durationMs: r.durationMs,
      })),
      new Promise<JsRunResult>((resolve) =>
        window.setTimeout(
          () =>
            resolve({
              stdout: "",
              stderr: `Python 실행 시간 초과 (${timeoutMs}ms)`,
              durationMs: Date.now() - start,
            }),
          timeoutMs,
        ),
      ),
    ]);
    return result;
  } catch (err) {
    return {
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

function runJsInWorker(code: string, timeoutMs: number): Promise<JsRunResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const WORKER_SRC = `
      self.onmessage = (e) => {
        const stdout = [];
        const stderr = [];
        const serialize = (v) => {
          if (typeof v === 'string') return v;
          if (v instanceof Error) return v.stack || v.message;
          try { return JSON.stringify(v); } catch { return String(v); }
        };
        const consoleShim = {
          log: (...a) => stdout.push(a.map(serialize).join(' ')),
          info: (...a) => stdout.push(a.map(serialize).join(' ')),
          warn: (...a) => stderr.push(a.map(serialize).join(' ')),
          error: (...a) => stderr.push(a.map(serialize).join(' ')),
          debug: (...a) => stdout.push(a.map(serialize).join(' ')),
        };
        try {
          (new Function('console', e.data))(consoleShim);
        } catch (err) {
          stderr.push(err && err.stack ? err.stack : String(err));
        }
        self.postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n') });
      };
    `;
    let worker: Worker | null = null;
    let url: string | null = null;
    let timer: number | null = null;
    const finish = (res: JsRunResult) => {
      if (timer !== null) window.clearTimeout(timer);
      if (worker) worker.terminate();
      if (url) URL.revokeObjectURL(url);
      resolve(res);
    };
    try {
      const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
      url = URL.createObjectURL(blob);
      worker = new Worker(url);
      worker.onmessage = (e: MessageEvent<{ stdout: string; stderr: string }>) => {
        finish({
          stdout: e.data.stdout,
          stderr: e.data.stderr,
          durationMs: Date.now() - start,
        });
      };
      worker.onerror = (e) => {
        finish({
          stdout: "",
          stderr: e.message || "Worker 오류",
          durationMs: Date.now() - start,
        });
      };
      timer = window.setTimeout(() => {
        finish({
          stdout: "",
          stderr: `실행 시간 초과 (${timeoutMs}ms). 무한 루프인지 확인하세요.`,
          durationMs: Date.now() - start,
        });
      }, timeoutMs);
      worker.postMessage(code);
    } catch (err) {
      finish({
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      });
    }
  });
}
