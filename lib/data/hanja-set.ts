/**
 * 한자 플래시카드용 데이터셋 — 교육용 상용한자 중 자주 쓰는 100자.
 * 레벨 구분: basic (초등~중1 교과서 상용), intermediate (중고교), advanced (대입/고사성어 관련).
 */

export interface HanjaEntry {
  character: string;
  reading: string; // 음
  meaning: string; // 훈 (뜻)
  radical: string; // 부수 (한자 (이름))
  strokes: number;
  level: "basic" | "intermediate" | "advanced";
  note?: string;
}

export const HANJA_SET: HanjaEntry[] = [
  // basic (40)
  { character: "學", reading: "학", meaning: "배우다", radical: "子 (아들 자)", strokes: 16, level: "basic" },
  { character: "校", reading: "교", meaning: "학교", radical: "木 (나무 목)", strokes: 10, level: "basic" },
  { character: "人", reading: "인", meaning: "사람", radical: "人 (사람 인)", strokes: 2, level: "basic" },
  { character: "山", reading: "산", meaning: "산", radical: "山 (메 산)", strokes: 3, level: "basic" },
  { character: "水", reading: "수", meaning: "물", radical: "水 (물 수)", strokes: 4, level: "basic" },
  { character: "火", reading: "화", meaning: "불", radical: "火 (불 화)", strokes: 4, level: "basic" },
  { character: "木", reading: "목", meaning: "나무", radical: "木 (나무 목)", strokes: 4, level: "basic" },
  { character: "金", reading: "금", meaning: "쇠·금", radical: "金 (쇠 금)", strokes: 8, level: "basic" },
  { character: "土", reading: "토", meaning: "흙", radical: "土 (흙 토)", strokes: 3, level: "basic" },
  { character: "日", reading: "일", meaning: "날·해", radical: "日 (날 일)", strokes: 4, level: "basic" },
  { character: "月", reading: "월", meaning: "달", radical: "月 (달 월)", strokes: 4, level: "basic" },
  { character: "年", reading: "년", meaning: "해", radical: "干 (방패 간)", strokes: 6, level: "basic" },
  { character: "大", reading: "대", meaning: "크다", radical: "大 (큰 대)", strokes: 3, level: "basic" },
  { character: "小", reading: "소", meaning: "작다", radical: "小 (작을 소)", strokes: 3, level: "basic" },
  { character: "中", reading: "중", meaning: "가운데", radical: "丨 (뚫을 곤)", strokes: 4, level: "basic" },
  { character: "上", reading: "상", meaning: "위", radical: "一 (한 일)", strokes: 3, level: "basic" },
  { character: "下", reading: "하", meaning: "아래", radical: "一 (한 일)", strokes: 3, level: "basic" },
  { character: "東", reading: "동", meaning: "동녘", radical: "木 (나무 목)", strokes: 8, level: "basic" },
  { character: "西", reading: "서", meaning: "서녘", radical: "襾 (덮을 아)", strokes: 6, level: "basic" },
  { character: "南", reading: "남", meaning: "남녘", radical: "十 (열 십)", strokes: 9, level: "basic" },
  { character: "北", reading: "북", meaning: "북녘", radical: "匕 (비수 비)", strokes: 5, level: "basic" },
  { character: "父", reading: "부", meaning: "아비", radical: "父 (아비 부)", strokes: 4, level: "basic" },
  { character: "母", reading: "모", meaning: "어미", radical: "毋 (말 무)", strokes: 5, level: "basic" },
  { character: "兄", reading: "형", meaning: "맏이·형", radical: "儿 (어진사람 인)", strokes: 5, level: "basic" },
  { character: "弟", reading: "제", meaning: "아우", radical: "弓 (활 궁)", strokes: 7, level: "basic" },
  { character: "家", reading: "가", meaning: "집", radical: "宀 (갓머리)", strokes: 10, level: "basic" },
  { character: "國", reading: "국", meaning: "나라", radical: "囗 (큰입구몸)", strokes: 11, level: "basic" },
  { character: "心", reading: "심", meaning: "마음", radical: "心 (마음 심)", strokes: 4, level: "basic" },
  { character: "手", reading: "수", meaning: "손", radical: "手 (손 수)", strokes: 4, level: "basic" },
  { character: "目", reading: "목", meaning: "눈", radical: "目 (눈 목)", strokes: 5, level: "basic" },
  { character: "口", reading: "구", meaning: "입", radical: "口 (입 구)", strokes: 3, level: "basic" },
  { character: "耳", reading: "이", meaning: "귀", radical: "耳 (귀 이)", strokes: 6, level: "basic" },
  { character: "文", reading: "문", meaning: "글월", radical: "文 (글월 문)", strokes: 4, level: "basic" },
  { character: "字", reading: "자", meaning: "글자", radical: "子 (아들 자)", strokes: 6, level: "basic" },
  { character: "書", reading: "서", meaning: "글·책", radical: "曰 (가로 왈)", strokes: 10, level: "basic" },
  { character: "名", reading: "명", meaning: "이름", radical: "口 (입 구)", strokes: 6, level: "basic" },
  { character: "生", reading: "생", meaning: "나다·살다", radical: "生 (날 생)", strokes: 5, level: "basic" },
  { character: "先", reading: "선", meaning: "먼저", radical: "儿 (어진사람 인)", strokes: 6, level: "basic" },
  { character: "後", reading: "후", meaning: "뒤", radical: "彳 (두인변)", strokes: 9, level: "basic" },
  { character: "新", reading: "신", meaning: "새롭다", radical: "斤 (도끼 근)", strokes: 13, level: "basic" },

  // intermediate (35)
  { character: "時", reading: "시", meaning: "때", radical: "日 (날 일)", strokes: 10, level: "intermediate" },
  { character: "空", reading: "공", meaning: "비다·하늘", radical: "穴 (구멍 혈)", strokes: 8, level: "intermediate" },
  { character: "間", reading: "간", meaning: "사이", radical: "門 (문 문)", strokes: 12, level: "intermediate" },
  { character: "朝", reading: "조", meaning: "아침", radical: "月 (달 월)", strokes: 12, level: "intermediate" },
  { character: "夕", reading: "석", meaning: "저녁", radical: "夕 (저녁 석)", strokes: 3, level: "intermediate" },
  { character: "夜", reading: "야", meaning: "밤", radical: "夕 (저녁 석)", strokes: 8, level: "intermediate" },
  { character: "春", reading: "춘", meaning: "봄", radical: "日 (날 일)", strokes: 9, level: "intermediate" },
  { character: "夏", reading: "하", meaning: "여름", radical: "夂 (뒤져올 치)", strokes: 10, level: "intermediate" },
  { character: "秋", reading: "추", meaning: "가을", radical: "禾 (벼 화)", strokes: 9, level: "intermediate" },
  { character: "冬", reading: "동", meaning: "겨울", radical: "冫 (이수변)", strokes: 5, level: "intermediate" },
  { character: "風", reading: "풍", meaning: "바람", radical: "風 (바람 풍)", strokes: 9, level: "intermediate" },
  { character: "雨", reading: "우", meaning: "비", radical: "雨 (비 우)", strokes: 8, level: "intermediate" },
  { character: "雪", reading: "설", meaning: "눈", radical: "雨 (비 우)", strokes: 11, level: "intermediate" },
  { character: "花", reading: "화", meaning: "꽃", radical: "艸 (초두머리)", strokes: 8, level: "intermediate" },
  { character: "樹", reading: "수", meaning: "나무·세우다", radical: "木 (나무 목)", strokes: 16, level: "intermediate" },
  { character: "言", reading: "언", meaning: "말씀", radical: "言 (말씀 언)", strokes: 7, level: "intermediate" },
  { character: "語", reading: "어", meaning: "말씀", radical: "言 (말씀 언)", strokes: 14, level: "intermediate" },
  { character: "話", reading: "화", meaning: "말하다", radical: "言 (말씀 언)", strokes: 13, level: "intermediate" },
  { character: "記", reading: "기", meaning: "기록하다", radical: "言 (말씀 언)", strokes: 10, level: "intermediate" },
  { character: "讀", reading: "독", meaning: "읽다", radical: "言 (말씀 언)", strokes: 22, level: "intermediate" },
  { character: "寫", reading: "사", meaning: "쓰다·베끼다", radical: "宀 (갓머리)", strokes: 15, level: "intermediate" },
  { character: "思", reading: "사", meaning: "생각하다", radical: "心 (마음 심)", strokes: 9, level: "intermediate" },
  { character: "想", reading: "상", meaning: "생각", radical: "心 (마음 심)", strokes: 13, level: "intermediate" },
  { character: "知", reading: "지", meaning: "알다", radical: "矢 (화살 시)", strokes: 8, level: "intermediate" },
  { character: "識", reading: "식", meaning: "알다", radical: "言 (말씀 언)", strokes: 19, level: "intermediate" },
  { character: "問", reading: "문", meaning: "묻다", radical: "口 (입 구)", strokes: 11, level: "intermediate" },
  { character: "答", reading: "답", meaning: "답하다", radical: "竹 (대 죽)", strokes: 12, level: "intermediate" },
  { character: "正", reading: "정", meaning: "바르다", radical: "止 (그칠 지)", strokes: 5, level: "intermediate" },
  { character: "直", reading: "직", meaning: "곧다", radical: "目 (눈 목)", strokes: 8, level: "intermediate" },
  { character: "美", reading: "미", meaning: "아름답다", radical: "羊 (양 양)", strokes: 9, level: "intermediate" },
  { character: "善", reading: "선", meaning: "착하다", radical: "口 (입 구)", strokes: 12, level: "intermediate" },
  { character: "惡", reading: "악", meaning: "악하다", radical: "心 (마음 심)", strokes: 12, level: "intermediate" },
  { character: "愛", reading: "애", meaning: "사랑하다", radical: "心 (마음 심)", strokes: 13, level: "intermediate" },
  { character: "情", reading: "정", meaning: "뜻·정", radical: "心 (마음 심)", strokes: 11, level: "intermediate" },
  { character: "友", reading: "우", meaning: "벗", radical: "又 (또 우)", strokes: 4, level: "intermediate" },

  // advanced (25)
  { character: "德", reading: "덕", meaning: "덕", radical: "彳 (두인변)", strokes: 15, level: "advanced" },
  { character: "義", reading: "의", meaning: "옳다", radical: "羊 (양 양)", strokes: 13, level: "advanced" },
  { character: "禮", reading: "례", meaning: "예의", radical: "示 (보일 시)", strokes: 18, level: "advanced" },
  { character: "智", reading: "지", meaning: "지혜", radical: "日 (날 일)", strokes: 12, level: "advanced" },
  { character: "信", reading: "신", meaning: "믿다", radical: "人 (사람 인)", strokes: 9, level: "advanced" },
  { character: "忠", reading: "충", meaning: "충성", radical: "心 (마음 심)", strokes: 8, level: "advanced" },
  { character: "孝", reading: "효", meaning: "효도", radical: "子 (아들 자)", strokes: 7, level: "advanced" },
  { character: "聖", reading: "성", meaning: "성스럽다", radical: "耳 (귀 이)", strokes: 13, level: "advanced" },
  { character: "賢", reading: "현", meaning: "어질다", radical: "貝 (조개 패)", strokes: 15, level: "advanced" },
  { character: "哲", reading: "철", meaning: "밝다·현명하다", radical: "口 (입 구)", strokes: 10, level: "advanced" },
  { character: "歷", reading: "력", meaning: "지나다·역사", radical: "止 (그칠 지)", strokes: 16, level: "advanced" },
  { character: "史", reading: "사", meaning: "역사·사관", radical: "口 (입 구)", strokes: 5, level: "advanced" },
  { character: "政", reading: "정", meaning: "정사", radical: "攵 (등글월문)", strokes: 9, level: "advanced" },
  { character: "治", reading: "치", meaning: "다스리다", radical: "水 (물 수)", strokes: 8, level: "advanced" },
  { character: "法", reading: "법", meaning: "법", radical: "水 (물 수)", strokes: 8, level: "advanced" },
  { character: "官", reading: "관", meaning: "벼슬", radical: "宀 (갓머리)", strokes: 8, level: "advanced" },
  { character: "軍", reading: "군", meaning: "군사", radical: "車 (수레 거)", strokes: 9, level: "advanced" },
  { character: "兵", reading: "병", meaning: "병사", radical: "八 (여덟 팔)", strokes: 7, level: "advanced" },
  { character: "戰", reading: "전", meaning: "싸우다", radical: "戈 (창 과)", strokes: 16, level: "advanced" },
  { character: "勝", reading: "승", meaning: "이기다", radical: "力 (힘 력)", strokes: 12, level: "advanced" },
  { character: "敗", reading: "패", meaning: "지다", radical: "攵 (등글월문)", strokes: 11, level: "advanced" },
  { character: "興", reading: "흥", meaning: "일어나다", radical: "臼 (절구 구)", strokes: 16, level: "advanced" },
  { character: "亡", reading: "망", meaning: "망하다", radical: "亠 (돼지해머리)", strokes: 3, level: "advanced" },
  { character: "存", reading: "존", meaning: "있다·존재하다", radical: "子 (아들 자)", strokes: 6, level: "advanced" },
  { character: "滅", reading: "멸", meaning: "멸하다", radical: "水 (물 수)", strokes: 13, level: "advanced" },
];

export function hanjaForLevel(level: "basic" | "intermediate" | "advanced" | "all"): HanjaEntry[] {
  if (level === "all") return HANJA_SET;
  return HANJA_SET.filter((h) => h.level === level);
}
