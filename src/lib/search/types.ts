export type SearchEntityType =
  | "teacher"
  | "student"
  | "team_member"
  | "batch"
  | "course"
  | "subject"
  | "chapter"
  | "lecture"
  | "module"
  | "study_material"
  | "test_series"
  | "test"
  | "question"
  | "class"
  | "recording";

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  /** Primary line, e.g. "Firoz Ali" or "Physics — Current Electricity". */
  title: string;
  /** Secondary line, e.g. "Teacher · Physics" or "10 Sep 2026 · NEET Dropper". */
  subtitle?: string;
  /** In-app link that already respects route-level permission guards. */
  href: string;
  /** Small extra facts for the AI grounding layer (never rendered raw). */
  meta?: Record<string, string | number | boolean | null>;
  /** Relevance score (filled by rank.ts). */
  score?: number;
}

export interface SearchGroup {
  type: SearchEntityType;
  /** UI heading, e.g. "People", "Classes". */
  label: string;
  results: SearchResult[];
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  /** True when at least one entity query was skipped for lack of permission. */
  partial: boolean;
}

export const GROUP_LABELS: Record<SearchEntityType, string> = {
  teacher: "People",
  student: "People",
  team_member: "People",
  batch: "Batches",
  course: "Courses",
  subject: "Subjects",
  chapter: "Chapters",
  lecture: "Lectures",
  module: "Modules",
  study_material: "Study Material",
  test_series: "Test Series",
  test: "Tests",
  question: "Questions",
  class: "Classes",
  recording: "Class Recordings",
};

/** Order groups appear in the results panel. */
export const GROUP_ORDER: SearchEntityType[] = [
  "teacher",
  "student",
  "team_member",
  "class",
  "recording",
  "batch",
  "course",
  "subject",
  "chapter",
  "lecture",
  "test_series",
  "test",
  "module",
  "study_material",
  "question",
];
