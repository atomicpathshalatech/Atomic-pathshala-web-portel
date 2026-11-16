import { prisma } from "@/lib/db";
import { buildQuestionSlug } from "./slug-generator";

/**
 * Ensures questions with verified PYQ occurrences or published status have SEO slugs.
 */
export async function backfillQuestionSlugs(batchSize = 200): Promise<number> {
  const questions = await prisma.question.findMany({
    where: { slug: null },
    take: batchSize,
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      pyqExam: true,
      pyqYear: true,
      pyqQuestionNumber: true,
      pyqOccurrences: {
        where: { verificationStatus: "VERIFIED" },
        take: 1,
        select: {
          year: true,
          questionNumber: true,
          exam: { select: { name: true, canonicalType: true } },
        },
      },
    },
  });

  let updated = 0;
  for (const q of questions) {
    const occ = q.pyqOccurrences[0];
    const slug = buildQuestionSlug({
      id: q.id,
      questionCode: q.questionCode,
      examName: occ?.exam?.name ?? q.pyqExam,
      examCanonicalType: occ?.exam?.canonicalType ?? null,
      year: occ?.year ?? q.pyqYear,
      subject: q.subject,
      chapter: q.chapter,
      originalNumber: occ?.questionNumber ?? q.pyqQuestionNumber,
    });

    try {
      await prisma.question.update({
        where: { id: q.id },
        data: { slug },
      });
      updated++;
    } catch {
      // If a collision happens, append a slice of the ID
      await prisma.question.update({
        where: { id: q.id },
        data: { slug: `${slug}-${q.id.slice(-4)}` },
      }).catch(() => undefined);
    }
  }

  return updated;
}
