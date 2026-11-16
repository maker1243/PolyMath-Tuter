import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import type { ProviderId } from "./providers";
import {
  configurePersistence,
  loadPersistedSync,
  schedulePersist,
  type PersistedFile,
  type PersistedRoom,
} from "./collab-persist";

export interface Participant {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
  lastSeen: number;
}

export type ChatRole = "user" | "ai";

export interface ChatMessage {
  id: string;
  pid: string;
  name: string;
  color: string;
  text: string;
  at: number;
  role?: ChatRole; // undefined → "user" (레거시 호환)
  codeContext?: string; // AI 답변 시 사용한 코드 snippet (옵셔널)
  reactions?: {
    up: string[]; // pids who liked
    down: string[]; // pids who disliked
  };
  deleted?: boolean; // 삭제됨 — text 는 "[삭제된 메시지]" 로 치환
  editedAt?: number; // 수정 시각 (미구현)
}

export interface CodeState {
  text: string;
  rev: number;
  lastEditor: string; // pid
  lastEditorName: string;
  updatedAt: number;
}

export interface CursorPos {
  pid: string;
  name: string;
  color: string;
  line: number;
  col: number;
  at: number;
}

export interface RunResult {
  id: string;
  pid: string;
  name: string;
  color: string;
  language: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  at: number;
}

export type TypingKind = "chat" | "code";

export interface TypingState {
  pid: string;
  name: string;
  color: string;
  kind: TypingKind;
  at: number;
}

export interface SharedFile {
  id: string;
  pid: string; // uploader
  name: string;
  size: number;
  contentType: string;
  storedPath: string; // 디스크 상대 경로
  at: number;
}

export interface Mission {
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  language: string;
  generatedBy: string; // provider id 또는 "demo"
  generatedAt: number;
}

/**
 * 방 공용 "AI 지갑" — 호스트가 자기 키를 다른 참여자에게 열어 비용을 대신 내는 모드.
 * **디스크 영속화 안 함** — 서버 재시작 시 재등록 필요.
 */
export interface HostWallet {
  provider: ProviderId;
  apiKey: string;
  model?: string;
  geminiAuth?: "auto" | "key" | "bearer";
  ownerPid: string;
  ownerName: string;
  openedAt: number;
}

export type CollabEvent =
  | {
      type: "snapshot";
      participants: Participant[];
      messages: ChatMessage[];
      code: CodeState;
      cursors: CursorPos[];
      runs: RunResult[];
      yState: string; // base64
      files: SharedFile[];
      typings: TypingState[];
      startedAt: number;
      mission: Mission | null;
      hostPid: string;
      name: string | null;
      hostWallet: { enabled: true; provider: ProviderId; ownerName: string } | { enabled: false };
    }
  | { type: "mission"; mission: Mission }
  | { type: "host_changed"; hostPid: string }
  | { type: "room_renamed"; name: string | null }
  | { type: "kicked"; pid: string; by: string }
  | { type: "room_deleted" }
  | {
      type: "wallet_changed";
      wallet: { enabled: true; provider: ProviderId; ownerName: string } | { enabled: false };
    }
  | { type: "participant_joined"; participant: Participant }
  | { type: "participant_left"; pid: string }
  | { type: "message"; message: ChatMessage }
  | { type: "message_updated"; message: ChatMessage }
  | { type: "code"; code: CodeState }
  | { type: "cursor"; cursor: CursorPos }
  | { type: "run"; run: RunResult }
  | { type: "y_update"; update: string; origin: string }
  | { type: "typing"; typing: TypingState }
  | { type: "typing_cleared"; pid: string; kind: TypingKind }
  | { type: "file_added"; file: SharedFile }
  | { type: "file_removed"; fileId: string };

interface Subscriber {
  pid: string;
  send: (data: string) => void;
}

