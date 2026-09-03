export type HierarchyLevel = "ROOT" | "CLASS" | "SUBJECT" | "CHAPTER" | "TOPIC" | "SUBTOPIC" | "QUESTION";

export interface NodeCounts {
  total: number;
  reviewed: number;
  draft: number;
}

export interface HierarchyNode {
  id: string; // Database ID (e.g. AcademicClass.id, AcademicSubject.id, etc.)
  key: string; // Composite unique key for tree navigation
  level: HierarchyLevel;
  name: string;
  nameHindi?: string | null;
  code?: string | null;
  order: number;
  fullPath: string; // e.g. "Class 11 / Physics / Laws of Motion / Friction / Static Friction"
  pathIds: {
    classId?: string;
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    subTopicId?: string;
  };
  counts: NodeCounts;
  isNew: boolean;
  createdAt: string;
  inRevision?: boolean;
  revisionItemId?: string;
  children?: HierarchyNode[];
  isLeaf?: boolean;
}

export interface HierarchicalQuestionBankResponse {
  summary: {
    totalQuestions: number;
    reviewedQuestions: number;
    draftQuestions: number;
    classesCount: number;
    subjectsCount: number;
    chaptersCount: number;
    topicsCount: number;
    subtopicsCount: number;
  };
  tree: HierarchyNode[];
  breadcrumbsMap: Record<string, { id: string; name: string; level: HierarchyLevel }[]>;
}

export interface RevisionItemSummary {
  id: string;
  userId: string;
  entityType: "CLASS" | "SUBJECT" | "CHAPTER" | "TOPIC" | "SUBTOPIC";
  entityId: string;
  title: string;
  fullPath: string;
  active: boolean;
  questionCount: number;
  revisionCount: number;
  latestAccuracy: number;
  averageAccuracy: number;
  status: "STRONG" | "NEEDS_PRACTICE" | "WEAK" | "UNATTEMPTED";
  history: {
    sessionId: string;
    revisionNumber: number;
    accuracy: number;
    date: string;
    attempted: number;
    correct: number;
    incorrect: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface RevisionDashboardStats {
  activePortionsCount: number;
  totalRevisionSessions: number;
  questionsRevisedCount: number;
  averageAccuracy: number;
  weakAreas: {
    title: string;
    fullPath: string;
    accuracy: number;
    revisionCount: number;
    revisionItemId: string;
  }[];
  strongAreas: {
    title: string;
    fullPath: string;
    accuracy: number;
    revisionCount: number;
    revisionItemId: string;
  }[];
}
