"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Code2,
  Download,
  Image as ImageIcon,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import {
  TTS_LANGUAGES,
  cancelSpeech,
  isTtsAvailable,
  speak,
} from "@/lib/tts";

/* ========================================================================
 * TtsCard — 어학용 음성 재생
 * ======================================================================== */

function parseTtsBlock(raw: string): {
  lang: string;
  text: string;
  translation?: string;
} {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  let lang = "en-US";
  const bodyLines: string[] = [];
  let translation: string | undefined;
  for (const line of lines) {
    if (!line) continue;
    const langMatch = line.match(/^lang\s*:\s*([a-zA-Z-]{2,10})/i);
    if (langMatch) {
      lang = langMatch[1];
      continue;
    }
    const trMatch = line.match(/^(?:tr|번역|translation)\s*:\s*(.+)$/i);
    if (trMatch) {
      translation = trMatch[1].trim();
      continue;
    }
    bodyLines.push(line);
  }
  return { lang, text: bodyLines.join("\n").trim(), translation };
}

export function TtsCard({ source }: { source: string }) {
  const { lang, text, translation } = parseTtsBlock(source);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const available = isTtsAvailable();
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const langInfo = TTS_LANGUAGES.find((l) => l.code === lang)
    ?? TTS_LANGUAGES.find((l) => l.code.startsWith(lang.split("-")[0]));

  useEffect(() => {
    return () => {
      if (playing) cancelSpeech();
    };
  }, [playing]);

  const handlePlay = () => {
    if (!available || !text) return;
    const u = speak(text, { lang, rate });
    if (!u) return;
    utterRef.current = u;
    setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
  };

  const handleStop = () => {
    cancelSpeech();
    setPlaying(false);
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
        <span>
          🗣️ 음성{" "}
          <span className="text-muted-strong">
            {langInfo ? `${langInfo.flag} ${langInfo.label}` : lang}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <label
            className="inline-flex items-center gap-1 text-[10px]"
            title="재생 속도"
          >
            속도
            <select
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="rounded bg-bg-elevated/60 px-1 py-0.5 text-[10px] text-white"
            >
              <option value={0.5}>0.5×</option>
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
            </select>
          </label>
          {playing ? (
            <button
              onClick={handleStop}
              className="rounded px-1.5 py-0.5 text-rose-200 hover:bg-rose-500/20"
              title="정지"
            >
              <Pause className="inline h-3 w-3" /> 정지
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={!available || !text}
              className="rounded px-1.5 py-0.5 text-accent-500 hover:bg-accent-500/20 disabled:opacity-40"
              title="재생"
            >
              <Play className="inline h-3 w-3" /> 재생
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 p-3">
        {!available && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            이 브라우저는 Web Speech API 를 지원하지 않습니다.
          </div>
        )}
        <div
          className="whitespace-pre-wrap text-lg text-white"
          lang={lang}
          dir="auto"
        >
          {text}
        </div>
        {translation && (
          <div className="border-t border-white/5 pt-2 text-xs text-muted">
            {translation}
          </div>
        )}
        <button
          onClick={playing ? handleStop : handlePlay}
          disabled={!available || !text}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-bg-elevated/40 px-2 py-0.5 text-[10px] text-muted hover:border-accent-500/40 hover:text-accent-500 disabled:opacity-40"
        >
          <Volume2 className="h-3 w-3" />
          {playing ? "정지" : "다시 듣기"}
        </button>
      </div>
    </div>
  );
}

/* ========================================================================
 * HanjaCard — 한문 지문 (원문 + 음독 + 번역 + 주해) · 또는 단일 한자 카드
 * ======================================================================== */

interface HanjaBlock {
  mode: "passage" | "character";
  title?: string;
  original?: string; // 原: 한자 원문
  reading?: string; // 音: 한국 한자음
  pinyin?: string; // 拼音: 중국어 병음
  translation?: string; // 訓/譯: 한국어 번역
  note?: string; // 註: 주해
  // character 모드 전용
  character?: string; // 한자 1자
  radical?: string; // 部首
  strokes?: number; // 畫
  meaning?: string; // 뜻 (= reading 과 함께 "배울 학" 식으로)
}

function parseHanjaBlock(raw: string): HanjaBlock {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const b: HanjaBlock = { mode: "passage" };
  const KEYS: Record<string, keyof HanjaBlock> = {
    title: "title",
    제목: "title",
    original: "original",
    原: "original",
    원문: "original",
    原文: "original",
    reading: "reading",
    音: "reading",
    음: "reading",
    음독: "reading",
    pinyin: "pinyin",
    拼音: "pinyin",
    병음: "pinyin",
    translation: "translation",
    訓: "translation",
    훈: "translation",
    譯: "translation",
    역: "translation",
    번역: "translation",
    note: "note",
    註: "note",
    注: "note",
    주: "note",
    주해: "note",
    character: "character",
    字: "character",
    한자: "character",
    radical: "radical",
    部首: "radical",
    부수: "radical",
    strokes: "strokes",
    畫: "strokes",
    획: "strokes",
    획수: "strokes",
    meaning: "meaning",
    뜻: "meaning",
  };
  for (const line of lines) {
    const m = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    const field = KEYS[key] || KEYS[key.toLowerCase()];
    if (!field) continue;
    if (field === "strokes") {
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) b.strokes = n;
    } else {
      (b as unknown as Record<string, string>)[field] = val;
    }
  }
  if (b.character && !b.original) b.mode = "character";
  return b;
}