interface Room {
  id: string;
  participants: Map<string, Participant>;
  messages: ChatMessage[];
  subscribers: Set<Subscriber>;
  code: CodeState;
  cursors: Map<string, CursorPos>;
  runs: RunResult[];
  ydoc: Y.Doc;
  typings: Map<string, TypingState>; // key = `${pid}:${kind}`
  files: SharedFile[];
  startedAt: number;
  mission: Mission | null;
  hostPid: string; // 방 호스트 (최초 참여자) — "" 면 비어있음
  name: string | null; // 사용자 지정 방 이름 (null 이면 roomId 사용)
  hostWallet: HostWallet | null; // 영속화 안 함
}

const INITIAL_CODE = `// 공통 미션: 아래 함수가 왜 느린지 분석하고 메모이제이션으로 개선해 보세요.
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
console.log(fib(35));
`;

const MAX_MESSAGES = 200;
const MAX_RUNS = 20;
const MAX_FILES = 50;
const STALE_MS = 45_000;
const TYPING_TTL_MS = 4_000;

// HMR·모듈 재평가 안전: Next.js dev 가 globalThis 를 격리할 수 있으므로
// 'process' 객체(단일 Node 프로세스에서 공유)에 저장소를 보관
const g = process as unknown as {
  __polymathRooms?: Map<string, Room>;
  __polymathGcTimer?: NodeJS.Timeout;
  __polymathLoaded?: boolean;
};
if (!g.__polymathRooms) g.__polymathRooms = new Map();
const rooms = g.__polymathRooms;

function b64Encode(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}
function b64Decode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function broadcast(roomId: string, event: CollabEvent) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const sub of room.subscribers) {
    try {
      sub.send(payload);
    } catch {
      /* dead sub — cleaned up by caller */
    }
  }
}

function attachYObservers(room: Room) {
  const ytext = room.ydoc.getText("code");

  // Y.Text 변경 → CodeState 메타 갱신 + 'code' broadcast
  ytext.observe((_event, tr) => {
    const origin = typeof tr.origin === "string" ? tr.origin : null;
    // init/load 는 복원·초기화 — rev 증가·broadcast 없이 text 만 반영
    if (origin === "init" || origin === "load" || origin === null) {
      room.code = {
        ...room.code,
        text: ytext.toString(),
        updatedAt: Date.now(),
      };
      return;
    }
    const name =
      room.participants.get(origin)?.name ??
      room.code.lastEditorName ??
      "익명";
    room.code = {
      text: ytext.toString(),
      rev: room.code.rev + 1,
      lastEditor: origin,
      lastEditorName: name,
      updatedAt: Date.now(),
    };
    broadcast(room.id, { type: "code", code: room.code });
  });

  // 모든 Y.Doc update → broadcast (origin 포함)
  room.ydoc.on("update", (update: Uint8Array, origin: unknown) => {
    const originStr = typeof origin === "string" ? origin : "server";
    if (originStr === "load") return; // 복원 — 전파하지 않음
    const payload = b64Encode(update);
    broadcast(room.id, {
      type: "y_update",
      update: payload,
      origin: originStr,
    });
    schedulePersist();
  });
}

function makeRoom(id: string): Room {
  const ydoc = new Y.Doc();
  const now = Date.now();
  const room: Room = {
    id,
    participants: new Map(),
    messages: [],
    subscribers: new Set(),
    code: {
      text: "",
      rev: 0,
      lastEditor: "",
      lastEditorName: "",
      updatedAt: now,
    },
    cursors: new Map(),
    runs: [],
    ydoc,
    typings: new Map(),
    files: [],
    startedAt: now,
    mission: null,
    hostPid: "",
    name: null,
    hostWallet: null,
  };
  attachYObservers(room);
  return room;
}

function getRoom(id: string): Room {
  const existing = rooms.get(id);
  if (existing) return existing;
  const next = makeRoom(id);
  // 초기 코드를 origin='init' 트랜잭션으로 삽입 — rev 증가 없음
  next.ydoc.transact(() => {
    next.ydoc.getText("code").insert(0, INITIAL_CODE);
  }, "init");
  rooms.set(id, next);
  schedulePersist();
  return next;
}

