import "server-only";
import { prisma } from "@/lib/db";

const DEFAULT_SECTION_NAME = "General";

/**
 * Simple batch-scheduled tests (and most standalone tests created via the
 * existing team-portal UI) don't expose the new multi-section structure —
 * they still work with "the test's questions" as one flat list. This
 * auto-creates a single Section named "General" per test the first time
 * it's needed, so the UI/API layer above doesn't have to change to
 * accommodate the new Test -> Section -> SectionQuestion -> Question chain
 * introduced by the Test Portal schema merge. Multi-section tests (Test
 * Series builder, Phase D) create their own named sections directly and
 * never call this.
 */
export async function getOrCreateDefaultSection(testId: string) {
  const existing = await prisma.section.findFirst({
    where: { testId },
    orderBy: { order: "asc" },
  });
  if (existing) return existing;

  return prisma.section.create({
    data: { testId, name: DEFAULT_SECTION_NAME, order: 0, subject: "General" },
  });
}

/** All questions attached to a test via its section(s), flattened and ordered. */
export async function listTestSectionQuestions(testId: string) {
  return prisma.sectionQuestion.findMany({
    where: { section: { testId } },
    include: { question: { include: { translations: true } } },
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
  });
}

export async function countTestQuestions(testId: string) {
  return prisma.sectionQuestion.count({ where: { section: { testId } } });
}

export async function nextSectionQuestionOrder(sectionId: string) {
  const max = await prisma.sectionQuestion.aggregate({
    where: { sectionId },
    _max: { order: true },
  });
  return (max._max.order ?? 0) + 1;
}

/**
 * Clones template sections into real Test Section records and binds the
 * template to the test. If default or empty sections exist with no questions,
 * replaces them cleanly with the structured template sections.
 */
export async function createSectionsFromTemplate(testId: string, templateId: string) {
  const template = await prisma.testTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  if (!template) {
    throw new Error("Test template not found");
  }

  // Check if test has questions in existing sections
  const existingQuestions = await prisma.sectionQuestion.count({
    where: { section: { testId } },
  });

  if (existingQuestions > 0) {
    throw new Error("Cannot apply template to a test that already has questions assigned");
  }

  // Delete any empty default section created previously
  await prisma.section.deleteMany({
    where: { testId },
  });

  // Create sections matching template configuration
  await prisma.$transaction([
    prisma.test.update({
      where: { id: testId },
      data: { templateId },
    }),
    ...template.sections.map((sec, idx) =>
      prisma.section.create({
        data: {
          testId,
          name: sec.name,
          subject: sec.subject,
          targetCount: sec.targetCount,
          marksPerQuestion: sec.marksPerQuestion,
          negativeMarks: sec.negativeMarks,
          order: sec.order ?? idx,
        },
      })
    ),
  ]);

  return prisma.section.findMany({
    where: { testId },
    orderBy: { order: "asc" },
  });
}

/**
 * Returns detailed section summary including question counts, target counts, and marks.
 */
export async function getTestSectionBreakdown(testId: string) {
  return prisma.section.findMany({
    where: { testId },
    include: {
      _count: { select: { questions: true } },
      questions: {
        include: {
          question: {
            include: {
              translations: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });
}

