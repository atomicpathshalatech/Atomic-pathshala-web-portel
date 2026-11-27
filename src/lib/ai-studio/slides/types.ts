export const SLIDE_TYPES = [
  "Title",
  "Concept explanation",
  "Definition",
  "Diagram",
  "Comparison",
  "Process",
  "Timeline",
  "Formula",
  "Example",
  "Question",
  "MCQ",
  "PYQ",
  "Summary",
  "Motivation",
  "CTA",
] as const;

export type SlideType = (typeof SLIDE_TYPES)[number];

export const SLIDE_CONTENT_TYPES = [
  "NEET Chemistry",
  "NEET Biology",
  "NEET Physics",
  "JEE",
  "Boards",
  "Chapter lecture",
  "Revision",
  "One Shot",
  "PYQ",
  "Question practice",
  "Motivational presentation",
  "Batch promotion",
] as const;

export type SlideContentType = (typeof SLIDE_CONTENT_TYPES)[number];

export type SlideThemeId =
  | "ATOMIC_BLACK_ORANGE"
  | "CHEMISTRY_TEAL"
  | "PHYSICS_INDIGO"
  | "BIOLOGY_EMERALD"
  | "MOTIVATION_CRIMSON"
  | "CLEAN_LIGHT_BOARD";

export interface SlideThemeConfig {
  id: SlideThemeId;
  name: string;
  description: string;
  backgroundColor: string;
  surfaceColor: string;
  accentColor: string;
  secondaryAccentColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
}

export const SLIDE_THEMES: Record<SlideThemeId, SlideThemeConfig> = {
  ATOMIC_BLACK_ORANGE: {
    id: "ATOMIC_BLACK_ORANGE",
    name: "Atomic Black & Orange (Official)",
    description: "Signature Atomic Pathshala black canvas with #F97316 orange accents — ideal for Question & PYQ slides.",
    backgroundColor: "#0A0A0A",
    surfaceColor: "#161616",
    accentColor: "#F97316",
    secondaryAccentColor: "#FDBA74",
    textColor: "#FFFFFF",
    mutedTextColor: "#A3A3A3",
    borderColor: "#2E2E2E",
  },
  CHEMISTRY_TEAL: {
    id: "CHEMISTRY_TEAL",
    name: "Chemistry Slate & Teal",
    description: "Deep navy-slate canvas with teal & atomic orange highlights for Chemistry concepts and reactions.",
    backgroundColor: "#0B132B",
    surfaceColor: "#1C2541",
    accentColor: "#14B8A6",
    secondaryAccentColor: "#F97316",
    textColor: "#F8FAFC",
    mutedTextColor: "#94A3B8",
    borderColor: "#334155",
  },
  PHYSICS_INDIGO: {
    id: "PHYSICS_INDIGO",
    name: "Physics Midnight & Cyan",
    description: "High-contrast midnight canvas with electric cyan & amber accents for derivations and formulas.",
    backgroundColor: "#0F172A",
    surfaceColor: "#1E293B",
    accentColor: "#38BDF8",
    secondaryAccentColor: "#F59E0B",
    textColor: "#F8FAFC",
    mutedTextColor: "#94A3B8",
    borderColor: "#334155",
  },
  BIOLOGY_EMERALD: {
    id: "BIOLOGY_EMERALD",
    name: "Biology Forest & Emerald",
    description: "Deep forest-slate canvas with emerald & warm orange accents for NCERT diagrams & classification.",
    backgroundColor: "#071A14",
    surfaceColor: "#0E2920",
    accentColor: "#10B981",
    secondaryAccentColor: "#F97316",
    textColor: "#ECFDF5",
    mutedTextColor: "#A7F3D0",
    borderColor: "#1B4332",
  },
  MOTIVATION_CRIMSON: {
    id: "MOTIVATION_CRIMSON",
    name: "Motivation Crimson & Gold",
    description: "Dramatic dark charcoal with crimson & gold highlights for student motivation and batch launches.",
    backgroundColor: "#111111",
    surfaceColor: "#1F1F1F",
    accentColor: "#EF4444",
    secondaryAccentColor: "#F59E0B",
    textColor: "#FFFFFF",
    mutedTextColor: "#D4D4D8",
    borderColor: "#3F3F46",
  },
  CLEAN_LIGHT_BOARD: {
    id: "CLEAN_LIGHT_BOARD",
    name: "Clean Light Whiteboard",
    description: "Crisp white board with dark slate typography and Atomic orange accents for printable handouts.",
    backgroundColor: "#FFFFFF",
    surfaceColor: "#F1F5F9",
    accentColor: "#F97316",
    secondaryAccentColor: "#0F172A",
    textColor: "#0F172A",
    mutedTextColor: "#475569",
    borderColor: "#CBD5E1",
  },
};

export interface SlideOutlineItem {
  id: string;
  sequence: number;
  slideType: SlideType;
  title: string;
  content: string;
  visualRequirement?: string;
  diagramRequirement?: string;
  questionRequirement?: string;
  explanation?: string;
  teacherNotes?: string;
}

export type SlideElementType =
  | "TEXT"
  | "SHAPE"
  | "IMAGE"
  | "LOGO"
  | "QUESTION_HEADER"
  | "QUESTION_OPTION";

export interface SlideElement {
  id: string;
  type: SlideElementType;
  /** X position in inches (16:9 canvas is 10 x 5.625 inches) */
  x: number;
  /** Y position in inches */
  y: number;
  /** Width in inches */
  w: number;
  /** Height in inches */
  h: number;
  text?: string;
  fontSize?: number;
  fontFace?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  shapeType?: "rect" | "roundRect" | "line";
  imageUrl?: string;
  zIndex: number;
}

export type SlideLayoutVariant =
  | "TITLE_HERO"
  | "CONCEPT_SPLIT"
  | "DEFINITION_CARD"
  | "FORMULA_GRID"
  | "COMPARISON_TWO_COL"
  | "PROCESS_STEPS"
  | "QUESTION_ATOMIC"
  | "SUMMARY_CARDS"
  | "CTA_BANNER";

export interface SlideItem {
  id: string;
  sequence: number;
  slideType: SlideType;
  title: string;
  layoutVariant: SlideLayoutVariant;
  backgroundColor: string;
  accentColor: string;
  teacherNotes?: string;
  sourceLabel?: string;
  questionNumber?: number;
  elements: SlideElement[];
}

export interface VerbatimQuestionInput {
  id?: string;
  questionNumber: number;
  questionText: string;
  options: [string, string, string, string];
  sourceLabel: string; // e.g., "NEET", "JEE Main", "NCERT", "NCERT Exemplar", "Board", "Other source"
  imageUrl?: string | null;
  explanation?: string | null;
}
