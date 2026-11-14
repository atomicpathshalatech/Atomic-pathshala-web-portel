import "server-only";
import { prisma } from "@/lib/db";
import { generateQuestionId } from "@/lib/questions/id-generator";

/**
 * Re-sequences all questions in an extraction job to guarantee continuous 1..N
 * physical source sequence order and pre-assigns unique canonical Question IDs.
 */
export async function ensureBatchSequenceAndCodes(jobId: string): Promise<{
  totalCount: number;
  firstQuestionCode?: string;
  lastQuestionCode?: string;
}> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
    select: { id: true, subject: true },
  });

  if (!job) {
    throw new Error(`Extraction job ${jobId} not found.`);
  }

  const questions = await prisma.extractedQuestion.findMany({
    where: { jobId },
    select: {
      id: true,
      sourcePage: true,
      originalNumber: true,
      sourceSequenceNumber: true,
      assignedQuestionCode: true,
      createdAt: true,
    },
    orderBy: [
      { sourcePage: "asc" },
      { originalNumber: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  if (questions.length === 0) {
    return { totalCount: 0 };
  }

  const subject = job.subject || "Chemistry";
  let seq = 1;

  for (const q of questions) {
    let assignedCode = q.assignedQuestionCode;
    if (!assignedCode) {
      assignedCode = await generateQuestionId(prisma as any, subject);
    }

    if (q.sourceSequenceNumber !== seq || q.assignedQuestionCode !== assignedCode) {
      await prisma.extractedQuestion.update({
        where: { id: q.id },
        data: {
          sourceSequenceNumber: seq,
          assignedQuestionCode: assignedCode,
        },
      });
    }

    seq++;
  }

  // Fetch updated first and last
  const updatedFirst = await prisma.extractedQuestion.findFirst({
    where: { jobId, sourceSequenceNumber: 1 },
    select: { assignedQuestionCode: true },
  });

  const updatedLast = await prisma.extractedQuestion.findFirst({
    where: { jobId, sourceSequenceNumber: questions.length },
    select: { assignedQuestionCode: true },
  });

  // Reconcile extraction job counts
  const [total, verified, review, error, dup, approved] = await Promise.all([
    prisma.extractedQuestion.count({ where: { jobId } }),
    prisma.extractedQuestion.count({ where: { jobId, status: "VERIFIED" } }),
    prisma.extractedQuestion.count({ where: { jobId, status: "REVIEW_REQUIRED" } }),
    prisma.extractedQuestion.count({ where: { jobId, status: "EXTRACTION_ERROR" } }),
    prisma.extractedQuestion.count({ where: { jobId, status: "DUPLICATE" } }),
    prisma.extractedQuestion.count({ where: { jobId, approvalStatus: "APPROVED" } }),
  ]);

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      extractedCount: total,
      verifiedCount: verified,
      reviewCount: review,
      errorCount: error,
      duplicateCount: dup,
      status:
        approved === total && total > 0
          ? "IMPORTED"
          : error > 0
          ? "FAILED"
          : review > 0
          ? "REVIEW_REQUIRED"
          : "VERIFIED",
    },
  });

  return {
    totalCount: questions.length,
    firstQuestionCode: updatedFirst?.assignedQuestionCode || undefined,
    lastQuestionCode: updatedLast?.assignedQuestionCode || undefined,
  };
}
