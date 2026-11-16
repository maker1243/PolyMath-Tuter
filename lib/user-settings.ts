"use client";

import type { ProviderId } from "./providers";
import type { ImageProvider } from "./image-gen";

export type GeminiAuthMode = "auto" | "key" | "bearer";

export interface ImageSettings {
  enabled: boolean;
  provider: ImageProvider; // openai | google | pollinations
  keys: Partial<Record<ImageProvider, string>>;
}

export interface UserAiSettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  geminiAuth?: GeminiAuthMode;
  image?: ImageSettings;
}

const KEY = "polymath:ai-settings";

const DEFAULT_SETTINGS: UserAiSettings = {
  provider: "claude",
  keys: {},
  models: {},
  geminiAuth: "auto",
  image: {
    enabled: false,
    provider: "pollinations",
    keys: {},
  },
};

export function loadAiSettings(): UserAiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserAiSettings>;
    return {
      provider: parsed.provider ?? "claude",
      keys: parsed.keys ?? {},
      models: parsed.models ?? {},
      geminiAuth: parsed.geminiAuth ?? "auto",
      image: parsed.image ?? DEFAULT_SETTINGS.image,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAiSettings(s: UserAiSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage disabled */
  }
}

/** 서버로 보낼 fetch 바디에 provider/apiKey/model 을 자동 주입합니다. */
export function withAiCredentials<T extends object>(payload: T): T & {
  provider: ProviderId;
  apiKey?: string;
  model?: string;
  geminiAuth?: GeminiAuthMode;
  imageEnabled?: boolean;
  imageProvider?: ImageProvider;
  imageKey?: string;
} {
  const s = loadAiSettings();
  const img = s.image ?? DEFAULT_SETTINGS.image!;
  return {
    ...payload,
    provider: s.provider,
    apiKey: s.keys[s.provider],
    model: s.models[s.provider],
    geminiAuth: s.geminiAuth,
    imageEnabled: img.enabled,
    imageProvider: img.provider,
    imageKey: img.keys[img.provider],
  };
}
