"use client";

const PYODIDE_VERSION = "0.26.4";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;

interface PyProxy {
  install: (name: string | string[]) => Promise<void>;
  destroy?: () => void;
}

interface PyodideModule {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackage: (names: string | string[]) => Promise<void>;
  pyimport: (name: string) => PyProxy;
  loadedPackages: Record<string, string>;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideModule>;
  }
}

let promise: Promise<PyodideModule> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-pyodide="1"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Pyodide 로드 실패")), {
        once: true,
      });
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.dataset.pyodide = "1";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Pyodide 로드 실패"));
    document.head.appendChild(el);
  });
}

export async function getPyodide(): Promise<PyodideModule> {
  if (!promise) {
    promise = (async () => {
      await loadScript(`${CDN}/pyodide.js`);
      if (!window.loadPyodide) throw new Error("loadPyodide 를 찾을 수 없습니다");
      return window.loadPyodide({ indexURL: CDN });
    })();
  }
  return promise;
}

export interface PyRunResult {
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runPython(code: string): Promise<PyRunResult> {
  const start = Date.now();
  const stdout: string[] = [];
  const stderr: string[] = [];
  try {
    const py = await getPyodide();
    py.setStdout({ batched: (s) => stdout.push(s) });
    py.setStderr({ batched: (s) => stderr.push(s) });
    await py.runPythonAsync(code);
    return {
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      stdout: stdout.join("\n"),
      stderr:
        stderr.join("\n") +
        (stderr.length ? "\n" : "") +
        (err instanceof Error ? err.message : String(err)),
      durationMs: Date.now() - start,
    };
  }
}

export interface InstallResult {
  ok: boolean;
  package: string;
  method?: "loadPackage" | "micropip";
  message: string;
  durationMs: number;
}

/**
 * Pyodide 환경에 Python 패키지를 설치합니다.
 * 1) `pyodide.loadPackage` 로 공식 포트 wheel 설치를 먼저 시도
 * 2) 실패하면 `micropip` 로 PyPI 의 순수 Python wheel 설치
 * 설치는 영구적으로 유지됩니다 (같은 Pyodide 인스턴스 사용).
 */
export async function installPackage(name: string): Promise<InstallResult> {
  const start = Date.now();
  const pkg = name.trim();
  if (!pkg) {
    return {
      ok: false,
      package: pkg,
      message: "패키지 이름이 비어있습니다.",
      durationMs: 0,
    };
  }
  try {
    const py = await getPyodide();

    // 1차: Pyodide 공식 포트
    try {
      await py.loadPackage(pkg);
      return {
        ok: true,
        package: pkg,
        method: "loadPackage",
        message: `${pkg} 가 Pyodide 포트에서 설치되었습니다.`,
        durationMs: Date.now() - start,
      };
    } catch (_loadErr) {
      // 2차: micropip 로 PyPI
      await py.loadPackage("micropip");
      const micropip = py.pyimport("micropip");
      await micropip.install(pkg);
      return {
        ok: true,
        package: pkg,
        method: "micropip",
        message: `${pkg} 가 micropip (PyPI) 로 설치되었습니다.`,
        durationMs: Date.now() - start,
      };
    }
  } catch (err) {
    return {
      ok: false,
      package: pkg,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export async function listInstalledPackages(): Promise<Record<string, string>> {
  const py = await getPyodide();
  return { ...py.loadedPackages };
}

/**
 * 추천 패키지 (브라우저 환경에서 잘 돌아가는 것들).
 * Pyodide 포트가 있는 것은 수초 내 설치, PyPI 폴백은 조금 더 걸립니다.
 */
export const SUGGESTED_PACKAGES: Array<{ name: string; description: string }> = [
  { name: "numpy", description: "수치 계산의 기본" },
  { name: "pandas", description: "DataFrame 기반 데이터 분석" },
  { name: "matplotlib", description: "그래프·플롯" },
  { name: "scipy", description: "과학/통계 계산" },
  { name: "sympy", description: "기호 수학" },
  { name: "scikit-learn", description: "전통 머신러닝" },
  { name: "pillow", description: "이미지 처리 (PIL)" },
  { name: "networkx", description: "그래프 이론" },
  { name: "pygame-ce", description: "게임/멀티미디어 (SDL 포팅)" },
  { name: "requests", description: "HTTP 라이브러리 (pyodide-http 필요 시)" },
];
