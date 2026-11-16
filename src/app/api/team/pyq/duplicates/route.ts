import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";

/**
 * GET /api/team/pyq/duplicates
 * Lists duplicate candidate pairs with both questions' statement, options,
 * subject, chapter, and occurrences for human review.
 */
export async function GET(request: NextRequest) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") || "PENDING";
    const page = Math.max(1, Number(sp.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") || 20)));

    const where = status === "ALL" ? {} : { status };

    const [total, items] = await Promise.all([
      prisma.questionDuplicateCandidate.count({ where }),
      prisma.questionDuplicateCandidate.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          questionA: {
            select: {
              id: true,
              questionCode: true,
              subject: true,
              chapter: true,
              topic: true,
              solution: true,
              translations: {
                select: { language: true, statement: true, options: true, correctOptionIds: true },
              },
              pyqOccurrences: {
                select: {
                  year: true,
                  session: true,
                  shift: true,
                  paper: true,
                  questionNumber: true,
                  exam: { select: { name: true } },
                },
              },
            },
          },
          questionB: {
            select: {
              id: true,
              questionCode: true,
              subject: true,
              chapter: true,
              topic: true,
              solution: true,
              translations: {
                select: { language: true, statement: true, options: true, correctOptionIds: true },
              },
              pyqOccurrences: {
                select: {
                  year: true,
                  session: true,
                  shift: true,
                  paper: true,
                  questionNumber: true,
                  exam: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return apiSuccess({
      total,
      page,
      pageSize,
      items,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
