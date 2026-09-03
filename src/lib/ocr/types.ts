export type OCRElementType =
  | "text"
  | "formula"
  | "chemistry"
  | "table"
  | "diagram"
  | "option"
  | "question_number"
  | "heading";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: [number, number][]; // Polygon coordinates if available
}

export interface OCRElement {
  id: string;
  type: OCRElementType;
  content: string;
  latex?: string;
  tableData?: string[][];
  diagramUrl?: string;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number; // 0.0 - 1.0
  language?: "en" | "hi" | "both";
  needsReview?: boolean;
}

export interface OCRDocument {
  id: string;
  elements: OCRElement[];
  confidence: number;
  rawText: string;
  metadata: {
    width?: number;
    height?: number;
    hasMath: boolean;
    hasChemistry: boolean;
    hasTable: boolean;
    hasDiagram: boolean;
    detectedLanguage: "en" | "hi" | "both";
    provider: string;
    processingTimeMs: number;
  };
}

export interface StructuredQuestion {
  statementEn: string;
  statementHi: string;
  optionsEn: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  optionsHi: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  correctAnswer: string[];
  solutionEn: string;
  solutionHi: string;
  hasFigure: boolean;
  figureCaption?: string;
  figureUrl?: string;
  tables?: string[][][];
  subject: "Physics" | "Chemistry" | "Biology" | "Mathematics" | "Science";
  chapter: string;
  topic: string;
  subTopic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
  type: "SINGLE_CORRECT" | "MULTI_CORRECT" | "INTEGER" | "ASSERTION_REASON" | "MATCH_THE_COLUMN";
  category: string;
  pyqSource?: string;
  tags: string[];
  confidence: number;
  lowConfidenceFields: string[];
  isBilingual: boolean;
  elements: OCRElement[];
}

export interface OCRJobStatus {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number; // 0 - 100
  currentStage: string;
  document?: OCRDocument;
  question?: StructuredQuestion;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
