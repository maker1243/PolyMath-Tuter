/**
 * 브라우저 내장 Web Speech API 래퍼.
 * - 비용 0, 번들 추가 X, 20+ 언어 지원 (OS/브라우저 보유 음성)
 * - 서버에선 작동 X — 클라이언트에서만 import
 */

export interface TtsLanguage {
  code: string; // BCP-47 (예: en-US, es-ES, ja-JP)
  label: string; // 한국어 표시명
  flag: string;
  samplePhrase: string;
}

export const TTS_LANGUAGES: TtsLanguage[] = [
  { code: "en-US", label: "영어 (미국)", flag: "🇺🇸", samplePhrase: "Hello" },
  { code: "en-GB", label: "영어 (영국)", flag: "🇬🇧", samplePhrase: "Hello" },
  { code: "es-ES", label: "스페인어 (스페인)", flag: "🇪🇸", samplePhrase: "Hola" },
  { code: "es-MX", label: "스페인어 (멕시코)", flag: "🇲🇽", samplePhrase: "Hola" },
  { code: "ja-JP", label: "일본어", flag: "🇯🇵", samplePhrase: "こんにちは" },
  { code: "zh-CN", label: "중국어 (간체)", flag: "🇨🇳", samplePhrase: "你好" },
  { code: "zh-TW", label: "중국어 (번체)", flag: "🇹🇼", samplePhrase: "你好" },
  { code: "fr-FR", label: "프랑스어", flag: "🇫🇷", samplePhrase: "Bonjour" },
  { code: "de-DE", label: "독일어", flag: "🇩🇪", samplePhrase: "Hallo" },
  { code: "it-IT", label: "이탈리아어", flag: "🇮🇹", samplePhrase: "Ciao" },
  { code: "pt-BR", label: "포르투갈어 (브라질)", flag: "🇧🇷", samplePhrase: "Olá" },
  { code: "ru-RU", label: "러시아어", flag: "🇷🇺", samplePhrase: "Привет" },
  { code: "ko-KR", label: "한국어", flag: "🇰🇷", samplePhrase: "안녕하세요" },
];

export function isTtsAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export interface SpeakOptions {
  lang?: string;
  rate?: number; // 0.1 ~ 10 (기본 1)
  pitch?: number; // 0 ~ 2 (기본 1)
  volume?: number; // 0 ~ 1 (기본 1)
  voiceURI?: string; // 특정 음성 선택
}

/** 지금 재생 중이면 멈추고 새로 재생. 반환되는 utterance 로 이벤트 바인딩 가능. */
export function speak(
  text: string,
  opts: SpeakOptions = {},
): SpeechSynthesisUtterance | null {
  if (!isTtsAvailable() || !text.trim()) return null;
  window.speechSynthesis.cancel(); // 재생 중인 것 중단
  const u = new SpeechSynthesisUtterance(text);
  if (opts.lang) u.lang = opts.lang;
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  u.volume = opts.volume ?? 1;
  if (opts.voiceURI) {
    const v = window.speechSynthesis
      .getVoices()
      .find((x) => x.voiceURI === opts.voiceURI);
    if (v) u.voice = v;
  } else if (opts.lang) {
    // 지정 lang 과 가장 잘 맞는 voice 자동 선택 (OS/브라우저 보유분 중)
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang === opts.lang) ||
      voices.find((v) => v.lang.startsWith(opts.lang!.split("-")[0]));
    if (match) u.voice = match;
  }
  window.speechSynthesis.speak(u);
  return u;
}

export function cancelSpeech(): void {
  if (!isTtsAvailable()) return;
  window.speechSynthesis.cancel();
}

/** 과목명/글 내용으로 BCP-47 코드 추론 */
export function guessLang(input: string | undefined, fallback = "en-US"): string {
  if (!input) return fallback;
  const s = input.toLowerCase();
  if (/스페인|español|spanish|hola|español/i.test(input) || /^[À-ſ\sñ¿¡.,!?'"-]+$/i.test(input))
    return "es-ES";
  if (/일본|japanese|日本/i.test(input) || /[ぁ-んァ-ン一-龯]/.test(input)) return "ja-JP";
  if (/중국|chinese|中文/i.test(input) || /[一-鿿]/.test(input))
    return "zh-CN";
  if (/프랑스|français|french/i.test(input)) return "fr-FR";
  if (/독일|deutsch|german/i.test(input)) return "de-DE";
  if (/이탈리아|italiano|italian/i.test(input)) return "it-IT";
  if (/포르투갈|português|portuguese/i.test(input)) return "pt-BR";
  if (/러시아|русский|russian/i.test(input) || /[Ѐ-ӿ]/.test(input))
    return "ru-RU";
  if (/영어|english/i.test(s)) return "en-US";
  if (/한국|korean|한국어/i.test(input) || /[ㄱ-힣]/.test(input)) return "ko-KR";
  return fallback;
}