export function applyYUpdate(
  roomId: string,
  pid: string,
  updateB64: string,
): { ok: true } {
  const room = getRoom(roomId);
  try {
    Y.applyUpdate(room.ydoc, b64Decode(updateB64), pid);
  } catch (err) {
    console.error("[polymath] applyYUpdate failed:", err);
  }
  heartbeat(roomId, pid);
  return { ok: true };
}

export function joinRoom(
  roomId: string,
  p: { id: string; name: string; color: string },
): Participant {
  const room = getRoom(roomId);
  const now = Date.now();
  const existing = room.participants.get(p.id);
  const participant: Participant = existing
    ? { ...existing, name: p.name, color: p.color, lastSeen: now }
    : { ...p, joinedAt: now, lastSeen: now };
  room.participants.set(p.id, participant);
  // 최초 참여자를 자동 호스트로 claim
  if (!room.hostPid) {
    room.hostPid = p.id;
    broadcast(roomId, { type: "host_changed", hostPid: p.id });
    schedulePersist();
  }
  if (!existing) {
    broadcast(roomId, { type: "participant_joined", participant });
  }
  return participant;
}

export function leaveRoom(roomId: string, pid: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (!room.participants.delete(pid)) return;
  room.cursors.delete(pid);
  for (const key of Array.from(room.typings.keys())) {
    if (key.startsWith(pid + ":")) room.typings.delete(key);
  }
  broadcast(roomId, { type: "participant_left", pid });
  // 호스트가 나가면 가장 오래 머문 참여자에게 양도 + 지갑 자동 소거
  if (room.hostPid === pid) {
    const next = Array.from(room.participants.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    )[0];
    room.hostPid = next?.id ?? "";
    broadcast(roomId, { type: "host_changed", hostPid: room.hostPid });
    if (room.hostWallet) {
      room.hostWallet = null;
      broadcast(roomId, {
        type: "wallet_changed",
        wallet: walletPublic(null),
      });
    }
    schedulePersist();
  }
}

export function kickParticipant(
  roomId: string,
  byPid: string,
  targetPid: string,
): { ok: boolean; reason?: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "방 없음" };
  if (room.hostPid !== byPid) return { ok: false, reason: "호스트만 가능" };
  if (!room.participants.has(targetPid)) return { ok: false, reason: "대상 없음" };
  if (byPid === targetPid) return { ok: false, reason: "자기 자신 강퇴 불가" };
  // 대상에게 kick 통지 → 클라이언트가 화면 전환
  broadcast(roomId, { type: "kicked", pid: targetPid, by: byPid });
  // leaveRoom 로 정리 (participant_left 포함)
  leaveRoom(roomId, targetPid);
  return { ok: true };
}

export function renameRoom(
  roomId: string,
  byPid: string,
  name: string | null,
): { ok: boolean; reason?: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "방 없음" };
  if (room.hostPid !== byPid) return { ok: false, reason: "호스트만 가능" };
  room.name = name ? name.slice(0, 60) : null;
  broadcast(roomId, { type: "room_renamed", name: room.name });
  schedulePersist();
  return { ok: true };
}

export function deleteRoom(
  roomId: string,
  byPid: string,
): { ok: boolean; reason?: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "방 없음" };
  if (room.hostPid !== byPid) return { ok: false, reason: "호스트만 가능" };
  broadcast(roomId, { type: "room_deleted" });
  // 모든 subscriber 끊고 메모리 비우기
  for (const sub of room.subscribers) {
    try {
      sub.send(JSON.stringify({ type: "room_deleted" }));
    } catch {
      /* ignore */
    }
  }
  rooms.delete(roomId);
  schedulePersist();
  return { ok: true };
}

