import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { analyzeQuestionSimilarity } from "@/lib/questions/similarity";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await request.json();
    const report = await analyzeQuestionSimilarity(prisma, {
      statementEn: body.statementEn,
      statementHi: body.statementHi,
      subject: body.subject,
      chapter: body.chapter,
      topic: body.topic,
      optionsEn: body.optionsEn,
      optionsHi: body.optionsHi,
      excludeQuestionId: body.excludeQuestionId,
    });

    return apiSuccess({ report });
  } catch (error) {
    return handleApiError(error);
  }
}