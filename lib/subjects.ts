export interface SubjectGroup {
  id: string;
  label: string;
  emoji: string;
  subjects: string[];
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  {
    id: "programming",
    label: "프로그래밍",
    emoji: "💻",
    subjects: [
      "Python",
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "Rust",
      "Go",
      "Java",
      "SQL",
    ],
  },
  {
    id: "cs",
    label: "컴퓨터 과학",
    emoji: "🧮",
    subjects: [
      "자료구조",
      "알고리즘",
      "운영체제",
      "네트워크",
      "데이터베이스",
      "컴퓨터구조",
      "컴파일러",
    ],
  },
  {
    id: "ai",
    label: "AI / ML",
    emoji: "🧠",
    subjects: [
      "머신러닝 기초",
      "딥러닝",
      "트랜스포머",
      "LLM & 프롬프트",
      "NLP",
      "컴퓨터 비전",
      "강화학습",
    ],
  },
  {
    id: "math",
    label: "수학",
    emoji: "📐",
    subjects: ["선형대수", "미적분", "확률과 통계", "이산수학", "최적화"],
  },
  {
    id: "data",
    label: "데이터",
    emoji: "📊",
    subjects: ["데이터 분석", "통계적 추론", "pandas", "SQL 쿼리 튜닝", "시각화"],
  },
  {
    id: "systems",
    label: "시스템 / 인프라",
    emoji: "🛠️",
    subjects: ["Linux", "Docker", "Kubernetes", "CI/CD", "분산 시스템", "클라우드"],
  },
  {
    id: "language",
    label: "어학",
    emoji: "🗣️",
    subjects: [
      "영어",
      "스페인어",
      "일본어",
      "중국어",
      "프랑스어",
      "독일어",
      "이탈리아어",
      "포르투갈어",
      "러시아어",
    ],
  },
  {
    id: "classical",
    label: "한문 / 고전",
    emoji: "🀄",
    subjects: [
      "한문",
      "한자",
      "논어",
      "맹자",
      "대학·중용",
      "한시",
      "사기·열전",
      "고사성어",
      "서예",
    ],
  },
  {
    id: "econ",
    label: "경제 / 통계 / 사회과학",
    emoji: "📈",
    subjects: [
      "미시경제학",
      "거시경제학",
      "통계학",
      "계량경제",
      "금융",
      "회계",
      "경영학",
      "심리학",
      "사회학",
    ],
  },
];

export function findSubjectGroup(subject: string): SubjectGroup | undefined {
  return SUBJECT_GROUPS.find((g) => g.subjects.includes(subject));
}
