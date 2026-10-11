import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { loadQcQuestion } from "@/lib/qc/pipeline";
import { qcContentHash } from "@/lib/qc/question";

export const dynamic = "force-dynamic";

// Everything QC knows about one question: what was reviewed, what each agent
// answered, every finding with the Director's verdict, and the proposals.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const row = await prisma.question.findUnique({
      where: { id: params.id },
      select: { id: true, questionCode: true, status: true, version: true, qcStatus: true, qcHash: true, qcReviewedAt: true },
    });
    if (!row) return apiError("Question not found", 404);

    const [question, reviews, corrections] = await Promise.all([
      loadQcQuestion(params.id),
      prisma.qcReview.findMany({
        where: { questionId: params.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { findings: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.qcCorrection.findMany({ where: { questionId: params.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    ]);

    // The latest finished pair (or the latest error) for the content that was reviewed last.
    const latestHash = reviews[0]?.contentHash ?? null;
    const latest = reviews.filter((r) => r.contentHash === latestHash);
    const expert = latest.find((r) => r.agent === "EXPERT") ?? null;
    const director = latest.find((r) => r.agent === "DIRECTOR") ?? null;

    return apiSuccess({
      question: row,
      content: question,
      // The question was edited after its last review: the status shown is for older content.
      changedSinceReview: Boolean(question && row.qcHash && qcContentHash(question) !== row.qcHash),
      expert,
      director,
      corrections,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