export function postAiMessage(
  roomId: string,
  text: string,
  opts?: { codeContext?: string },
): ChatMessage {
  const room = getRoom(roomId);
  const message: ChatMessage = {
    id: randomUUID(),
    pid: "ai-tutor",
    name: "AI 튜터",
    color: "bg-accent-500",
    text: text.slice(0, 8000),
    at: Date.now(),
    role: "ai",
    codeContext: opts?.codeContext?.slice(0, 4000),
  };
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages = room.messages.slice(-MAX_MESSAGES);
  }
  broadcast(roomId, { type: "message", message });
  schedulePersist();
  return message;
}

export function deleteMessage(
  roomId: string,
  input: { messageId: string; pid: string },
): ChatMessage | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const msg = room.messages.find((m) => m.id === input.messageId);
  if (!msg) return null;
  // 자기 메시지만 삭제 가능 (AI 메시지는 호스트만 추후 — 지금은 skip)
  if (msg.pid !== input.pid) return null;
  if (msg.deleted) return msg;
  msg.deleted = true;
  msg.text = "[삭제된 메시지]";
  broadcast(roomId, { type: "message_updated", message: msg });
  schedulePersist();
  return msg;
}

/** 호스트가 코드를 initial 상태로 되돌림. mission.initialCode 가 있으면 그걸로, 아니면 기본 fib. */
export function resetCodeToInitial(
  roomId: string,
  byPid: string,
): { ok: boolean; reason?: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "방 없음" };
  if (room.hostPid !== byPid) return { ok: false, reason: "호스트만 가능" };
  // Y.Text 전체 지우고 다시 삽입 — origin=byPid 로 하면 rev 증가 + broadcast 됨
  room.ydoc.transact(() => {
    const ytext = room.ydoc.getText("code");
    ytext.delete(0, ytext.length);
    ytext.insert(0, INITIAL_CODE);
  }, byPid);
  return { ok: true };
}

export function reactToMessage(
  roomId: string,
  input: { messageId: string; pid: string; rating: "up" | "down" | "clear" },
): ChatMessage | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const msg = room.messages.find((m) => m.id === input.messageId);
  if (!msg) return null;
  if (!msg.reactions) msg.reactions = { up: [], down: [] };
  // 기존 반응 제거 (토글/변경 지원)
  msg.reactions.up = msg.reactions.up.filter((p) => p !== input.pid);
  msg.reactions.down = msg.reactions.down.filter((p) => p !== input.pid);
  if (input.rating === "up") msg.reactions.up.push(input.pid);
  else if (input.rating === "down") msg.reactions.down.push(input.pid);
  // 서버 broadcast
  broadcast(roomId, { type: "message_updated", message: msg });
  schedulePersist();
  return msg;
}

export function roomCurrentCode(roomId: string): string {
  const room = getRoom(roomId);
  return room.ydoc.getText("code").toString();
}

function walletPublic(
  w: HostWallet | null,
):
  | { enabled: true; provider: ProviderId; ownerName: string }
  | { enabled: false } {
  if (!w) return { enabled: false };
  return { enabled: true, provider: w.provider, ownerName: w.ownerName };
}

export function setHostWallet(
  roomId: string,
  byPid: string,
  wallet:
    | { provider: ProviderId; apiKey: string; model?: string; geminiAuth?: "auto" | "key" | "bearer" }
    | null,
): { ok: boolean; reason?: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "방 없음" };
  if (room.hostPid !== byPid) return { ok: false, reason: "호스트만 가능" };
  if (wallet === null) {
    room.hostWallet = null;
  } else {
    const owner = room.participants.get(byPid);
    room.hostWallet = {
      ...wallet,
      ownerPid: byPid,
      ownerName: owner?.name ?? "호스트",
      openedAt: Date.now(),
    };
  }
  broadcast(roomId, {
    type: "wallet_changed",
    wallet: walletPublic(room.hostWallet),
  });
  return { ok: true };
}