function HanjaPassage({ b }: { b: HanjaBlock }) {
  const [playing, setPlaying] = useState(false);
  const available = isTtsAvailable();
  const handlePlay = (text: string, lang: string) => {
    const u = speak(text, { lang, rate: 0.85 });
    if (!u) return;
    setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
  };
  const handleStop = () => {
    cancelSpeech();
    setPlaying(false);
  };
  return (
    <div className="space-y-3 p-4">
      {b.original && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted">原文</span>
            {available && (
              <button
                onClick={() =>
                  playing ? handleStop() : handlePlay(b.original!, "zh-CN")
                }
                className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted hover:border-accent-500/40 hover:text-accent-500"
                title="중국어 발음으로 듣기"
              >
                {playing ? "⏸ 정지" : "🔊 중국어 음"}
              </button>
            )}
          </div>
          <div
            className="whitespace-pre-wrap font-serif text-2xl leading-relaxed text-white"
            lang="zh-Hant"
            style={{ letterSpacing: "0.05em" }}
          >
            {b.original}
          </div>
        </div>
      )}
      {b.reading && (
        <div className="space-y-0.5 border-t border-white/5 pt-2">
          <div className="text-[10px] text-muted">音讀 (한국 한자음)</div>
          <div className="text-sm text-muted-strong">{b.reading}</div>
        </div>
      )}
      {b.pinyin && (
        <div className="space-y-0.5 border-t border-white/5 pt-2">
          <div className="text-[10px] text-muted">拼音 (현대 중국어)</div>
          <div className="text-sm text-muted-strong">{b.pinyin}</div>
        </div>
      )}
      {b.translation && (
        <div className="space-y-0.5 border-t border-white/5 pt-2">
          <div className="text-[10px] text-muted">譯 (한국어)</div>
          <div className="text-sm text-white">{b.translation}</div>
        </div>
      )}
      {b.note && (
        <div className="space-y-0.5 border-t border-white/5 pt-2">
          <div className="text-[10px] text-muted">註 (주해)</div>
          <div className="text-xs text-muted-strong">{b.note}</div>
        </div>
      )}
    </div>
  );
}

