import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { questionSchema } from "@/lib/validation/question";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import {
  legacyToTranslationCreate,
  legacyTypeToQuestionType,
  legacyTagsToString,
  resolveSubjectChapterNames,
} from "@/lib/questions/legacy";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const difficulty = searchParams.get("difficulty");
    // Question.subject is now a plain string (not a Subject relation), so
    // the old subjectId filter no longer applies here directly — dropped.
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = 20;

    const where = {
      ...(search
        ? { translations: { some: { statement: { contains: search, mode: "insensitive" as const } } } }
        : {}),
      ...(status === "PUBLISHED" ? { isPublished: true } : {}),
      ...(status === "PENDING" ? { isPublished: false } : {}),
      ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
    };

    const [questions, total, statusCounts, difficultyCounts] = await Promise.all([
      prisma.question.findMany({
        where,
        include: { translations: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
      prisma.question.groupBy({ by: ["isPublished"], _count: true }),
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

    const { subject, chapter } = await resolveSubjectChapterNames(prisma, data.subjectId, data.chapterId);

    const question = await prisma.question.create({
      data: {
        subject,
        chapter,
        type: legacyTypeToQuestionType(data.type),
        difficulty: data.difficulty,
        tags: legacyTagsToString(data.tags),
        createdById: session.user.id,
        translations: {
          create: legacyToTranslationCreate(data),
        },
      },
      include: { translations: true },
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
