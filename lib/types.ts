export type LearningMode = "single" | "fusion";

export type SourceKind = "pdf" | "code" | "spec" | "note" | "url";

export interface LearningSource {
  id: string;
  name: string;
  kind: SourceKind;
  size: number;
  addedAt: string;
}

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface ConceptCard {
  id: string;
  title: string;
  summary: string;
  vocabulary: Array<{ term: string; gloss: string }>;
  level: SkillLevel;
}

export type TutorRole = "user" | "assistant" | "system";

export interface TutorMessage {
  id: string;
  role: TutorRole;
  content: string;
  createdAt: string;
}

export interface DebugHint {
  line?: number;
  column?: number;
  question: string;
  rationale?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface HeatmapCell {
  topic: string;
  bucket: string;
  errorRate: number;
}
