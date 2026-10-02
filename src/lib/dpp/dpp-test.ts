import "server-only";
import { prisma } from "@/lib/db";

/**
 * A chapter DPP is attempted through the regular test engine (exam room,
 * timer, autosave, submit, result, analysis, PDF). Each DPP gets one backing
 * Test — code "DPPT-<dpp id>", testType "DPP" — whose single section mirrors
 * the DPP's questions in order. It is not linked to any batch, series or
 * chapter, so it never shows up in test lists; it is opened only from the DPP.
 */

export const dppTestCode = (dppId: string) => `DPPT-${dppId}`;

const isPublishedDpp = (status: string) => status === "PUBLISHED" || status === "ACTIVE";

/** Creates / syncs the DPP's backing test. Returns null if the DPP doesn't exist or has no questions. */
export async function ensureDppTest(dppId: string): Promise<{ testId: string; published: boolean } | null> {
  const dpp = await prisma.dpp.findUnique({
    where: { id: dppId },
    include: { questions: { orderBy: { order: "asc" }, select: { questionId: true } } },
  });
  if (!dpp || dpp.questions.length === 0) return null;

  const code = dppTestCode(dpp.id);
  const published = isPublishedDpp(dpp.status);
  const fields = {
    name: dpp.name,
    durationMin: Math.max(1, dpp.estimatedTimeMin || 30),
    correctMarks: dpp.correctMarks,
    incorrectMarks: dpp.incorrectMarks,
    negativeMarkingEnabled: dpp.negativeMarkingEnabled,
    languageMode: dpp.languageMode,
    instructions: dpp.instructions,
    description: dpp.description,
    testType: "DPP",
    examType: "DPP",
    status: (published ? "PUBLISHED" : "DRAFT") as "PUBLISHED" | "DRAFT",
  };
  const wanted = dpp.questions.map((q) => q.questionId);

  const existing = await prisma.test.findUnique({
    where: { code },
    include: { sections: { orderBy: { order: "asc" }, include: { questions: { orderBy: { order: "asc" }, select: { questionId: true } } } } },
  });

  if (!existing) {
    const created = await prisma.test.create({
      data: {
        ...fields,
        code,
        createdById: dpp.createdById,
        sections: {
          create: {
            name: dpp.chapter || dpp.subject || "DPP",
            subject: dpp.subject || "General",
            order: 0,
            targetCount: wanted.length,
            marksPerQuestion: dpp.correctMarks,
            negativeMarks: dpp.incorrectMarks,
            questions: { create: wanted.map((questionId, order) => ({ questionId, order })) },
          },
        },
      },
      select: { id: true },
    });
    return { testId: created.id, published };
  }

  const section = existing.sections[0];
  const current = section?.questions.map((q) => q.questionId) ?? [];
  const same = current.length === wanted.length && current.every((id, i) => id === wanted[i]);
  await prisma.$transaction([
    prisma.test.update({ where: { id: existing.id }, data: { ...fields, archived: false } }),
    ...(section
      ? same
        ? [prisma.section.update({ where: { id: section.id }, data: { targetCount: wanted.length, marksPerQuestion: dpp.correctMarks, negativeMarks: dpp.incorrectMarks } })]
        : [
            prisma.sectionQuestion.deleteMany({ where: { sectionId: section.id } }),
            prisma.section.update({
              where: { id: section.id },
              data: {
                targetCount: wanted.length,
                marksPerQuestion: dpp.correctMarks,
                negativeMarks: dpp.incorrectMarks,
                questions: { create: wanted.map((questionId, order) => ({ questionId, order })) },
              },
            }),
          ]
      : [
          prisma.section.create({
            data: {
              testId: existing.id,
              name: dpp.chapter || dpp.subject || "DPP",
              subject: dpp.subject || "General",
              order: 0,
              targetCount: wanted.length,
              marksPerQuestion: dpp.correctMarks,
              negativeMarks: dpp.incorrectMarks,
              questions: { create: wanted.map((questionId, order) => ({ questionId, order })) },
            },
          }),
        ]),
  ]);
  return { testId: existing.id, published };
}
