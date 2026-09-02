import "server-only";
import { prisma } from "@/lib/db";

const DEFAULT_SECTION_NAME = "General";

export const PRESET_BLUEPRINTS = {
  NEET: {
    name: "NEET UG Blueprint (180Q / 720 Marks)",
    durationMin: 200,
    sections: [
      { name: "Physics Section A", subject: "Physics", targetCount: 35, marksPerQuestion: 4, negativeMarks: -1, order: 0 },
      { name: "Physics Section B", subject: "Physics", targetCount: 15, marksPerQuestion: 4, negativeMarks: -1, order: 1 },
      { name: "Chemistry Section A", subject: "Chemistry", targetCount: 35, marksPerQuestion: 4, negativeMarks: -1, order: 2 },
      { name: "Chemistry Section B", subject: "Chemistry", targetCount: 15, marksPerQuestion: 4, negativeMarks: -1, order: 3 },
      { name: "Botany Section A", subject: "Biology", targetCount: 35, marksPerQuestion: 4, negativeMarks: -1, order: 4 },
      { name: "Botany Section B", subject: "Biology", targetCount: 15, marksPerQuestion: 4, negativeMarks: -1, order: 5 },
      { name: "Zoology Section A", subject: "Biology", targetCount: 35, marksPerQuestion: 4, negativeMarks: -1, order: 6 },
      { name: "Zoology Section B", subject: "Biology", targetCount: 15, marksPerQuestion: 4, negativeMarks: -1, order: 7 },
    ],
  },
  JEE: {
    name: "JEE Main Blueprint (90Q / 300 Marks)",
    durationMin: 180,
    sections: [
      { name: "Physics", subject: "Physics", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 0 },
      { name: "Chemistry", subject: "Chemistry", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 1 },
      { name: "Mathematics", subject: "Mathematics", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 2 },
    ],
  },
  CHAPTER_TEST: {
    name: "Chapter Assessment (30Q / 120 Marks)",
    durationMin: 60,
    sections: [
      { name: "Section A (Single Choice)", subject: "General", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 0 },
    ],
  },
};

/**
 * Simple batch-scheduled tests don't expose multi-section structure upfront —
 * this auto-creates a single Section named "General" per test the first time
 * it's needed.
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
 * Instantiates section structure from a known systematic preset (NEET, JEE, CHAPTER_TEST).
 */
export async function createSectionsFromPreset(testId: string, preset: "NEET" | "JEE" | "CHAPTER_TEST") {
  const blueprint = PRESET_BLUEPRINTS[preset];
  if (!blueprint) throw new Error("Unknown preset blueprint");

  await prisma.section.deleteMany({ where: { testId } });

  await prisma.$transaction([
    prisma.test.update({
      where: { id: testId },
      data: {
        durationMin: blueprint.durationMin,
        examType: preset,
      },
    }),
    ...blueprint.sections.map((sec, idx) =>
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
