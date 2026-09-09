import type {
  StudyMaterialType,
  StudyMaterialClassExam,
  StudyMaterialLanguage,
} from "@prisma/client";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";

// ---------------------------------------------------------------------------
// Class / Exam
// ---------------------------------------------------------------------------

export const CLASS_EXAMS: { value: StudyMaterialClassExam; label: string }[] = [
  { value: "CLASS_11", label: "11th" },
  { value: "CLASS_12", label: "12th" },
  { value: "NEET", label: "NEET" },
  { value: "JEE", label: "JEE" },
];

export const CLASS_EXAM_LABEL: Record<StudyMaterialClassExam, string> = {
  CLASS_11: "11th",
  CLASS_12: "12th",
  NEET: "NEET",
  JEE: "JEE",
};

/** Valid subjects per Class/Exam (business rule — not chapter data). */
export const SUBJECTS_FOR_CLASS_EXAM: Record<StudyMaterialClassExam, string[]> = {
  CLASS_11: ["Physics", "Chemistry", "Mathematics", "Biology"],
  CLASS_12: ["Physics", "Chemistry", "Biology"],
  NEET: ["Physics", "Chemistry", "Biology"],
  JEE: ["Physics", "Chemistry", "Mathematics"],
};

/** Which NCERT class numbers a Class/Exam pulls chapters from. */
export function classNumbersFor(classExam: StudyMaterialClassExam): number[] {
  switch (classExam) {
    case "CLASS_11":
      return [11];
    case "CLASS_12":
      return [12];
    case "NEET":
    case "JEE":
      return [11, 12];
  }
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

export const LANGUAGES: { value: StudyMaterialLanguage; label: string }[] = [
  { value: "HINDI", label: "Hindi" },
  { value: "ENGLISH", label: "English" },
];

// ---------------------------------------------------------------------------
// Module types (PYQ types only where the Class/Exam matches)
// ---------------------------------------------------------------------------

const BASE_TYPES: { value: StudyMaterialType; label: string; icon: string }[] = [
  { value: "MODULE", label: "Modules", icon: "menu_book" },
  { value: "SHORT_NOTES", label: "Short Notes", icon: "sticky_note_2" },
  { value: "MIND_MAP", label: "Mind Maps", icon: "account_tree" },
  { value: "FORMULA_SHEET", label: "Formula Sheets", icon: "functions" },
  { value: "NCERT_HIGHLIGHTED", label: "NCERT Highlights", icon: "auto_stories" },
  { value: "NCERT_EXEMPLAR", label: "NCERT Exemplar", icon: "library_books" },
];

const NEET_PYQ = { value: "NEET_PYQ" as StudyMaterialType, label: "NEET PYQ", icon: "history_edu" };
const JEE_PYQ = { value: "JEE_PYQ" as StudyMaterialType, label: "JEE PYQ", icon: "history_edu" };

/** Types available for a given Class/Exam. NEET PYQ only under NEET, JEE PYQ only under JEE. */
export function moduleTypesForClassExam(
  classExam: StudyMaterialClassExam | null
): { value: StudyMaterialType; label: string; icon: string }[] {
  if (classExam === "NEET") return [...BASE_TYPES, NEET_PYQ];
  if (classExam === "JEE") return [...BASE_TYPES, JEE_PYQ];
  return BASE_TYPES; // 11th / 12th / nothing selected
}

export const STUDY_MATERIAL_TYPE_LABEL: Record<StudyMaterialType, string> = {
  MODULE: "Modules",
  SHORT_NOTES: "Short Notes",
  MIND_MAP: "Mind Maps",
  FORMULA_SHEET: "Formula Sheets",
  NCERT_HIGHLIGHTED: "NCERT Highlights",
  NCERT_EXEMPLAR: "NCERT Exemplar",
  NEET_PYQ: "NEET PYQ",
  JEE_PYQ: "JEE PYQ",
};

// ---------------------------------------------------------------------------
// Chapters (from the existing NCERT catalogue)
// ---------------------------------------------------------------------------

export type ChapterOption = {
  ncertChapterId: string;
  title: string; // English title
  titleHindi: string | null;
  chapterClass: number;
  label: string; // "[Class 11] Ch 1: Units and Measurements"
};

/**
 * NCERT chapters for a Class/Exam + subject, drawn from the master NCERT
 * catalogue. 11th → Class 11 only, 12th → Class 12 only, NEET/JEE → both.
 */
export function chaptersForClassExam(
  classExam: StudyMaterialClassExam,
  subject: string
): ChapterOption[] {
  const wantedClasses = classNumbersFor(classExam);
  return getMasterNcertChapters(subject)
    .filter((c) => wantedClasses.includes(c.classNumber))
    .map((c) => ({
      ncertChapterId: c.id,
      title: c.title,
      titleHindi: c.titleHindi ?? null,
      chapterClass: c.classNumber,
      label: c.displayTitle,
    }));
}

// ---------------------------------------------------------------------------
// Validation — shared by the admin form and the API
// ---------------------------------------------------------------------------

export type ModuleInput = {
  classExam: StudyMaterialClassExam;
  subject: string;
  ncertChapterId: string | null;
  chapterTitle: string;
  chapterClass: number | null;
  isCustomChapter: boolean;
  language: StudyMaterialLanguage;
  type: StudyMaterialType;
  title: string;
  fileUrl: string;
  fileName: string;
};

/** Returns an error message, or null when the combination is valid. */
export function validateModuleInput(m: Partial<ModuleInput>): string | null {
  if (!m.classExam) return "Class / Exam is required.";
  if (!m.subject) return "Subject is required.";
  if (!m.language) return "Language is required.";
  if (!m.type) return "Module type is required.";
  if (!m.title?.trim()) return "Title is required.";
  if (!m.fileUrl) return "A PDF file is required.";

  if (!SUBJECTS_FOR_CLASS_EXAM[m.classExam].includes(m.subject)) {
    return `${m.subject} is not a valid subject for ${CLASS_EXAM_LABEL[m.classExam]}.`;
  }

  if (m.type === "NEET_PYQ" && m.classExam !== "NEET") {
    return "NEET PYQ can only be added under Class/Exam = NEET.";
  }
  if (m.type === "JEE_PYQ" && m.classExam !== "JEE") {
    return "JEE PYQ can only be added under Class/Exam = JEE.";
  }

  if (m.isCustomChapter) {
    if (!m.chapterTitle?.trim()) return "Custom chapter name is required.";
  } else {
    if (!m.ncertChapterId) return "Select a chapter (or add a custom one).";
    const valid = chaptersForClassExam(m.classExam, m.subject).some(
      (c) => c.ncertChapterId === m.ncertChapterId
    );
    if (!valid) {
      return `That chapter is not part of the ${CLASS_EXAM_LABEL[m.classExam]} ${m.subject} syllabus.`;
    }
  }
  return null;
}

export function formatBytes(n: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
