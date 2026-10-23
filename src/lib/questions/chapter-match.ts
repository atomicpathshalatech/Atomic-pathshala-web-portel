import type { Prisma } from "@prisma/client";
import { canonicalChapter, canonicalSubject, chapterKey } from "@/lib/academic/canonical-chapter";

/**
 * The questions of one chapter, matched on the standard chapter name.
 *
 * Assignments used `chapter CONTAINS x OR category CONTAINS x`, so "Cell"
 * also pulled in "Cell Cycle and Cell Division", and the category text
 * matched questions of other chapters. Questions are now stored under the
 * NCERT master title (question-chapter-middleware), so this is an exact,
 * case-insensitive match on that title. Biology also covers questions
 * filed under Botany / Zoology.
 */
export function chapterQuestionWhere(subject: string, chapter: string): Prisma.QuestionWhereInput {
  const subj = canonicalSubject(subject) || subject.trim();
  const subjects = subj === "Biology" ? ["Biology", "Botany", "Zoology"] : [subj];
  const title = canonicalChapter(subj, chapter)?.chapter ?? cleanChapterLabel(chapter);
  return {
    OR: subjects.map((s) => ({ subject: { equals: s, mode: "insensitive" as const } })),
    chapter: { equals: title, mode: "insensitive" },
  };
}

/** "[Class 11] Ch 8: Cell…" → "Cell…" for names that aren't in the master list. */
export function cleanChapterLabel(chapter: string): string {
  return chapter
    .replace(/^\s*\[\s*class\s*\d+\s*\]\s*/i, "")
    .replace(/^\s*ch(?:apter)?\.?\s*\d+\s*[:.\-–]?\s*/i, "")
    .replace(/^\s*\d+\s*[.:\-–)]\s*/, "")
    .trim();
}

/** The chapter name to store on an assignment: the master title when it matches. */
export function standardAssignmentChapter(subject: string, chapter: string): string {
  return canonicalChapter(subject, chapter)?.chapter ?? cleanChapterLabel(chapter);
}

export { chapterKey };
