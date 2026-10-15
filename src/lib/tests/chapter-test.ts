import "server-only";
import { prisma } from "@/lib/db";

/**
 * A chapter test has one section: the chapter's own subject, with as many
 * questions as the team chose (NEET-style default: 90 for Biology, 45 for
 * Physics / Chemistry). Without a section the question studio showed the
 * full NEET paper (Biology 90 + Physics 45 + Chemistry 45) for every chapter.
 */
export const CHAPTER_TEST_MAX_QUESTIONS = 200;

export function isBiologySubject(subjectTitle: string | null | undefined): boolean {
  return /bio|botany|zoology/i.test(subjectTitle ?? "");
}

export function defaultChapterTestQuestionCount(subjectTitle: string | null | undefined): number {
  return isBiologySubject(subjectTitle) ? 90 : 45;
}

/** The number of questions asked for, or null if it is not a whole number from 1 to 200. */
export function parseQuestionCount(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > CHAPTER_TEST_MAX_QUESTIONS) return null;
  return n;
}

/** Creates the chapter test's section (if it has none) or sets its question count. */
export async function setChapterTestSection(
  testId: string,
  opts: { subjectTitle: string; questionCount: number; marksPerQuestion?: number; negativeMarks?: number }
) {
  const sections = await prisma.section.findMany({ where: { testId }, orderBy: { order: "asc" } });
  if (sections.length === 0) {
    return prisma.section.create({
      data: {
        testId,
        name: opts.subjectTitle,
        subject: opts.subjectTitle,
        order: 0,
        targetCount: opts.questionCount,
        ...(opts.marksPerQuestion !== undefined && { marksPerQuestion: opts.marksPerQuestion }),
        ...(opts.negativeMarks !== undefined && { negativeMarks: opts.negativeMarks }),
      },
    });
  }
  if (sections.length === 1) {
    return prisma.section.update({ where: { id: sections[0]!.id }, data: { targetCount: opts.questionCount } });
  }
  return null; // a test with several sections is managed from its own page
}

/** For a chapter test made before sections were created at once: give it its chapter's section. */
export async function ensureChapterTestSection(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      chapterId: true,
      correctMarks: true,
      incorrectMarks: true,
      chapter: { select: { subject: { select: { title: true } } } },
      _count: { select: { sections: true } },
    },
  });
  if (!test?.chapterId || test._count.sections > 0 || !test.chapter) return;
  const subjectTitle = test.chapter.subject.title;
  await setChapterTestSection(testId, {
    subjectTitle,
    questionCount: defaultChapterTestQuestionCount(subjectTitle),
    marksPerQuestion: test.correctMarks,
    negativeMarks: test.incorrectMarks,
  });
}