/**
 * 서버 내부용: AI 호출 시 사용할 자격증명을 결정.
 * 1) 요청 본문의 사용자 키가 있으면 그걸 그대로 사용 (payer=requester)
 * 2) 없고 방에 호스트 지갑이 열려 있으면 호스트 지갑 사용 (payer=host)
 * 3) 둘 다 없으면 null (호출자가 데모 폴백해야 함)
 */
export function resolveAiCredentials(
  roomId: string,
  requester: {
    provider?: ProviderId;
    apiKey?: string;
    model?: string;
    geminiAuth?: "auto" | "key" | "bearer";
  },
):
  | {
      provider: ProviderId;
      apiKey: string;
      model?: string;
      geminiAuth?: "auto" | "key" | "bearer";
      payer: "requester" | "host";
      payerName?: string;
    }
  | null {
  if (requester.provider && requester.apiKey) {
    return {
      provider: requester.provider,
      apiKey: requester.apiKey,
      model: requester.model,
      geminiAuth: requester.geminiAuth,
      payer: "requester",
    };
  }
  const room = rooms.get(roomId);
  if (room?.hostWallet) {
    return {
      provider: room.hostWallet.provider,
      apiKey: room.hostWallet.apiKey,
      model: room.hostWallet.model,
      geminiAuth: room.hostWallet.geminiAuth,
      payer: "host",
      payerName: room.hostWallet.ownerName,
    };
  }
  return null;
}

export function postTyping(
  roomId: string,
  input: { pid: string; name: string; color: string; kind: TypingKind },
) {
  const room = getRoom(roomId);
  const typing: TypingState = {
    pid: input.pid,
    name: input.name,
    color: input.color,
    kind: input.kind,
    at: Date.now(),
  };
  room.typings.set(`${input.pid}:${input.kind}`, typing);
  broadcast(roomId, { type: "typing", typing });
  heartbeat(roomId, input.pid);
}

export function addFile(
  roomId: string,
  input: {
    pid: string;
    name: string;
    size: number;
    contentType: string;
    storedPath: string;
  },
): SharedFile {
  const room = getRoom(roomId);
  const file: SharedFile = {
    id: randomUUID(),
    pid: input.pid,
    name: input.name.slice(0, 200),
    size: Math.max(0, input.size | 0),
    contentType: input.contentType.slice(0, 100),
    storedPath: input.storedPath,
    at: Date.now(),
  };
  room.files.push(file);
  if (room.files.length > MAX_FILES) room.files = room.files.slice(-MAX_FILES);
  broadcast(roomId, { type: "file_added", file });
  heartbeat(roomId, input.pid);
  schedulePersist();
  return file;
}

export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

export function setMission(roomId: string, mission: Mission) {
  const room = getRoom(roomId);
  room.mission = mission;
  broadcast(roomId, { type: "mission", mission });
  schedulePersist();
}

/**
 * AI-generated 초기 코드로 Y.Text 를 교체합니다. 신규 방에서만 사용 — 기존 내용은
 * 'init' origin 트랜잭션으로 삭제·삽입되어 rev 증가·broadcast 를 건너뜁니다.
 */
export function resetInitialCode(roomId: string, text: string) {
  const room = getRoom(roomId);
  room.ydoc.transact(() => {
    const ytext = room.ydoc.getText("code");
    ytext.delete(0, ytext.length);
    ytext.insert(0, text);
  }, "init");
  room.code = { ...room.code, text, updatedAt: Date.now() };
  schedulePersist();
}

export function getFile(roomId: string, fileId: string): SharedFile | null {
  const room = rooms.get(roomId);
  return room?.files.find((f) => f.id === fileId) ?? null;
}

export function removeFile(roomId: string, fileId: string): SharedFile | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const idx = room.files.findIndex((f) => f.id === fileId);
  if (idx < 0) return null;
  const [file] = room.files.splice(idx, 1);
  broadcast(roomId, { type: "file_removed", fileId });
  schedulePersist();
  return file;
}

