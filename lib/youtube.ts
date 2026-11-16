/**
 * YouTube URL 파싱·자막·임베드 유틸.
 * 자막은 서버에서만 받아옴 (CORS·레이트리밋 때문에 클라이언트 직접 호출 금지).
 */

/** 다양한 포맷의 YouTube URL 에서 videoId 11자 추출. */
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // 아예 11자 ID 만 왔으면 그대로
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const re =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const m = trimmed.match(re);
  return m ? m[1] : null;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string, quality: "default" | "hq" | "max" = "hq"): string {
  const q = quality === "max" ? "maxresdefault" : quality === "hq" ? "hqdefault" : "default";
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`;
}
