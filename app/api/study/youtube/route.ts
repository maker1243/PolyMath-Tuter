import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createSource } from "@/lib/study-store";
import { parseYouTubeId } from "@/lib/youtube";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  url: string;
  title?: string;
  lang?: string; // 자막 언어 코드 (예: ko, en, ja). 생략 시 라이브러리 기본
}

export async function POST(req: Request) {
  const me = currentUser();
  if (!me)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = (await req.json()) as Body;
  const videoId = parseYouTubeId(body?.url ?? "");
  if (!videoId) {
    return NextResponse.json(
      { error: "유효한 YouTube URL 이 아닙니다." },
      { status: 400 },
    );
  }

  // 자막 가져오기 — 지정 lang 우선, 실패 시 ko → en → 기본 순 폴백
  const langs = [body.lang, "ko", "en"].filter(
    (x, i, arr): x is string => !!x && arr.indexOf(x) === i,
  );

  type TranscriptItem = { text: string; duration: number; offset: number };
  let transcript: TranscriptItem[] | null = null;
  let usedLang: string | undefined;
  let lastErr: unknown = null;

  for (const lang of langs) {
    try {
      transcript = (await YoutubeTranscript.fetchTranscript(videoId, {
        lang,
      })) as unknown as TranscriptItem[];
      usedLang = lang;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  // 모든 lang 실패 → 기본 (라이브러리가 알아서 하나 고름)
  if (!transcript) {
    try {
      transcript = (await YoutubeTranscript.fetchTranscript(
        videoId,
      )) as unknown as TranscriptItem[];
      usedLang = "auto";
    } catch (err) {
      lastErr = err;
    }
  }

  if (!transcript || transcript.length === 0) {
    const msg =
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? "자막 없음");
    return NextResponse.json(
      {
        error:
          `이 영상에서 자막을 가져올 수 없습니다 — 자막이 꺼져 있거나 비공개 영상일 수 있어요. (원문: ${msg.slice(0, 200)})`,
      },
      { status: 422 },
    );
  }

  // 타임스탬프 포함해 플래시카드 생성 시 참조 쉽게
  const seconds = (ms: number) => Math.floor(ms / 1000);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };
  // offset 단위가 ms 인 경우가 많음 (라이브러리에 따라 s/ms 혼재) — 자동 감지
  const maxOff = Math.max(...transcript.map((t) => t.offset ?? 0));
  const isMs = maxOff > 1_000_000; // 보통 ms

  const lines: string[] = [];
  lines.push(`# YouTube 자막 (${usedLang ?? "auto"})`);
  lines.push(`출처: https://www.youtube.com/watch?v=${videoId}`);
  lines.push("");
  for (const t of transcript) {
    const sec = seconds(isMs ? (t.offset ?? 0) : (t.offset ?? 0) * 1000);
    const text = decodeHtmlEntities(t.text).trim();
    if (!text) continue;
    lines.push(`[${fmt(sec)}] ${text}`);
  }
  const content = lines.join("\n");

  const title =
    (body.title && body.title.trim()) ||
    `YouTube: ${videoId}` ||
    "YouTube 영상";

  // kind: "url" 재활용 — 기존 UI 는 URL/자막 그룹으로 처리
  const src = createSource({
    userId: me.id,
    title: title.slice(0, 120),
    content: content.slice(0, 100_000),
    kind: "url",
  });

  return NextResponse.json({
    ok: true,
    source: src,
    videoId,
    lang: usedLang,
    lineCount: transcript.length,
  });
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n+/g, " ");
}