export function updateCursor(
  roomId: string,
  input: {
    pid: string;
    name: string;
    color: string;
    line: number;
    col: number;
  },
) {
  const room = getRoom(roomId);
  const cursor: CursorPos = {
    pid: input.pid,
    name: input.name,
    color: input.color,
    line: Math.max(1, Math.min(input.line | 0, 100_000)),
    col: Math.max(1, Math.min(input.col | 0, 100_000)),
    at: Date.now(),
  };
  room.cursors.set(input.pid, cursor);
  broadcast(roomId, { type: "cursor", cursor });
  heartbeat(roomId, input.pid);
}

export function heartbeat(roomId: string, pid: string) {
  const room = rooms.get(roomId);
  const p = room?.participants.get(pid);
  if (p) p.lastSeen = Date.now();
}

export function postMessage(
  roomId: string,
  input: { pid: string; name: string; color: string; text: string },
): ChatMessage | null {
  const text = input.text.trim();
  if (!text) return null;
  const room = getRoom(roomId);
  const message: ChatMessage = {
    id: randomUUID(),
    pid: input.pid,
    name: input.name,
    color: input.color,
    text: text.slice(0, 2000),
    at: Date.now(),
  };
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages = room.messages.slice(-MAX_MESSAGES);
  }
  broadcast(roomId, { type: "message", message });
  heartbeat(roomId, input.pid);
  schedulePersist();
  return message;
}

export function postRun(
  roomId: string,
  input: {
    pid: string;
    name: string;
    color: string;
    language: string;
    stdout: string;
    stderr: string;
    durationMs: number;
  },
): RunResult {
  const room = getRoom(roomId);
  const run: RunResult = {
    id: randomUUID(),
    pid: input.pid,
    name: input.name,
    color: input.color,
    language: input.language.slice(0, 24),
    stdout: input.stdout.slice(0, 10_000),
    stderr: input.stderr.slice(0, 10_000),
    durationMs: Math.max(0, input.durationMs | 0),
    at: Date.now(),
  };
  room.runs.push(run);
  if (room.runs.length > MAX_RUNS) room.runs = room.runs.slice(-MAX_RUNS);
  broadcast(roomId, { type: "run", run });
  heartbeat(roomId, input.pid);
  schedulePersist();
  return run;
}

/**
 * SSE 구독. 반환된 함수를 호출하면 구독이 해제되며, 그 pid 의 마지막 구독이면 leave 처리됩니다.
 */
export function subscribe(
  roomId: string,
  pid: string,
  send: (data: string) => void,
): () => void {
  const room = getRoom(roomId);
  const sub: Subscriber = { pid, send };
  room.subscribers.add(sub);

  // 가입 직후 스냅샷 송신 — Y.Doc 전체 상태 포함
  const snapshot: CollabEvent = {
    type: "snapshot",
    participants: Array.from(room.participants.values()),
    messages: room.messages,
    code: room.code,
    cursors: Array.from(room.cursors.values()),
    runs: room.runs,
    yState: b64Encode(Y.encodeStateAsUpdate(room.ydoc)),
    files: room.files,
    typings: Array.from(room.typings.values()),
    startedAt: room.startedAt,
    mission: room.mission,
    hostPid: room.hostPid,
    name: room.name,
    hostWallet: walletPublic(room.hostWallet),
  };
  try {
    send(JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }

  return () => {
    room.subscribers.delete(sub);
    const stillHere = Array.from(room.subscribers).some((s) => s.pid === pid);
    if (!stillHere) leaveRoom(roomId, pid);
  };
}

export interface RoomSummary {
  id: string;
  name: string | null;
  mission: {
    title: string;
    subject: string;
    difficulty: string;
    language: string;
  } | null;
  participants: number;
  messages: number;
  hasHost: boolean;
  hostWalletEnabled: boolean;
  startedAt: number;
  lastActivity: number;
}

export function listRoomSummaries(): RoomSummary[] {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    mission: r.mission
      ? {
          title: r.mission.title,
          subject: r.mission.subject,
          difficulty: r.mission.difficulty,
          language: r.mission.language,
        }
      : null,
    participants: r.participants.size,
    messages: r.messages.length,
    hasHost: !!r.hostPid,
    hostWalletEnabled: !!r.hostWallet,
    startedAt: r.startedAt,
    lastActivity: Math.max(
      r.startedAt,
      ...Array.from(r.participants.values()).map((p) => p.lastSeen),
      ...r.messages.map((m) => m.at),
    ),
  }));
}

