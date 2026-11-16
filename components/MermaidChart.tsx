"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Code2, Download, Image as ImageIcon } from "lucide-react";
import { ChartCard, HanjaCard, IpaCard, TtsCard } from "./MediaCards";

interface MermaidModule {
  initialize: (config: Record<string, unknown>) => void;
  parse: (source: string, opts?: { suppressErrors?: boolean }) => Promise<unknown>;
  render: (
    id: string,
    source: string,
  ) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
}

let mermaidPromise: Promise<MermaidModule> | null = null;
async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      const mod = (await import("mermaid")).default as unknown as MermaidModule;
      mod.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        themeVariables: {
          primaryColor: "#1b2130",
          primaryTextColor: "#e8ecf4",
          primaryBorderColor: "#5b7cfa",
          lineColor: "#8891a3",
          secondaryColor: "#22d3b4",
          tertiaryColor: "#141821",
          background: "transparent",
        },
      });
      return mod;
    })();
  }
  return mermaidPromise;
}

let idCounter = 0;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${prefix}-${stamp}`;
}

async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const w = Math.max(img.naturalWidth || img.width, 400) * scale;
      const h = Math.max(img.naturalHeight || img.height, 300) * scale;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas context 생성 실패"));
        return;
      }
      ctx.fillStyle = "#0f141c";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("PNG 변환 실패"));
        },
        "image/png",
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 로드 실패"));
    };
    img.src = url;
  });
}

/** AI 가 자주 하는 실수를 자동 교정 (최소한만, 과하지 않게). */
function normalizeMermaidSource(raw: string): string {
  let s = raw.trim();
  // 1) smart quotes → straight
  s = s.replace(/[“”‘’]/g, '"');
  // 2) 이상한 공백 (전각 스페이스, NBSP) → 일반 스페이스
  s = s.replace(/[ 　]/g, " ");
  // 3) 코드 안쪽에 ```mermaid 가 다시 들어있으면 벗기기 (중첩 fence 사고)
  s = s.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/i, "");
  return s.trim();
}

/** mermaid 가 반환한 SVG 가 에러 fallback (폭탄) 인지 감지. */
function isMermaidErrorSvg(svg: string): boolean {
  return /aria-roledescription="error"/i.test(svg) ||
    /class="error-icon"/i.test(svg) ||
    /Syntax error in text/i.test(svg);
}

