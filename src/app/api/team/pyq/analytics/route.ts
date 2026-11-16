import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";

/**
 * GET /api/team/pyq/analytics
 * Real-time analytics dashboard metrics computed directly from database records.
 */
export async function GET(request: NextRequest) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);

    const [
      totalQuestions,
      publishedQuestions,
      pendingQcQuestions,
      duplicateCandidatesCount,
      failedImportsCount,
      examsWithCounts,
      subjectCounts,
      yearCounts,
      aiLogs,
    ] = await Promise.all([
      // Total questions with at least one verified PYQ occurrence
      prisma.question.count({
        where: {
          pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
        },
      }),

      // Published questions
      prisma.question.count({
        where: {
          isPublished: true,
          pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
        },
      }),

      // Extracted questions awaiting QC review
      prisma.extractedQuestion.count({
        where: { reviewDecision: "PENDING" },
      }),

      // Unresolved duplicate candidates
      prisma.questionDuplicateCandidate.count({
        where: { status: "PENDING" },
      }),

      // Failed imports
      prisma.extractionJob.count({
        where: { isPyqImport: true, status: "FAILED" },
      }),

      // Exam breakdown
      prisma.pyqExam.findMany({
        where: { isActive: true },
        select: {
          id: true,
          slug: true,
          name: true,
          canonicalType: true,
          _count: {
            select: {
              occurrences: { where: { verificationStatus: "VERIFIED" } },
            },
          },
        },
      }),

      // Subject distribution
      prisma.question.groupBy({
        by: ["subject"],
        where: {
          pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
        },
        _count: { id: true },
      }),

      // Year distribution
      prisma.pyqOccurrence.groupBy({
        by: ["year"],
        where: { verificationStatus: "VERIFIED", year: { not: null } },
        _count: { id: true },
        orderBy: { year: "desc" },
      }),

      // AI Usage summary
      prisma.aiUsageLog.findMany({
        select: {
          provider: true,
          inputTokens: true,
          outputTokens: true,
          durationMs: true,
          ok: true,
        },
        take: 1000,
      }),
    ]);

    // Compute AI metrics
    let geminiCalls = 0;
    let openaiCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const log of aiLogs) {
      if (log.provider.toLowerCase().includes("gemini")) geminiCalls++;
      else if (log.provider.toLowerCase().includes("openai")) openaiCalls++;
      totalInputTokens += log.inputTokens ?? 0;
      totalOutputTokens += log.outputTokens ?? 0;
    }

    // Estimate cost in INR:
    // Gemini: $0.075 / 1M input, $0.30 / 1M output -> rate ~ 87 INR/USD
    // OpenAI: $2.50 / 1M input, $10.00 / 1M output
    const geminiCostInr =
      ((totalInputTokens * 0.075 + totalOutputTokens * 0.3) / 1_000_000) * 87.0;
    const estimatedCostInr = Math.max(0, Number(geminiCostInr.toFixed(2)));

    // Map exam counts
    const examMap: Record<string, number> = {};
    for (const e of examsWithCounts) {
      examMap[e.canonicalType] = (examMap[e.canonicalType] ?? 0) + e._count.occurrences;
    }

    return apiSuccess({
      totalQuestions,
      publishedQuestions,
      pendingQcQuestions,
      duplicateCandidatesCount,
      failedImportsCount,
      neetQuestions: examMap["NEET_UG"] ?? 0,
      jeeMainQuestions: examMap["JEE_MAIN"] ?? 0,
      jeeAdvancedQuestions: examMap["JEE_ADVANCED"] ?? 0,
      exams: examsWithCounts.map((e) => ({
        id: e.id,
        name: e.name,
        slug: e.slug,
        count: e._count.occurrences,
      })),
      subjects: subjectCounts.map((s) => ({
        name: s.subject,
        count: s._count.id,
      })),
      years: yearCounts.map((y) => ({
        year: y.year,
        count: y._count.id,
      })),
      aiTelemetry: {
        geminiCalls,
        openaiCalls,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostInr,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
