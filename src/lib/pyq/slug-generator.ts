export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-alphanumeric except hyphen and space
    .replace(/[\s_-]+/g, "-") // collapse spaces and underscores into hyphens
    .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens
}

export interface QuestionSlugInput {
  id: string;
  questionCode?: string | null;
  examName?: string | null;
  examCanonicalType?: string | null;
  year?: number | null;
  subject?: string | null;
  chapter?: string | null;
  originalNumber?: number | string | null;
}

/**
 * Builds a deterministic, SEO-friendly, unique slug for a canonical question.
 * Format: [exam]-[year]-[subject]-[chapter]-[code-or-id]
 * Example: "neet-2024-physics-kinematics-q12-qcode123"
 */
export function buildQuestionSlug(input: QuestionSlugInput): string {
  const parts: string[] = [];

  // 1. Exam prefix
  if (input.examCanonicalType) {
    if (input.examCanonicalType === "NEET_UG") parts.push("neet");
    else if (input.examCanonicalType === "JEE_MAIN") parts.push("jee-main");
    else if (input.examCanonicalType === "JEE_ADVANCED") parts.push("jee-advanced");
    else parts.push(slugify(input.examCanonicalType));
  } else if (input.examName) {
    parts.push(slugify(input.examName));
  } else {
    parts.push("pyq");
  }

  // 2. Year
  if (input.year && input.year >= 1980 && input.year <= 2100) {
    parts.push(String(input.year));
  }

  // 3. Subject
  if (input.subject) {
    parts.push(slugify(input.subject));
  }

  // 4. Chapter
  if (input.chapter) {
    // Strip "[Class 11] Ch 2: " prefixes if present
    const cleanChapter = input.chapter.replace(/^\[Class\s+\d+\]\s*(Ch\s*\d+:\s*)?/i, "");
    parts.push(slugify(cleanChapter).slice(0, 35));
  }

  // 5. Question Number
  if (input.originalNumber) {
    parts.push(`q${input.originalNumber}`);
  }

  // 6. Unique suffix to ensure 100% collision resistance
  const uniqueCode = input.questionCode ? slugify(input.questionCode) : input.id.slice(-6).toLowerCase();
  parts.push(uniqueCode);

  return parts.filter(Boolean).join("-");
}

export function buildChapterSlug(chapterTitle: string): string {
  const clean = chapterTitle.replace(/^\[Class\s+\d+\]\s*(Ch\s*\d+:\s*)?/i, "");
  return slugify(clean);
}

export function buildExamSlug(examTypeOrName: string): string {
  const norm = examTypeOrName.toUpperCase();
  if (norm === "NEET_UG" || norm.includes("NEET")) return "neet";
  if (norm === "JEE_MAIN" || norm.includes("JEE MAIN") || norm.includes("JEE_MAINS")) return "jee-main";
  if (norm === "JEE_ADVANCED" || norm.includes("ADVANCED")) return "jee-advanced";
  return slugify(examTypeOrName);
}
