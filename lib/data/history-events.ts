/**
 * 역사 연표 퀴즈 데이터셋 — 한국사 + 세계사 주요 사건.
 */

export interface HistoryEvent {
  year: number;
  title: string;
  description: string;
  region: "korea" | "world";
  era: "ancient" | "medieval" | "modern" | "contemporary";
}

export const HISTORY_EVENTS: HistoryEvent[] = [
  // 한국사 (고대~현대)
  { year: -2333, title: "고조선 건국", description: "단군왕검이 아사달에 도읍을 세운 전설적 건국 연도.", region: "korea", era: "ancient" },
  { year: 57, title: "신라 건국", description: "박혁거세가 서라벌(경주)에서 신라를 세움.", region: "korea", era: "ancient" },
  { year: 37, title: "고구려 건국", description: "주몽(동명성왕)이 졸본에서 고구려를 세움.", region: "korea", era: "ancient" },
  { year: 18, title: "백제 건국", description: "온조가 위례성에 백제를 세움.", region: "korea", era: "ancient" },
  { year: 668, title: "신라의 삼국 통일", description: "당과 연합하여 고구려를 멸망시키고 삼국 통일 완성.", region: "korea", era: "ancient" },
  { year: 918, title: "고려 건국", description: "왕건이 송악(개성)에 도읍하여 고려를 세움.", region: "korea", era: "medieval" },
  { year: 1231, title: "몽골의 1차 침입", description: "몽골 제국의 고려 침략 시작. 이후 수차례 침입.", region: "korea", era: "medieval" },
  { year: 1270, title: "삼별초의 항쟁", description: "강화 천도 종결 후 몽골과의 강화에 반발한 무신 정권 군대의 반란.", region: "korea", era: "medieval" },
  { year: 1392, title: "조선 건국", description: "이성계가 고려를 무너뜨리고 조선을 건국.", region: "korea", era: "medieval" },
  { year: 1443, title: "훈민정음 창제", description: "세종대왕이 백성을 위한 새로운 문자를 만듦.", region: "korea", era: "medieval" },
  { year: 1592, title: "임진왜란 발발", description: "도요토미 히데요시의 조선 침략. 이순신의 활약으로 격퇴.", region: "korea", era: "medieval" },
  { year: 1636, title: "병자호란", description: "청의 조선 침입. 남한산성에서 항전 후 삼전도의 굴욕.", region: "korea", era: "medieval" },
  { year: 1876, title: "강화도 조약", description: "일본과 맺은 불평등 조약. 조선의 문호 개방 시발.", region: "korea", era: "modern" },
  { year: 1894, title: "갑오개혁·동학농민운동", description: "근대적 개혁과 동학 농민들의 봉기가 함께 일어남.", region: "korea", era: "modern" },
  { year: 1910, title: "한일 병합", description: "일본의 대한제국 강제 병합. 일제 식민지화 시작.", region: "korea", era: "modern" },
  { year: 1919, title: "3·1 운동", description: "일제에 맞선 전국적 비폭력 독립운동.", region: "korea", era: "modern" },
  { year: 1945, title: "광복", description: "일본의 패전으로 한반도 해방.", region: "korea", era: "contemporary" },
  { year: 1950, title: "한국전쟁 발발", description: "6월 25일 북한의 남침으로 전쟁 시작.", region: "korea", era: "contemporary" },
  { year: 1960, title: "4·19 혁명", description: "학생·시민 주도로 이승만 정부 붕괴.", region: "korea", era: "contemporary" },
  { year: 1980, title: "5·18 광주민주화운동", description: "신군부의 폭압에 맞선 광주 시민의 민주화 항쟁.", region: "korea", era: "contemporary" },
  { year: 1987, title: "6월 민주항쟁", description: "직선제 개헌을 이끌어낸 전국적 민주화 운동.", region: "korea", era: "contemporary" },
  { year: 1988, title: "서울 올림픽", description: "제24회 하계 올림픽이 서울에서 개최.", region: "korea", era: "contemporary" },

  // 세계사 (고대~현대)
  { year: -776, title: "고대 올림픽 개최", description: "그리스 올림피아에서 최초의 고대 올림픽 개막.", region: "world", era: "ancient" },
  { year: -509, title: "로마 공화정 수립", description: "왕정이 폐지되고 공화정이 시작됨.", region: "world", era: "ancient" },
  { year: -221, title: "진시황 중국 통일", description: "진시황이 전국시대를 끝내고 중국을 통일.", region: "world", era: "ancient" },
  { year: 395, title: "로마 제국 동서 분열", description: "테오도시우스 황제 사후 제국이 동·서로 분리.", region: "world", era: "ancient" },
  { year: 476, title: "서로마 제국 멸망", description: "게르만족 침략으로 서로마 제국 붕괴.", region: "world", era: "ancient" },
  { year: 622, title: "이슬람력 원년 (헤지라)", description: "무함마드가 메카에서 메디나로 이주.", region: "world", era: "medieval" },
  { year: 800, title: "카롤루스 대제 대관식", description: "교황이 프랑크 왕 카를을 서로마 황제로 추대.", region: "world", era: "medieval" },
  { year: 1066, title: "노르만의 영국 정복", description: "노르망디 공 윌리엄이 잉글랜드 왕위 획득.", region: "world", era: "medieval" },
  { year: 1215, title: "마그나 카르타", description: "영국 존 왕이 귀족의 요구로 서명한 대헌장.", region: "world", era: "medieval" },
  { year: 1271, title: "마르코 폴로의 동방 여행", description: "베네치아 상인 마르코 폴로가 쿠빌라이 칸의 원에 도착.", region: "world", era: "medieval" },
  { year: 1453, title: "동로마 제국 멸망", description: "오스만 제국의 콘스탄티노플 함락.", region: "world", era: "medieval" },
  { year: 1492, title: "콜럼버스 신대륙 도착", description: "콜럼버스가 바하마 제도에 도착하며 대항해 시대 개막.", region: "world", era: "modern" },
  { year: 1517, title: "종교개혁 시작", description: "마르틴 루터가 95개조 반박문 발표.", region: "world", era: "modern" },
  { year: 1687, title: "뉴턴 《프린키피아》 출간", description: "만유인력 법칙과 고전역학의 기초를 제시.", region: "world", era: "modern" },
  { year: 1776, title: "미국 독립 선언", description: "7월 4일 북미 13개 식민지가 영국으로부터 독립 선언.", region: "world", era: "modern" },
  { year: 1789, title: "프랑스 혁명", description: "바스티유 감옥 함락으로 시작된 시민혁명.", region: "world", era: "modern" },
  { year: 1859, title: "《종의 기원》 출간", description: "다윈이 자연선택에 의한 진화론을 발표.", region: "world", era: "modern" },
  { year: 1914, title: "제1차 세계대전 발발", description: "사라예보 사건을 계기로 유럽 전역이 전쟁에 돌입.", region: "world", era: "modern" },
  { year: 1917, title: "러시아 10월 혁명", description: "볼셰비키의 봉기로 세계 최초의 공산주의 국가 수립.", region: "world", era: "modern" },
  { year: 1929, title: "세계 대공황 시작", description: "뉴욕 증시 붕괴로 시작된 전 세계적 경제 위기.", region: "world", era: "modern" },
  { year: 1939, title: "제2차 세계대전 발발", description: "독일의 폴란드 침공으로 시작.", region: "world", era: "contemporary" },
  { year: 1945, title: "원자폭탄 투하·종전", description: "히로시마·나가사키 원폭 투하 후 일본 항복.", region: "world", era: "contemporary" },
  { year: 1969, title: "아폴로 11호 달 착륙", description: "닐 암스트롱이 인류 최초로 달 표면을 밟음.", region: "world", era: "contemporary" },
  { year: 1989, title: "베를린 장벽 붕괴", description: "동서독 분단의 상징이던 베를린 장벽 무너짐.", region: "world", era: "contemporary" },
  { year: 1991, title: "소련 해체", description: "소비에트 연방이 공식 해체되고 냉전 종결.", region: "world", era: "contemporary" },
];

export function eventsForRegion(region: "korea" | "world" | "all"): HistoryEvent[] {
  if (region === "all") return HISTORY_EVENTS;
  return HISTORY_EVENTS.filter((e) => e.region === region);
}