// 유령 참여자 + 만료된 typing 상태 수거
if (!g.__polymathGcTimer) {
  g.__polymathGcTimer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      // 참여자 TTL
      for (const [pid, p] of room.participants.entries()) {
        if (now - p.lastSeen > STALE_MS) {
          room.participants.delete(pid);
          room.cursors.delete(pid);
          for (const key of Array.from(room.typings.keys())) {
            if (key.startsWith(pid + ":")) room.typings.delete(key);
          }
          broadcast(room.id, { type: "participant_left", pid });
        }
      }
      // typing TTL
      for (const [key, t] of room.typings.entries()) {
        if (now - t.at > TYPING_TTL_MS) {
          room.typings.delete(key);
          broadcast(room.id, {
            type: "typing_cleared",
            pid: t.pid,
            kind: t.kind,
          });
        }
      }
    }
  }, 2_000);
  (g.__polymathGcTimer as unknown as { unref?: () => void }).unref?.();
}

// === 영속성 bootstrap ===
function serializeRoom(r: Room): PersistedRoom {
  return {
    id: r.id,
    messages: r.messages,
    code: r.code,
    yState: b64Encode(Y.encodeStateAsUpdate(r.ydoc)),
    runs: r.runs,
    files: r.files,
    startedAt: r.startedAt,
    mission: r.mission,
    hostPid: r.hostPid,
    name: r.name,
    savedAt: Date.now(),
  };
}

configurePersistence(
  (): PersistedFile => ({
    version: 1,
    rooms: Array.from(rooms.values()).map(serializeRoom),
  }),
);

if (!g.__polymathLoaded) {
  g.__polymathLoaded = true;
  const data = loadPersistedSync();
  if (data) {
    for (const persisted of data.rooms) {
      if (rooms.has(persisted.id)) continue; // HMR 재진입 — 메모리 우선
      const room = makeRoom(persisted.id);
      room.messages = Array.isArray(persisted.messages) ? persisted.messages : [];
      room.runs = Array.isArray(persisted.runs) ? persisted.runs : [];
      room.files = Array.isArray(persisted.files) ? persisted.files : [];
      room.startedAt =
        typeof persisted.startedAt === "number"
          ? persisted.startedAt
          : (persisted.messages[0]?.at ?? Date.now());
      room.mission = persisted.mission ?? null;
      room.hostPid = typeof persisted.hostPid === "string" ? persisted.hostPid : "";
      room.name =
        typeof persisted.name === "string" || persisted.name === null
          ? persisted.name
          : null;
      room.code = persisted.code;
      if (persisted.yState) {
        try {
          Y.applyUpdate(room.ydoc, b64Decode(persisted.yState), "load");
        } catch (err) {
          console.error("[polymath/persist] applyUpdate failed:", err);
          // 폴백: code.text 를 origin='load' 로 삽입
          room.ydoc.transact(() => {
            room.ydoc.getText("code").insert(0, persisted.code.text);
          }, "load");
        }
      } else if (persisted.code.text) {
        room.ydoc.transact(() => {
          room.ydoc.getText("code").insert(0, persisted.code.text);
        }, "load");
      }
      rooms.set(persisted.id, room);
    }
    console.log(
      `[polymath/persist] restored ${data.rooms.length} room(s) from disk`,
    );
  }
}