function HanjaCharacter({ b }: { b: HanjaBlock }) {
  const [playing, setPlaying] = useState(false);
  const available = isTtsAvailable();
  const handlePlay = () => {
    if (!b.character) return;
    const u = speak(b.character, { lang: "zh-CN", rate: 0.8 });
    if (!u) return;
    setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
  };
  return (
    <div className="flex gap-4 p-4">
      <div className="flex flex-col items-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-xl border border-white/10 bg-bg-elevated/50 font-serif text-6xl text-white"
          lang="zh-Hant"
        >
          {b.character}
        </div>
        {available && (
          <button
            onClick={playing ? () => cancelSpeech() : handlePlay}
            className="mt-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted hover:border-accent-500/40 hover:text-accent-500"
            title="중국어 발음"
          >
            {playing ? "⏸" : "🔊"} 음
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2 text-sm">
        {b.reading && (
          <div>
            <span className="mr-2 text-[10px] text-muted">音</span>
            <span className="text-white">{b.reading}</span>
            {b.meaning && (
              <span className="ml-1 text-muted-strong"> · {b.meaning}</span>
            )}
          </div>
        )}
        {b.pinyin && (
          <div>
            <span className="mr-2 text-[10px] text-muted">拼音</span>
            <span className="text-muted-strong">{b.pinyin}</span>
          </div>
        )}
        {b.radical && (
          <div>
            <span className="mr-2 text-[10px] text-muted">部首</span>
            <span className="text-muted-strong">{b.radical}</span>
          </div>
        )}
        {typeof b.strokes === "number" && (
          <div>
            <span className="mr-2 text-[10px] text-muted">畫</span>
            <span className="text-muted-strong">{b.strokes}획</span>
          </div>
        )}
        {b.note && (
          <div className="border-t border-white/5 pt-2 text-xs text-muted">
            {b.note}
          </div>
        )}
      </div>
    </div>
  );
}

export function HanjaCard({ source }: { source: string }) {
  const b = parseHanjaBlock(source);
  const empty =
    !b.original && !b.character && !b.reading && !b.translation && !b.note;
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
        <span>
          🀄 {b.mode === "character" ? "한자" : "한문"}
          {b.title ? ` — ${b.title}` : ""}
        </span>
      </div>
      {empty ? (
        <div className="p-3 text-[11px] text-amber-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          한문 블럭에 내용이 없습니다. 예: <code>原: 學而時習之</code>,{" "}
          <code>音: 학이시습지</code>, <code>譯: 배우고 때로 익히면…</code>
        </div>
      ) : b.mode === "character" ? (
        <HanjaCharacter b={b} />
      ) : (
        <HanjaPassage b={b} />
      )}
    </div>
  );
}

/* ========================================================================
 * IpaCard — 어학용 발음 기호 (IPA)
 * ======================================================================== */

export function IpaCard({ source }: { source: string }) {
  // ```ipa /həˈloʊ/ 또는 여러 줄
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className="my-2 rounded-xl border border-white/5 bg-bg-elevated/40 px-3 py-2">
      <div className="mb-1 text-[10px] text-muted">🔤 발음 (IPA)</div>
      <div className="space-y-0.5 font-serif text-xl text-white">
        {lines.map((l, i) => (
          <div key={i} dir="ltr">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================
 * ChartCard — 경제·통계용 데이터 차트 (bar / pie / scatter / line)
 * ======================================================================== */

interface ChartSpec {
  type: "bar" | "pie" | "scatter" | "line";
  title?: string;
  xlabel?: string;
  ylabel?: string;
  labels: string[];
  values: number[];
  points: Array<[number, number]>;
  rawColors?: string[];
}

const CHART_COLORS = [
  "#5b7cfa",
  "#22d3b4",
  "#f59e0b",
  "#ec4899",
  "#a78bfa",
  "#38bdf8",
  "#fb7185",
  "#4ade80",
];

function parseChartSpec(raw: string): ChartSpec {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const spec: ChartSpec = {
    type: "bar",
    labels: [],
    values: [],
    points: [],
  };
  let inDataBlock = false;
  const dataBuffer: string[] = [];
  for (const line of lines) {
    if (!line || /^(#|\/\/)/.test(line)) continue;
    if (inDataBlock) {
      // "- a, b" 또는 "a, b" 또는 "a: b" 포맷
      const stripped = line.replace(/^-\s*/, "");
      dataBuffer.push(stripped);
      continue;
    }
    const typeMatch = line.match(/^type\s*:\s*(\w+)/i);
    if (typeMatch) {
      const t = typeMatch[1].toLowerCase();
      if (t === "bar" || t === "pie" || t === "scatter" || t === "line")
        spec.type = t;
      continue;
    }
    const titleMatch = line.match(/^title\s*:\s*(.+)$/i);
    if (titleMatch) {
      spec.title = titleMatch[1].trim();
      continue;
    }
    const xlabel = line.match(/^xlabel\s*:\s*(.+)$/i);
    if (xlabel) {
      spec.xlabel = xlabel[1].trim();
      continue;
    }
    const ylabel = line.match(/^ylabel\s*:\s*(.+)$/i);
    if (ylabel) {
      spec.ylabel = ylabel[1].trim();
      continue;
    }
    const labelsMatch = line.match(/^labels\s*:\s*(.+)$/i);
    if (labelsMatch) {
      spec.labels = labelsMatch[1].split(",").map((s) => s.trim());
      continue;
    }
    const dataLineMatch = line.match(/^data\s*:\s*(.+)$/i);
    if (dataLineMatch) {
      const inline = dataLineMatch[1].trim();
      if (inline.length > 0) {
        if (spec.type === "scatter") {
          // "data: 1,2 3,4 ..." 는 비정상, 아래 블럭으로
          dataBuffer.push(inline);
        } else {
          spec.values = inline
            .split(/[,\s]+/)
            .map(parseFloat)
            .filter((v) => Number.isFinite(v));
        }
      } else {
        inDataBlock = true;
      }
      continue;
    }
    // "labels" 선언 없이 "서울: 48" 같은 라인
    const kvMatch = line.match(/^([^:,]+?)\s*[:,]\s*(-?\d+(?:\.\d+)?)/);
    if (kvMatch && (spec.type === "bar" || spec.type === "pie")) {
      spec.labels.push(kvMatch[1].trim());
      spec.values.push(parseFloat(kvMatch[2]));
      continue;
    }
  }
  // 데이터 블럭 처리
  if (dataBuffer.length > 0) {
    if (spec.type === "scatter" || spec.type === "line") {
      for (const line of dataBuffer) {
        const parts = line
          .split(/[,\s]+/)
          .map(parseFloat)
          .filter((v) => Number.isFinite(v));
        if (parts.length >= 2) spec.points.push([parts[0], parts[1]]);
      }
    } else {
      for (const line of dataBuffer) {
        const kv = line.match(/^(.+?)\s*[:,]\s*(-?\d+(?:\.\d+)?)/);
        if (kv) {
          spec.labels.push(kv[1].trim());
          spec.values.push(parseFloat(kv[2]));
        }
      }
    }
  }
  return spec;
}

function niceStep(range: number): number {
  const rough = range / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

export function ChartCard({ source }: { source: string }) {
  const spec = parseChartSpec(source);
  const W = 560;
  const H = 360;
  const PAD = 50;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showSource, setShowSource] = useState(false);

  const serializeSvg = (): string | null => {
    const el = svgRef.current;
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadSvg = () => {
    const svg = serializeSvg();
    if (!svg) return;
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `chart-${stamp}.svg`,
    );
  };

  // 데이터 유효성 체크
  const noData =
    (spec.type === "scatter" || spec.type === "line"
      ? spec.points.length === 0
      : spec.values.length === 0) || spec.labels.length + spec.points.length === 0;
  if (noData) {
    return (
      <div className="my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <div className="mb-1 flex items-center gap-1 text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          차트 그리기 실패
        </div>
        <div className="text-[11px] text-muted">
          데이터가 비어있어요. 예:
          <pre className="mt-1 overflow-x-auto rounded bg-bg-elevated/60 p-2 font-mono text-[10px]">{`type: bar
title: 2024 분기별 매출
labels: Q1, Q2, Q3, Q4
data: 120, 150, 180, 210`}</pre>
        </div>
        <pre className="mt-2 overflow-x-auto rounded bg-bg-elevated/60 p-2 font-mono text-[10px] text-muted-strong">
          {source}
        </pre>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-2 py-1 text-[10px] text-muted">
      <span>
        📊 차트{" "}
        <span className="text-muted-strong">
          ({chartTypeLabel(spec.type)})
        </span>
        {spec.title ? ` — ${spec.title}` : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={handleDownloadSvg}
          className="rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-white"
          title="SVG 로 저장"
        >
          <Download className="inline h-3 w-3" /> SVG
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
  );

  if (showSource) {
    return (
      <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
        {header}
        <pre className="overflow-x-auto p-3 font-mono text-[11px] text-muted-strong">
          {source}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-bg-elevated/40">
      {header}
      <div className="overflow-x-auto p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto block max-w-full"
        >
          {spec.type === "bar" && <BarRender spec={spec} W={W} H={H} PAD={PAD} />}
          {spec.type === "pie" && <PieRender spec={spec} W={W} H={H} />}
          {(spec.type === "scatter" || spec.type === "line") && (
            <ScatterLineRender spec={spec} W={W} H={H} PAD={PAD} />
          )}
        </svg>
      </div>
    </div>
  );
}

function chartTypeLabel(t: ChartSpec["type"]): string {
  switch (t) {
    case "bar":
      return "막대";
    case "pie":
      return "파이";
    case "scatter":
      return "산점도";
    case "line":
      return "선 그래프";
  }
}

function BarRender({
  spec,
  W,
  H,
  PAD,
}: {
  spec: ChartSpec;
  W: number;
  H: number;
  PAD: number;
}) {
  const vals = spec.values;
  const maxV = Math.max(...vals, 0);
  const minV = Math.min(...vals, 0);
  const step = niceStep(maxV - minV || 1);
  const yTicks: number[] = [];
  for (let t = Math.ceil(minV / step) * step; t <= maxV + 1e-9; t += step)
    yTicks.push(Number(t.toFixed(10)));
  if (yTicks[yTicks.length - 1] < maxV) yTicks.push(maxV);
  const yTop = yTicks[yTicks.length - 1];
  const yBot = Math.min(yTicks[0], 0);
  const sy = (y: number) =>
    H - PAD - ((y - yBot) / (yTop - yBot || 1)) * (H - 2 * PAD);
  const barW = (W - 2 * PAD) / vals.length;
  return (
    <>
      {/* 그리드 */}
      {yTicks.map((t) => (
        <g key={`g-${t}`}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={sy(t)}
            y2={sy(t)}
            stroke="#2a3140"
          />
          <text
            x={PAD - 6}
            y={sy(t) + 3}
            fill="#8891a3"
            fontSize="10"
            textAnchor="end"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {+t.toFixed(3)}
          </text>
        </g>
      ))}
      {/* 축 */}
      <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} stroke="#8891a3" />
      {spec.ylabel && (
        <text
          x={14}
          y={H / 2}
          fill="#8891a3"
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90 14 ${H / 2})`}
        >
          {spec.ylabel}
        </text>
      )}
      {/* 막대 */}
      {vals.map((v, i) => {
        const x = PAD + i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = v >= 0 ? sy(v) : sy(0);
        const h = Math.abs(sy(v) - sy(0));
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          <g key={`b-${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={color} rx={2} />
            <text
              x={x + w / 2}
              y={y - 4}
              fill="#e8ecf4"
              fontSize="10"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {+v.toFixed(2)}
            </text>
            <text
              x={x + w / 2}
              y={H - PAD + 14}
              fill="#8891a3"
              fontSize="10"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {spec.labels[i] ?? i + 1}
            </text>
          </g>
        );
      })}
      {spec.xlabel && (
        <text
          x={W / 2}
          y={H - 10}
          fill="#8891a3"
          fontSize="11"
          textAnchor="middle"
        >
          {spec.xlabel}
        </text>
      )}
    </>
  );
}

function PieRender({
  spec,
  W,
  H,
}: {
  spec: ChartSpec;
  W: number;
  H: number;
}) {
  const total = spec.values.reduce((a, b) => a + Math.max(b, 0), 0);
  const cx = W / 2 - 60;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 40;
  let acc = 0;
  const slices = spec.values.map((v, i) => {
    const frac = Math.max(v, 0) / (total || 1);
    const start = acc;
    const end = acc + frac;
    acc = end;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const midAngle = (a0 + a1) / 2;
    const lx = cx + r * 0.6 * Math.cos(midAngle);
    const ly = cy + r * 0.6 * Math.sin(midAngle);
    const pct = (frac * 100).toFixed(1);
    return { d, color, label: spec.labels[i] ?? `${i + 1}`, pct, lx, ly, frac };
  });
  return (
    <>
      {slices.map((s, i) => (
        <g key={`s-${i}`}>
          <path d={s.d} fill={s.color} stroke="#141821" strokeWidth="1" />
          {s.frac > 0.05 && (
            <text
              x={s.lx}
              y={s.ly}
              fill="#fff"
              fontSize="11"
              textAnchor="middle"
              fontWeight="600"
            >
              {s.pct}%
            </text>
          )}
        </g>
      ))}
      {/* 범례 */}
      {slices.map((s, i) => (
        <g key={`lg-${i}`}>
          <rect
            x={W - 150}
            y={30 + i * 18}
            width={12}
            height={12}
            fill={s.color}
            rx={2}
          />
          <text
            x={W - 134}
            y={40 + i * 18}
            fill="#e8ecf4"
            fontSize="11"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {s.label}
          </text>
        </g>
      ))}
    </>
  );
}

function ScatterLineRender({
  spec,
  W,
  H,
  PAD,
}: {
  spec: ChartSpec;
  W: number;
  H: number;
  PAD: number;
}) {
  const pts = spec.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xPad = xRange * 0.05;
  const yPad = yRange * 0.1;
  const x0 = xMin - xPad;
  const x1 = xMax + xPad;
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;
  const sx = (x: number) => PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const sy = (y: number) =>
    H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD);
  const xStep = niceStep(x1 - x0);
  const yStep = niceStep(y1 - y0);
  const xTicks: number[] = [];
  for (let t = Math.ceil(x0 / xStep) * xStep; t <= x1 + 1e-9; t += xStep)
    xTicks.push(Number(t.toFixed(10)));
  const yTicks: number[] = [];
  for (let t = Math.ceil(y0 / yStep) * yStep; t <= y1 + 1e-9; t += yStep)
    yTicks.push(Number(t.toFixed(10)));
  const sortedPts =
    spec.type === "line" ? [...pts].sort((a, b) => a[0] - b[0]) : pts;
  const linePath = sortedPts
    .map((p) => `${sx(p[0]).toFixed(2)},${sy(p[1]).toFixed(2)}`)
    .join(" ");
  return (
    <>
      {xTicks.map((t) => (
        <g key={`gx-${t}`}>
          <line
            x1={sx(t)}
            x2={sx(t)}
            y1={PAD}
            y2={H - PAD}
            stroke="#2a3140"
          />
          <text
            x={sx(t)}
            y={H - PAD + 14}
            fill="#8891a3"
            fontSize="10"
            textAnchor="middle"
          >
            {+t.toFixed(2)}
          </text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`gy-${t}`}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={sy(t)}
            y2={sy(t)}
            stroke="#2a3140"
          />
          <text
            x={PAD - 6}
            y={sy(t) + 3}
            fill="#8891a3"
            fontSize="10"
            textAnchor="end"
          >
            {+t.toFixed(2)}
          </text>
        </g>
      ))}
      <rect
        x={PAD}
        y={PAD}
        width={W - 2 * PAD}
        height={H - 2 * PAD}
        fill="none"
        stroke="#4a5365"
      />
      {spec.type === "line" && (
        <polyline
          points={linePath}
          fill="none"
          stroke={CHART_COLORS[0]}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {pts.map((p, i) => (
        <circle
          key={`pt-${i}`}
          cx={sx(p[0])}
          cy={sy(p[1])}
          r={spec.type === "line" ? 3 : 4}
          fill={CHART_COLORS[0]}
          stroke="#141821"
          strokeWidth="1"
        />
      ))}
      {spec.xlabel && (
        <text
          x={W / 2}
          y={H - 10}
          fill="#8891a3"
          fontSize="11"
          textAnchor="middle"
        >
          {spec.xlabel}
        </text>
      )}
      {spec.ylabel && (
        <text
          x={14}
          y={H / 2}
          fill="#8891a3"
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90 14 ${H / 2})`}
        >
          {spec.ylabel}
        </text>
      )}
    </>
  );
}

/* ========================================================================
 * 재사용 유틸: ImageIcon 참조 유지 (tree-shaking 경고 방지)
 * ======================================================================== */
void ImageIcon;
