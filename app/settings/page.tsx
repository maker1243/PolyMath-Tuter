"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Key,
  Loader2,
  ShieldCheck,
  X,
  ExternalLink,
  Zap,
  Download,
} from "lucide-react";
import {
  PROVIDERS,
  geminiAuthKind,
  type ProviderId,
  type ProviderModel,
} from "@/lib/providers";
import {
  loadAiSettings,
  saveAiSettings,
  type GeminiAuthMode,
  type ImageSettings,
  type UserAiSettings,
} from "@/lib/user-settings";
import type { ImageProvider } from "@/lib/image-gen";
import { useCurrentUser } from "@/lib/use-current-user";
import { PasswordSection } from "@/components/PasswordSection";
import { ProfileSection } from "@/components/ProfileSection";
import { DataBackupSection } from "@/components/DataBackupSection";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; sample: string }
  | { kind: "error"; message: string };

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; models: ProviderModel[] }
  | { kind: "error"; message: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserAiSettings | null>(null);
  const [tests, setTests] = useState<Record<ProviderId, TestState>>({
    claude: { kind: "idle" },
    gemini: { kind: "idle" },
    groq: { kind: "idle" },
  });
  const [fetched, setFetched] = useState<Record<ProviderId, FetchState>>({
    claude: { kind: "idle" },
    gemini: { kind: "idle" },
    groq: { kind: "idle" },
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { user, isOwner } = useCurrentUser();
  const [serverSynced, setServerSynced] = useState(false);

  // 로그인한 사용자는 서버 저장을 1차 소스로 사용 (localStorage 는 캐시)
  useEffect(() => {
    let active = true;
    (async () => {
      const local = loadAiSettings();
      if (!user) {
        if (active) setSettings(local);
        return;
      }
      try {
        const res = await fetch("/api/user/prefs", { cache: "no-store" });
        if (!res.ok) throw new Error("prefs fetch failed");
        const data = (await res.json()) as {
          prefs: { aiSettings: UserAiSettings | null } | null;
        };
        if (!active) return;
        if (data.prefs?.aiSettings) {
          setSettings(data.prefs.aiSettings);
          saveAiSettings(data.prefs.aiSettings); // 캐시 업데이트
        } else {
          // 서버에 없음 → 로컬을 서버로 1회 올리기
          setSettings(local);
          void fetch("/api/user/prefs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aiSettings: local }),
          });
        }
        setServerSynced(true);
      } catch {
        if (active) setSettings(local);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!settings) {
    return (
      <div className="py-20 text-center text-sm text-muted">설정을 불러오는 중…</div>
    );
  }

  function update<K extends keyof UserAiSettings>(k: K, v: UserAiSettings[K]) {
    const next = { ...settings!, [k]: v };
    setSettings(next);
    saveAiSettings(next);
    setSavedAt(Date.now());
    // 로그인 사용자면 서버에도 동기화 (fire-and-forget)
    if (user) {
      void fetch("/api/user/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiSettings: next }),
      });
    }
  }

  function setKey(p: ProviderId, key: string) {
    update("keys", { ...settings!.keys, [p]: key });
  }
  function setModel(p: ProviderId, model: string) {
    update("models", { ...settings!.models, [p]: model });
  }

  async function test(p: ProviderId) {
    const key = settings!.keys[p]?.trim();
    if (!key) {
      setTests((prev) => ({
        ...prev,
        [p]: { kind: "error", message: "API 키가 비어 있습니다." },
      }));
      return;
    }
    setTests((prev) => ({ ...prev, [p]: { kind: "testing" } }));
    try {
      const res = await fetch("/api/provider-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: p,
          apiKey: key,
          model: settings!.models[p] ?? PROVIDERS[p].defaultModel,
          geminiAuth: p === "gemini" ? settings!.geminiAuth ?? "auto" : undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sample?: string;
        error?: string;
      };
      setTests((prev) => ({
        ...prev,
        [p]:
          data.ok && data.sample !== undefined
            ? { kind: "ok", sample: data.sample }
            : { kind: "error", message: data.error ?? "실패" },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [p]: { kind: "error", message: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  async function fetchModels(p: ProviderId) {
    const key = settings!.keys[p]?.trim();
    if (!key) {
      setFetched((prev) => ({
        ...prev,
        [p]: { kind: "error", message: "API 키를 먼저 입력하세요." },
      }));
      return;
    }
    setFetched((prev) => ({ ...prev, [p]: { kind: "loading" } }));
    try {
      const res = await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: p,
          apiKey: key,
          geminiAuth: p === "gemini" ? settings!.geminiAuth ?? "auto" : undefined,
        }),
      });
      const data = (await res.json()) as {
        models?: ProviderModel[];
        error?: string;
      };
      if (data.models?.length) {
        setFetched((prev) => ({ ...prev, [p]: { kind: "ok", models: data.models! } }));
      } else {
        setFetched((prev) => ({
          ...prev,
          [p]: { kind: "error", message: data.error ?? "모델이 비어 있음" },
        }));
      }
    } catch (err) {
      setFetched((prev) => ({
        ...prev,
        [p]: { kind: "error", message: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">AI 설정</h1>
        <p className="mt-1 text-sm text-muted">
          플랫폼 전체의 AI 응답에 사용할 공급자와 모델을 고르고, 각자의 API 키를
          입력하세요.
          {user ? (
            <>
              {" "}
              <strong className="text-accent-500">
                {serverSynced ? "서버 동기화 중" : "서버 동기화 준비 중"}
              </strong>{" "}
              — 로그인되어 있어 다른 기기에서도 같은 설정이 자동 적용됩니다.
            </>
          ) : (
            <>
              {" "}
              이 브라우저의 localStorage 에만 저장됩니다.{" "}
              <a href="/auth/login" className="text-accent-500 hover:underline">
                로그인
              </a>{" "}
              하면 서버에 동기화되어 다른 기기에서도 같은 설정이 적용됩니다.
            </>
          )}
        </p>
      </header>

      {/* Active provider */}
      <section className="card p-6">
        <div className="label">기본 공급자</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
            const info = PROVIDERS[p];
            const active = settings.provider === p;
            const hasKey = Boolean(settings.keys[p]?.trim());
            return (
              <button
                key={p}
                onClick={() => update("provider", p)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-brand-500/60 bg-brand-500/10 shadow-glow"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm font-semibold">{info.label}</div>
                  {active && <Check className="h-4 w-4 text-brand-500" />}
                </div>
                <div className="text-xs text-muted">{info.description}</div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${
                      hasKey ? "bg-accent-500" : "bg-muted/50"
                    }`}
                  />
                  <span className="text-muted">
                    {hasKey ? "키 설정됨" : "키 미설정"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Provider details */}
      <section className="space-y-4">
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
          const info = PROVIDERS[p];
          const testState = tests[p];
          return (
            <div key={p} className="card p-6">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold">
                    {info.label}
                    {settings.provider === p && (
                      <span className="chip">
                        <Zap className="h-3 w-3 text-accent-500" />
                        활성
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">{info.description}</div>
                </div>
                <a
                  href={info.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  키 발급
                </a>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
                <div>
                  <div className="flex items-end justify-between">
                    <div className="label">API 키</div>
                    {p === "gemini" && settings.keys[p]?.trim() && (
                      <span className="mb-1 text-[11px] text-muted">
                        감지:{" "}
                        <span className="font-semibold text-muted-strong">
                          {geminiAuthKind(settings.keys[p] ?? "") === "key"
                            ? "AI Studio API 키"
                            : "OAuth Bearer 토큰"}
                        </span>
                      </span>
                    )}
                    {p === "groq" && settings.keys[p]?.trim() && (
                      <span className="mb-1 text-[11px] text-muted">
                        감지:{" "}
                        <span
                          className={`font-semibold ${
                            (settings.keys[p] ?? "").trim().startsWith("gsk_")
                              ? "text-accent-500"
                              : "text-amber-400"
                          }`}
                        >
                          {(settings.keys[p] ?? "").trim().startsWith("gsk_")
                            ? "Groq 키 포맷 OK"
                            : "⚠ 'gsk_' 로 시작해야 Groq 키"}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Key className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    <input
                      type="password"
                      value={settings.keys[p] ?? ""}
                      onChange={(e) => setKey(p, e.target.value)}
                      placeholder={placeholderFor(p)}
                      className="input pl-9"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between">
                    <div className="label">모델 ID</div>
                    <button
                      onClick={() => fetchModels(p)}
                      disabled={fetched[p].kind === "loading"}
                      className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-white"
                      title="사용 가능한 모델을 API 에서 가져옵니다"
                    >
                      {fetched[p].kind === "loading" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      모델 가져오기
                    </button>
                  </div>
                  <input
                    list={`models-${p}`}
                    value={settings.models[p] ?? info.defaultModel}
                    onChange={(e) => setModel(p, e.target.value)}
                    placeholder={info.defaultModel}
                    className="input"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <datalist id={`models-${p}`}>
                    {(fetched[p].kind === "ok"
                      ? (fetched[p] as { models: ProviderModel[] }).models
                      : info.models
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {p === "gemini" && (
                <div className="mt-4 rounded-xl border border-white/5 bg-bg-elevated/50 p-3">
                  <div className="label">인증 방식</div>
                  <div className="flex gap-2">
                    {(
                      [
                        { v: "auto", t: "자동 감지 + 폴백" },
                        { v: "key", t: "API Key (?key=)" },
                        { v: "bearer", t: "OAuth Bearer" },
                      ] as Array<{ v: GeminiAuthMode; t: string }>
                    ).map((opt) => {
                      const active = (settings.geminiAuth ?? "auto") === opt.v;
                      return (
                        <button
                          key={opt.v}
                          onClick={() => update("geminiAuth", opt.v)}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                            active
                              ? "border-brand-500/50 bg-brand-500/15 text-white"
                              : "border-white/10 bg-white/[0.02] text-muted-strong hover:bg-white/[0.05]"
                          }`}
                        >
                          {opt.t}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-muted">
                    자동: 키 포맷을 보고 결정, 401/403 이면 반대 방식으로 재시도. 특정
                    키가 특수한 경우 수동으로 고정해 보세요.
                  </div>
                </div>
              )}

              <FetchStatus state={fetched[p]} />

              <div className="mt-4 flex items-center justify-between">
                <TestStatus state={testState} />
                <button onClick={() => test(p)} className="btn-ghost">
                  {testState.kind === "testing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      테스트 중…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      연결 테스트
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <ImageSection
        value={settings.image}
        onChange={(next) => update("image", next)}
      />

      {savedAt && (
        <div className="text-right text-xs text-muted">
          저장됨 · {new Date(savedAt).toLocaleTimeString()}
        </div>
      )}

      <ProfileSection />
      <PasswordSection />
      {user && <DataBackupSection isOwner={isOwner} />}
    </div>
  );
}

const IMAGE_PROVIDERS: Array<{
  id: ImageProvider;
  label: string;
  desc: string;
  needsKey: boolean;
  keyHint: string;
  consoleUrl?: string;
}> = [
  {
    id: "pollinations",
    label: "Pollinations (무료)",
    desc: "키 불필요. 공개 모델 — 품질은 OpenAI/Google 보다 낮음.",
    needsKey: false,
    keyHint: "",
  },
  {
    id: "openai",
    label: "OpenAI DALL-E 3 (유료)",
    desc: "sk-... 키 필요. 1024x1024 ≈ $0.04.",
    needsKey: true,
    keyHint: "sk-...",
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    label: "Google Imagen 3 (유료)",
    desc: "AIza... 키 필요. 유료 티어 활성화 필수.",
    needsKey: true,
    keyHint: "AIza...",
    consoleUrl: "https://aistudio.google.com/app/apikey",
  },
];

const DEFAULT_IMAGE: ImageSettings = {
  enabled: false,
  provider: "pollinations",
  keys: {},
};

function ImageSection({
  value,
  onChange,
}: {
  value: ImageSettings | undefined;
  onChange: (next: ImageSettings) => void;
}) {
  const s = value ?? DEFAULT_IMAGE;
  const current = IMAGE_PROVIDERS.find((p) => p.id === s.provider)!;
  return (
    <section className="card space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">🖼️ 외부 이미지 생성 (옵션)</h2>
          <p className="mt-1 text-xs text-muted">
            켜면 AI 가 답변에 사진·일러스트가 필요하다고 판단할 때{" "}
            <code className="rounded bg-bg-elevated px-1 text-[11px]">
              ![설명](image-gen:prompt)
            </code>{" "}
            형태로 이미지를 요청하고, 서버가 실제 이미지로 치환합니다. 다이어그램·수식은
            이 설정과 무관하게 mermaid/svg 로 자동 처리됩니다.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => onChange({ ...s, enabled: e.target.checked })}
            className="h-4 w-4 accent-accent-500"
          />
          <span className={s.enabled ? "text-accent-500" : "text-muted"}>
            {s.enabled ? "활성화" : "비활성화"}
          </span>
        </label>
      </div>

      {s.enabled && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {IMAGE_PROVIDERS.map((p) => {
              const active = s.provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onChange({ ...s, provider: p.id })}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-accent-500 bg-accent-500/10"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-1 text-[11px] text-muted">{p.desc}</div>
                </button>
              );
            })}
          </div>

          {current.needsKey && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <Key className="h-3.5 w-3.5" />
                {current.label} API 키
                {current.consoleUrl && (
                  <a
                    href={current.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent-500 hover:underline"
                  >
                    발급 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </label>
              <input
                type="password"
                value={s.keys[s.provider] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...s,
                    keys: { ...s.keys, [s.provider]: e.target.value },
                  })
                }
                placeholder={current.keyHint}
                className="input w-full font-mono text-xs"
                autoComplete="off"
              />
              <p className="text-[10px] text-muted">
                비워 두면 요청 시 Pollinations (무료) 로 자동 폴백합니다.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FetchStatus({ state }: { state: FetchState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") {
    return (
      <div className="mt-2 text-xs text-muted">모델 목록을 불러오는 중…</div>
    );
  }
  if (state.kind === "ok") {
    return (
      <div className="mt-2 text-xs text-accent-500">
        {state.models.length}개 모델을 불러왔습니다. 모델 ID 칸을 클릭하면 목록이
        뜹니다.
      </div>
    );
  }
  return <div className="mt-2 text-xs text-red-400">{state.message}</div>;
}

function TestStatus({ state }: { state: TestState }) {
  if (state.kind === "idle") {
    return (
      <div className="text-xs text-muted">
        키를 입력하고 "연결 테스트"로 상태를 확인하세요.
      </div>
    );
  }
  if (state.kind === "testing") {
    return <div className="text-xs text-muted">응답 대기 중…</div>;
  }
  if (state.kind === "ok") {
    return (
      <div className="flex items-center gap-2 text-xs text-accent-500">
        <Check className="h-3.5 w-3.5" />
        연결 성공 — "{state.sample || "OK"}"
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-red-400">
      <X className="h-3.5 w-3.5" />
      {state.message}
    </div>
  );
}

function placeholderFor(p: ProviderId): string {
  switch (p) {
    case "claude":
      return "sk-ant-...";
    case "gemini":
      return "AIza... (AI Studio) 또는 Bearer 토큰(AQ.*, ya29.*)";
    case "groq":
      return "gsk_...";
  }
}