export function MermaidChart({
  source,
  onRetry,
}: {
  source: string;
  onRetry?: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [savingPng, setSavingPng] = useState(false);
  const idRef = useRef(`mmd-${++idCounter}`);
  const normalized = normalizeMermaidSource(source);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    (async () => {
      try {
        const m = await getMermaid();
        // 1) parse 로 syntax 사전 검증 (실패 시 throw)
        try {
          await m.parse(normalized);
        } catch (parseErr) {
          throw new Error(
            parseErr instanceof Error ? parseErr.message : String(parseErr),
          );
        }
        // 2) render — 그래도 에러 SVG 가 반환될 수 있어 감지
        const { svg } = await m.render(idRef.current, normalized);
        if (cancelled) return;
        if (isMermaidErrorSvg(svg)) {
          throw new Error(
            "mermaid 가 유효한 다이어그램을 그리지 못했습니다 (문법 오류 추정).",
          );
        }
        setSvg(svg);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (error) {
    return (
      <div className="my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            다이어그램 그리기 실패
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-500/20"
              title="AI 에게 다시 그려 달라고 요청"
            >
              🔁 다시 그리기
            </button>
          )}
        </div>
        <div className="mb-2 text-[11px] text-muted">
          AI 가 작성한 mermaid 코드에 문법 오류가 있어요. 오른쪽 {onRetry ? '"다시 그리기"' : "채팅창에서 \"다이어그램만 다시\""} 로
          재요청하면 보통 해결됩니다.
        </div>
        <details className="group">
          <summary className="cursor-pointer text-[10px] text-muted-strong hover:text-white">
            원본 코드 · 에러 보기
          </summary>
          <div className="mt-1 text-[10px] text-muted">{error}</div>
          <pre className="mt-1 overflow-x-auto rounded bg-bg-elevated/60 p-2 font-mono text-[10px] text-muted-strong">
            {source}
          </pre>
        </details>
      </div>
    );
  }

  const handleDownloadSvg = () => {
    if (!svg) return;
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${sanitizeFilename("diagram")}.svg`,
    );
  };

  const handleDownloadPng = async () => {
    if (!svg || savingPng) return;
    try {
      setSavingPng(true);
      const blob = await svgToPng(svg, 2);
      downloadBlob(blob, `${sanitizeFilename("diagram")}.png`);
    } catch (err) {
      console.error("[mermaid png]", err);
    } finally {
      setSavingPng(false);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
        <span>📊 다이어그램</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadSvg}
            disabled={!svg}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="SVG 로 저장 (벡터)"
          >
            <Download className="inline h-3 w-3" /> SVG
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={!svg || savingPng}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="PNG 로 저장 (2x 해상도)"
          >
            <ImageIcon className="inline h-3 w-3" />{" "}
            {savingPng ? "저장 중…" : "PNG"}
          </button>
          <button
            onClick={() => setShowSource((v) => !v)}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
            title="원본 코드 보기"
          >
            <Code2 className="inline h-3 w-3" />
            {showSource ? " 그림" : " 소스"}
          </button>
        </div>
      </div>
      {showSource ? (
        <pre className="overflow-x-auto p-3 font-mono text-[11px] text-muted-strong">
          {source}
        </pre>
      ) : svg ? (
        <div
          className="flex items-center justify-center overflow-x-auto p-3 [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="p-6 text-center text-xs text-muted">그리는 중…</div>
      )}
    </div>
  );
}

/**
 * ```svg ... ``` 블럭을 안전하게 보여주는 카드.
 * AI 가 직접 그린 SVG (수식·커스텀 도형) 를 렌더합니다.
 * - script 태그/on* 핸들러/javascript: URL 은 제거해 XSS 방지
 */
export function SvgCard({ source }: { source: string }) {
  const [showSource, setShowSource] = useState(false);
  const [savingPng, setSavingPng] = useState(false);
  const sanitized = sanitizeSvg(source);

  const handleDownloadSvg = () => {
    downloadBlob(
      new Blob([sanitized], { type: "image/svg+xml;charset=utf-8" }),
      `${sanitizeFilename("drawing")}.svg`,
    );
  };

  const handleDownloadPng = async () => {
    if (savingPng) return;
    try {
      setSavingPng(true);
      const blob = await svgToPng(sanitized, 2);
      downloadBlob(blob, `${sanitizeFilename("drawing")}.png`);
    } catch (err) {
      console.error("[svg png]", err);
    } finally {
      setSavingPng(false);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
        <span>🎨 그림 (SVG)</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadSvg}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
            title="SVG 로 저장"
          >
            <Download className="inline h-3 w-3" /> SVG
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={savingPng}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="PNG 로 저장 (2x)"
          >
            <ImageIcon className="inline h-3 w-3" />{" "}
            {savingPng ? "저장 중…" : "PNG"}
          </button>
          <button
            onClick={() => setShowSource((v) => !v)}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
            title="원본 코드 보기"
          >
            <Code2 className="inline h-3 w-3" />
            {showSource ? " 그림" : " 소스"}
          </button>
        </div>
      </div>
      {showSource ? (
        <pre className="overflow-x-auto p-3 font-mono text-[11px] text-muted-strong">
          {source}
        </pre>
      ) : (
        <div
          className="flex items-center justify-center overflow-x-auto p-3 [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </div>
  );
}

/** 생성된 이미지 (data URL / 외부 URL) 를 보여주는 카드. */
export function GeneratedImageCard({
  src,
  alt,
  caption,
}: {
  src: string;
  alt?: string;
  caption?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      downloadBlob(blob, `${sanitizeFilename("image")}.${ext}`);
    } catch (err) {
      console.error("[image download]", err);
    }
  };

  return (
    <>
      <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
          <span>🖼️ 이미지</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoomed(true)}
              disabled={!loaded}
              className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="크게 보기"
            >
              <ImageIcon className="inline h-3 w-3" /> 크게
            </button>
            <button
              onClick={handleDownload}
              disabled={!loaded}
              className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="이미지 저장"
            >
              <Download className="inline h-3 w-3" /> 저장
            </button>
          </div>
        </div>
        <div className="relative p-3">
          {!loaded && !failed && (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-xs text-muted">
              <div className="animate-pulse">🎨 이미지 생성 중…</div>
              <div className="text-[10px]">
                무료 공급자는 10–30초 걸릴 수 있어요
              </div>
            </div>
          )}
          {failed && (
            <div className="flex h-28 items-center justify-center gap-2 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              이미지 로드 실패 — 네트워크를 확인해 주세요
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? ""}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            onClick={() => loaded && setZoomed(true)}
            className={`mx-auto cursor-zoom-in rounded-md transition hover:opacity-90 ${
              loaded ? "block max-w-full" : "hidden"
            }`}
          />
          {caption && loaded && (
            <div className="mt-2 text-center text-[10px] text-muted">
              {caption}
            </div>
          )}
        </div>
      </div>

      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
          role="button"
          aria-label="이미지 닫기"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? ""}
            style={{ maxHeight: "90vh", maxWidth: "min(90vw, 1200px)" }}
            className="h-auto w-auto rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {caption && (
            <div className="mt-3 text-center text-sm text-white/80">
              {caption}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(false);
            }}
            className="fixed right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80"
          >
            ✕ 닫기
          </button>
        </div>
      )}
    </>
  );
}

/**
 * 아주 간단한 SVG 새니타이저.
 * - <script> 블럭 제거
 * - on* 이벤트 핸들러 속성 제거
 * - href/xlink:href 안의 javascript: 제거
 * - <foreignObject> 제거 (HTML 삽입 벡터)
 */
function sanitizeSvg(input: string): string {
  let s = input;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/(xlink:href|href)\s*=\s*"\s*javascript:[^"]*"/gi, 'href="#"');
  s = s.replace(/(xlink:href|href)\s*=\s*'\s*javascript:[^']*'/gi, "href='#'");
  return s;
}

/* ========================================================================
 * PlotCard — 수학 함수 그래프 (y = f(x))
 * ======================================================================== */

interface PlotSpec {
  functions: Array<{ expr: string; label: string; color: string }>;
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  title?: string;
}

const PLOT_COLORS = ["#5b7cfa", "#22d3b4", "#f59e0b", "#ec4899", "#a78bfa"];

/**
 * 라인에서 인라인 주석 (`# ...` 또는 `// ...`) 을 분리.
 * 주석 텍스트는 범례 라벨로 쓰임.
 */
function splitInlineComment(line: string): { body: string; comment?: string } {
  // # 또는 // 로 시작하는 꼬리 주석
  const m = line.match(/^(.*?)\s*(?:#|\/\/)\s*(.+?)\s*$/);
  if (m && m[1].trim().length > 0) {
    return { body: m[1].trim(), comment: m[2].trim() };
  }
  return { body: line.trim() };
}

/** `y = x^2`, `f(x) = sin(x)`, `g(x) = x^3-2*x`, `x: -5 to 5` 등을 파싱. */
function parsePlotSpec(raw: string): PlotSpec {
  const rawLines = raw.split(/\r?\n/).map((l) => l.trim());
  const functions: PlotSpec["functions"] = [];
  let xMin = -10;
  let xMax = 10;
  let yMin: number | undefined;
  let yMax: number | undefined;
  let title: string | undefined;

  for (const rawLine of rawLines) {
    // 완전 주석 라인 (`# 설명` 또는 `// 설명` 단독) 은 건너뜀
    if (!rawLine || /^(#|\/\/)/.test(rawLine)) continue;

    // 인라인 주석 분리 — 주석 텍스트는 라벨 후보로 보존
    const { body: line, comment: userLabel } = splitInlineComment(rawLine);
    if (!line) continue;

    // range: "x: -5 to 5" 또는 "x: -5..5" 또는 "x in [-5, 5]"
    const xRange =
      line.match(/^x\s*:\s*(-?\d*\.?\d+)\s*(?:to|\.\.|-)\s*(-?\d*\.?\d+)/i) ||
      line.match(/^x\s*(?:in|=)\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/i);
    if (xRange) {
      xMin = parseFloat(xRange[1]);
      xMax = parseFloat(xRange[2]);
      continue;
    }
    const yRange =
      line.match(/^y\s*:\s*(-?\d*\.?\d+)\s*(?:to|\.\.|-)\s*(-?\d*\.?\d+)/i) ||
      line.match(/^y\s*(?:in|=)\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/i);
    if (yRange) {
      yMin = parseFloat(yRange[1]);
      yMax = parseFloat(yRange[2]);
      continue;
    }
    const titleMatch = line.match(/^title\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    // "f(x) = expr", "g(x) = expr" 같은 함수 호출 형태
    const fnCallMatch = line.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
    if (fnCallMatch) {
      const fnName = `${fnCallMatch[1]}(x)`;
      const label = userLabel ? `${userLabel}  (${fnName})` : fnName;
      functions.push({
        expr: fnCallMatch[2].trim(),
        label,
        color: PLOT_COLORS[functions.length % PLOT_COLORS.length],
      });
      continue;
    }
    // "y = expr", "y1 = expr", "y_1 = expr", "h = expr" 같은 좌변 변수 형태
    // (단, 설정 라인 title/range 는 위에서 걸러졌음; x 좌변은 range 가 먼저 집음)
    const varMatch = line.match(/^([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (varMatch && varMatch[1].toLowerCase() !== "x") {
      const fnName = varMatch[1];
      const label = userLabel ? `${userLabel}  (${fnName})` : fnName;
      functions.push({
        expr: varMatch[2].trim(),
        label,
        color: PLOT_COLORS[functions.length % PLOT_COLORS.length],
      });
      continue;
    }
    // 라벨 없는 단독 수식 (예: `sin(x)`, `x^2`)
    if (!/^(x|title|range)\s*[:=]/i.test(line)) {
      const fnName = `f${functions.length + 1}(x)`;
      const label = userLabel ? `${userLabel}  (${fnName})` : fnName;
      functions.push({
        expr: line,
        label,
        color: PLOT_COLORS[functions.length % PLOT_COLORS.length],
      });
    }
  }
  return { functions, xMin, xMax, yMin, yMax, title };
}

/**
 * 안전한 수학 표현식 평가.
 * - 허용: 숫자, 연산자, 괄호, x, 공통 Math 함수·상수
 * - 금지: 다른 식별자 (window, this, eval, …) → null 반환
 */
function compileExpression(expr: string): ((x: number) => number) | null {
  // `^` 거듭제곱 → `**`
  let body = expr.replace(/\^/g, "**");
  // 암시적 곱셈 보강: `2x` → `2*x`, `)x` → `)*x`, `x(` → `x*(`
  body = body.replace(/(\d)([a-zA-Z(])/g, "$1*$2");
  body = body.replace(/\)(\d|[a-zA-Z(])/g, ")*$1");
  // `pi`, `π`, `e` 상수 치환
  body = body.replace(/\bπ\b/g, "Math.PI").replace(/\bpi\b/gi, "Math.PI");
  // `e` 는 단독 토큰일 때만 (지수표기 `1e5` 는 유지)
  body = body.replace(/(?<![\w.])e(?![\w+-])/gi, "Math.E");
  // 수학 함수 자동 Math. 프리픽스
  const MATH_FNS = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "atan2",
    "sinh",
    "cosh",
    "tanh",
    "log",
    "log2",
    "log10",
    "exp",
    "sqrt",
    "cbrt",
    "abs",
    "floor",
    "ceil",
    "round",
    "sign",
    "min",
    "max",
    "pow",
  ];
  for (const fn of MATH_FNS) {
    body = body.replace(
      new RegExp(`(?<![\\w.])${fn}\\s*\\(`, "g"),
      `Math.${fn}(`,
    );
  }
  // 보안 검증: 허용 문자/토큰만
  // 숫자, 연산자, 괄호, 공백, 콤마, 점, x, Math.*
  const safe = body.replace(/Math\.\w+/g, "").replace(/\bx\b/g, "");
  if (!/^[\d+\-*/%(),.\s]*$/.test(safe)) {
    return null; // 금지된 식별자 포함
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = new Function("x", `"use strict"; return (${body});`) as (
      x: number,
    ) => number;
    // 테스트 호출로 syntax error 조기 감지
    fn(0);
    return fn;
  } catch {
    return null;
  }
}

export function PlotCard({ source }: { source: string }) {
  const [showSource, setShowSource] = useState(false);
  const [savingPng, setSavingPng] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const spec = parsePlotSpec(source);
  const W = 560;
  const H = 360;
  const PAD = 40;

  // 각 함수 샘플링 + 유효 좌표만 수집
  const compiled = spec.functions.map((f) => ({
    ...f,
    fn: compileExpression(f.expr),
  }));

  const invalid = compiled.filter((f) => f.fn === null);

  const SAMPLES = 400;
  const allSamples = compiled.map((f) => {
    if (!f.fn) return { pts: [] as Array<[number, number]> };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = spec.xMin + ((spec.xMax - spec.xMin) * i) / SAMPLES;
      try {
        const y = f.fn(x);
        if (Number.isFinite(y)) pts.push([x, y]);
      } catch {
        /* skip */
      }
    }
    return { pts };
  });

  // Y 범위 자동 결정 (지정 안 됐을 때)
  let yMin = spec.yMin;
  let yMax = spec.yMax;
  if (yMin === undefined || yMax === undefined) {
    const ys = allSamples.flatMap((s) => s.pts.map((p) => p[1]));
    if (ys.length > 0) {
      ys.sort((a, b) => a - b);
      // 상·하위 2% 트리밍 (극단값 완화)
      const lo = ys[Math.floor(ys.length * 0.02)];
      const hi = ys[Math.floor(ys.length * 0.98)];
      const pad = Math.max((hi - lo) * 0.1, 0.5);
      yMin = yMin ?? lo - pad;
      yMax = yMax ?? hi + pad;
    } else {
      yMin = yMin ?? -5;
      yMax = yMax ?? 5;
    }
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const sx = (x: number) =>
    PAD + ((x - spec.xMin) / (spec.xMax - spec.xMin)) * (W - 2 * PAD);
  const sy = (y: number) =>
    H - PAD - ((y - yMin!) / (yMax! - yMin!)) * (H - 2 * PAD);

  // 깔끔한 눈금 간격 (nice numbers)
  const niceStep = (range: number) => {
    const rough = range / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return nice * mag;
  };
  const xStep = niceStep(spec.xMax - spec.xMin);
  const yStep = niceStep(yMax - yMin);

  const xTicks: number[] = [];
  for (
    let t = Math.ceil(spec.xMin / xStep) * xStep;
    t <= spec.xMax + 1e-9;
    t += xStep
  )
    xTicks.push(Number(t.toFixed(10)));
  const yTicks: number[] = [];
  for (
    let t = Math.ceil(yMin / yStep) * yStep;
    t <= yMax + 1e-9;
    t += yStep
  )
    yTicks.push(Number(t.toFixed(10)));

  // 폴리라인: 함수가 연속적이지 않으면 끊어서 그리기
  const buildPolyline = (pts: Array<[number, number]>): string[] => {
    const paths: string[] = [];
    let current: string[] = [];
    const yRange = yMax! - yMin!;
    const yJumpLimit = yRange * 0.5;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      // 뷰포트 바깥은 폴리라인에서 끊기
      if (y < yMin! - yRange || y > yMax! + yRange) {
        if (current.length > 1) paths.push(current.join(" "));
        current = [];
        continue;
      }
      // 급격한 점프 (불연속 함수 추정) → 끊기
      if (
        i > 0 &&
        pts[i - 1] &&
        Math.abs(y - pts[i - 1][1]) > yJumpLimit
      ) {
        if (current.length > 1) paths.push(current.join(" "));
        current = [];
      }
      current.push(`${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
    }
    if (current.length > 1) paths.push(current.join(" "));
    return paths;
  };

  const serializeSvg = (): string | null => {
    const el = svgRef.current;
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  };

  const handleDownloadSvg = () => {
    const svg = serializeSvg();
    if (!svg) return;
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${sanitizeFilename("plot")}.svg`,
    );
  };

  const handleDownloadPng = async () => {
    const svg = serializeSvg();
    if (!svg || savingPng) return;
    try {
      setSavingPng(true);
      const blob = await svgToPng(svg, 2);
      downloadBlob(blob, `${sanitizeFilename("plot")}.png`);
    } catch (err) {
      console.error("[plot png]", err);
    } finally {
      setSavingPng(false);
    }
  };

  if (spec.functions.length === 0 || compiled.every((f) => f.fn === null)) {
    return (
      <div className="my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <div className="mb-1 flex items-center gap-1 text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          그래프 그리기 실패
        </div>
        <div className="text-[11px] text-muted">
          plot 블럭에서 유효한 함수를 찾지 못했어요. 예: <code>y = x^2</code> 또는{" "}
          <code>f(x) = sin(x)</code>. 변수는 <code>x</code> 만, 함수는{" "}
          <code>sin/cos/tan/log/exp/sqrt/abs</code> 등을 쓸 수 있어요.
        </div>
        {invalid.length > 0 && (
          <div className="mt-1 text-[10px] text-amber-200">
            거부된 식: {invalid.map((f) => `"${f.expr}"`).join(", ")}
          </div>
        )}
        <pre className="mt-2 overflow-x-auto rounded bg-bg-elevated/60 p-2 font-mono text-[10px] text-muted-strong">
          {source}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
        <span>📈 함수 그래프{spec.title ? ` — ${spec.title}` : ""}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadSvg}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
            title="SVG 로 저장"
          >
            <Download className="inline h-3 w-3" /> SVG
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={savingPng}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white disabled:opacity-40"
            title="PNG 로 저장 (2x)"
          >
            <ImageIcon className="inline h-3 w-3" />{" "}
            {savingPng ? "저장 중…" : "PNG"}
          </button>
          <button
            onClick={() => setShowSource((v) => !v)}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
            title="원본 코드"
          >
            <Code2 className="inline h-3 w-3" />
            {showSource ? " 그림" : " 소스"}
          </button>
        </div>
      </div>
      {showSource ? (
        <pre className="overflow-x-auto p-3 font-mono text-[11px] text-muted-strong">
          {source}
        </pre>
      ) : (
        <div className="overflow-x-auto p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto block max-w-full"
            style={{ background: "transparent" }}
          >
            {/* 그리드 */}
            {xTicks.map((t) => (
              <line
                key={`gx-${t}`}
                x1={sx(t)}
                x2={sx(t)}
                y1={PAD}
                y2={H - PAD}
                stroke="#2a3140"
                strokeWidth="1"
              />
            ))}
            {yTicks.map((t) => (
              <line
                key={`gy-${t}`}
                x1={PAD}
                x2={W - PAD}
                y1={sy(t)}
                y2={sy(t)}
                stroke="#2a3140"
                strokeWidth="1"
              />
            ))}
            {/* x=0, y=0 축 (viewport 안쪽일 때만) */}
            {yMin! <= 0 && yMax! >= 0 && (
              <line
                x1={PAD}
                x2={W - PAD}
                y1={sy(0)}
                y2={sy(0)}
                stroke="#8891a3"
                strokeWidth="1.5"
              />
            )}
            {spec.xMin <= 0 && spec.xMax >= 0 && (
              <line
                x1={sx(0)}
                x2={sx(0)}
                y1={PAD}
                y2={H - PAD}
                stroke="#8891a3"
                strokeWidth="1.5"
              />
            )}
            {/* 외곽 */}
            <rect
              x={PAD}
              y={PAD}
              width={W - 2 * PAD}
              height={H - 2 * PAD}
              fill="none"
              stroke="#4a5365"
              strokeWidth="1"
            />
            {/* x 축 눈금 라벨 */}
            {xTicks.map((t) => (
              <text
                key={`xl-${t}`}
                x={sx(t)}
                y={H - PAD + 14}
                fill="#8891a3"
                fontSize="10"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {+t.toFixed(3)}
              </text>
            ))}
            {/* y 축 눈금 라벨 */}
            {yTicks.map((t) => (
              <text
                key={`yl-${t}`}
                x={PAD - 6}
                y={sy(t) + 3}
                fill="#8891a3"
                fontSize="10"
                textAnchor="end"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {+t.toFixed(3)}
              </text>
            ))}
            {/* 함수 곡선들 */}
            {allSamples.map((s, idx) => {
              const f = compiled[idx];
              if (!f.fn) return null;
              return buildPolyline(s.pts).map((pts, i) => (
                <polyline
                  key={`fn-${idx}-${i}`}
                  points={pts}
                  fill="none"
                  stroke={f.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ));
            })}
            {/* 범례 */}
            {compiled.map((f, idx) => (
              <g key={`lg-${idx}`}>
                <line
                  x1={W - PAD - 110}
                  x2={W - PAD - 90}
                  y1={PAD + 12 + idx * 14}
                  y2={PAD + 12 + idx * 14}
                  stroke={f.fn ? f.color : "#555"}
                  strokeWidth="2"
                />
                <text
                  x={W - PAD - 85}
                  y={PAD + 12 + idx * 14 + 3}
                  fill="#e8ecf4"
                  fontSize="11"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {f.label} = {f.expr}
                  {!f.fn && " ⚠"}
                </text>
              </g>
            ))}
          </svg>
          {invalid.length > 0 && (
            <div className="mt-2 text-center text-[10px] text-amber-300">
              ⚠ 거부된 식: {invalid.map((f) => `"${f.expr}"`).join(", ")} —
              허용되지 않은 식별자가 포함되었습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 문자열에서 ```mermaid / ```svg / ```plot 블럭 + ![alt](data:image/... | http...) 를
 * React 요소 배열로 분해. 나머지는 텍스트.
 * - onDiagramRetry: mermaid 렌더 실패 시 "다시 그리기" 버튼 클릭 핸들러
 */
export function renderWithMermaid(
  text: string,
  opts?: { onDiagramRetry?: () => void },
): React.ReactNode[] {
  // 1) mermaid / svg / plot / chart / tts / ipa / hanja 코드 블럭
  const codeRe = /```(mermaid|svg|plot|chart|tts|ipa|hanja)\s+([\s\S]*?)```/g;
  // 2) 이미지 마크다운: ![alt](data:... 또는 http(s)://...)
  const imgRe = /!\[([^\]]*)\]\((data:image\/[a-zA-Z+.-]+;base64,[^)\s]+|https?:\/\/[^)\s]+)\)/g;

  interface Match {
    start: number;
    end: number;
    kind:
      | "mermaid"
      | "svg"
      | "plot"
      | "chart"
      | "tts"
      | "ipa"
      | "hanja"
      | "image";
    body: string;
    alt?: string;
  }
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      kind: m[1] as
        | "mermaid"
        | "svg"
        | "plot"
        | "chart"
        | "tts"
        | "ipa"
        | "hanja",
      body: m[2],
    });
  }
  while ((m = imgRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      kind: "image",
      body: m[2],
      alt: m[1],
    });
  }
  matches.sort((a, b) => a.start - b.start);

  // 겹치는 매치 제거 (앞선 것 우선)
  const resolved: Match[] = [];
  let cursor = 0;
  for (const mm of matches) {
    if (mm.start < cursor) continue;
    resolved.push(mm);
    cursor = mm.end;
  }

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const mm of resolved) {
    if (mm.start > last) {
      nodes.push(
        <span key={`t${key++}`}>{text.slice(last, mm.start)}</span>,
      );
    }
    if (mm.kind === "mermaid") {
      nodes.push(
        <MermaidChart
          key={`m${key++}`}
          source={mm.body}
          onRetry={opts?.onDiagramRetry}
        />,
      );
    } else if (mm.kind === "svg") {
      nodes.push(<SvgCard key={`s${key++}`} source={mm.body} />);
    } else if (mm.kind === "plot") {
      nodes.push(<PlotCard key={`p${key++}`} source={mm.body} />);
    } else if (mm.kind === "chart") {
      nodes.push(<ChartCard key={`c${key++}`} source={mm.body} />);
    } else if (mm.kind === "tts") {
      nodes.push(<TtsCard key={`t${key++}`} source={mm.body} />);
    } else if (mm.kind === "ipa") {
      nodes.push(<IpaCard key={`i${key++}`} source={mm.body} />);
    } else if (mm.kind === "hanja") {
      nodes.push(<HanjaCard key={`h${key++}`} source={mm.body} />);
    } else {
      nodes.push(
        <GeneratedImageCard
          key={`i${key++}`}
          src={mm.body}
          alt={mm.alt}
          caption={mm.alt || undefined}
        />,
      );
    }
    last = mm.end;
  }
  if (last < text.length) {
    nodes.push(<span key={`t${key++}`}>{text.slice(last)}</span>);
  }
  return nodes.length > 0 ? nodes : [<span key="t0">{text}</span>];
}
