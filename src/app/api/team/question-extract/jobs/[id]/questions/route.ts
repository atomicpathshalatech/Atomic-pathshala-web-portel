import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status")?.trim();
    const query = searchParams.get("query")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const questionType = searchParams.get("type")?.trim();

    const where: any = { jobId: params.id };

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (subject && subject !== "ALL") {
      where.subject = { equals: subject, mode: "insensitive" };
    }
    if (questionType && questionType !== "ALL") {
      where.questionType = questionType;
    }
    if (query) {
      where.OR = [
        { statement: { contains: query, mode: "insensitive" } },
        { chapter: { contains: query, mode: "insensitive" } },
        { topic: { contains: query, mode: "insensitive" } },
        { originalNumber: isNaN(parseInt(query, 10)) ? undefined : parseInt(query, 10) },
      ].filter(Boolean);
    }

    const questions = await prisma.extractedQuestion.findMany({
      where,
      orderBy: { originalNumber: "asc" },
    });

    return apiSuccess({
      questions,
      count: questions.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
