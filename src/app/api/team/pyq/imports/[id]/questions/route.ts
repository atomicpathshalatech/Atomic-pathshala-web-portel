import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { approvalBlockers } from "@/lib/pyq/review-service";

/**
 * GET ?view=pending|approved|rejected|all&issue=chapter|duplicate|year|answer&page=&pageSize=
 * Extracted questions of one import, in source order, with what still
 * blocks approval and (for duplicate warnings) the existing question.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const sp = request.nextUrl.searchParams;
    const view = sp.get("view") || "pending";
    const issue = sp.get("issue");
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || "25", 10) || 25));
    const where: Prisma.ExtractedQuestionWhereInput = { jobId: params.id };
    if (view === "pending") where.reviewDecision = { in: ["PENDING", "APPROVING"] };
    else if (view === "approved") where.reviewDecision = "APPROVED";
    else if (view === "rejected") where.reviewDecision = "REJECTED";
    if (issue === "chapter") where.needsChapterReview = true;
    if (issue === "duplicate") where.duplicateDecision = "PENDING";
    if (issue === "year") where.pyqYear = null;
    if (issue === "answer") where.correctAnswer = "";

    const [total, rows] = await Promise.all([
      prisma.extractedQuestion.count({ where }),
      prisma.extractedQuestion.findMany({
        where,
        orderBy: [{ sourcePage: "asc" }, { questionIndex: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { pyqExamRef: { select: { id: true, name: true } } },
      }),
    ]);
    const dupIds = Array.from(new Set(rows.map((r) => r.duplicateOfQuestionId).filter(Boolean) as string[]));
    const dups = await prisma.question.findMany({
      where: { id: { in: dupIds } },
      select: {
        id: true,
        questionCode: true,
        subject: true,
        chapter: true,
        translations: { where: { language: "ENGLISH" }, select: { statement: true, options: true, correctOptionIds: true }, take: 1 },
        pyqOccurrences: { select: { year: true, session: true, shift: true, verificationStatus: true, exam: { select: { name: true } } } },
      },
    });
    const dupBy = new Map(dups.map((d) => [d.id, d]));
    return apiSuccess({
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        ...r,
        originalSnapshot: undefined,
        blockers: r.reviewDecision === "PENDING" ? approvalBlockers(r) : [],
        sourcePageUrl: r.sourcePdfUrl ? `${r.sourcePdfUrl}#page=${r.sourcePage}` : null,
        duplicateOf: r.duplicateOfQuestionId ? dupBy.get(r.duplicateOfQuestionId) ?? null : null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
