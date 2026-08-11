import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { questionSchema } from "@/lib/validation/question";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const difficulty = searchParams.get("difficulty");
    const subjectId = searchParams.get("subjectId");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = 20;

    const where = {
      ...(search ? { body: { contains: search, mode: "insensitive" as const } } : {}),
      ...(status ? { status: status as "PENDING" | "VERIFIED" | "FLAGGED" } : {}),
      ...(difficulty
        ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" | "ADVANCED" }
        : {}),
      ...(subjectId ? { subjectId } : {}),
    };

    const [questions, total, statusCounts, difficultyCounts] = await Promise.all([
      prisma.question.findMany({
        where,
        include: { subject: true, chapter: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
      prisma.question.groupBy({ by: ["status"], _count: true }),
      prisma.question.groupBy({ by: ["difficulty"], _count: true }),
    ]);

    return apiSuccess({
      questions,
      total,
      page,
      pageSize,
      statusCounts,
      difficultyCounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const data = questionSchema.parse(body);

    const question = await prisma.question.create({
      data: {
        body: data.body,
        type: data.type,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        optionC: data.optionC || null,
        optionD: data.optionD || null,
        correctOption: data.correctOption,
        explanation: data.explanation || null,
        marksCorrect: data.marksCorrect,
        marksIncorrect: data.marksIncorrect,
        difficulty: data.difficulty,
        tags: data.tags,
        subjectId: data.subjectId || null,
        chapterId: data.chapterId || null,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_CREATE",
        entityType: "Question",
        entityId: question.id,
      },
    });

    return apiSuccess({ question }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
