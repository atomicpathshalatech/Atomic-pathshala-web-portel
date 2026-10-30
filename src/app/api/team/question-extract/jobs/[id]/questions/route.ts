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
    const approvalStatus = searchParams.get("approvalStatus")?.trim();
    const query = searchParams.get("query")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const pageNum = searchParams.get("page")?.trim();
    const questionType = searchParams.get("type")?.trim();

    const where: any = { jobId: params.id };

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (approvalStatus && approvalStatus !== "ALL") {
      where.approvalStatus = approvalStatus;
    }
    if (subject && subject !== "ALL") {
      where.subject = { equals: subject, mode: "insensitive" };
    }
    if (chapter && chapter !== "ALL") {
      where.chapter = { equals: chapter, mode: "insensitive" };
    }
    if (topic && topic !== "ALL") {
      where.topic = { equals: topic, mode: "insensitive" };
    }
    if (pageNum && !isNaN(parseInt(pageNum, 10))) {
      where.sourcePage = parseInt(pageNum, 10);
    }
    if (questionType && questionType !== "ALL") {
      where.questionType = questionType;
    }
    if (query) {
      const qNum = parseInt(query.replace(/[^\d]/g, ""), 10);
      where.OR = [
        { statement: { contains: query, mode: "insensitive" } },
        { assignedQuestionCode: { contains: query, mode: "insensitive" } },
        { chapter: { contains: query, mode: "insensitive" } },
        { topic: { contains: query, mode: "insensitive" } },
        { subTopic: { contains: query, mode: "insensitive" } },
        ...(!isNaN(qNum)
          ? [
              { originalNumber: qNum },
              { sourceSequenceNumber: qNum },
            ]
          : []),
      ];
    }

    // MANDATORY REQUIREMENT: Strictly preserve original PDF source sequence order
    const questions = await prisma.extractedQuestion.findMany({
      where,
      orderBy: [
        { sourceSequenceNumber: "asc" },
        { sourcePage: "asc" },
        { originalNumber: "asc" },
        { id: "asc" },
      ],
    });

    return apiSuccess({
      questions,
      count: questions.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
