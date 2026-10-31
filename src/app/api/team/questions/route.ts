import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createQuestion, type TranslationInput } from "@/lib/questions/question-management-service";
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
import { triggerQuestionVerification } from "@/lib/questions/verification-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const subTopic = searchParams.get("subTopic")?.trim();
    const difficulty = searchParams.get("difficulty")?.trim();
    const type = searchParams.get("type")?.trim();
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: any = {};
    if (subject) where.subject = subject;
    if (topic) where.topic = topic;
    if (subTopic) where.subTopic = subTopic;
    if (difficulty) where.difficulty = difficulty;
    if (type) where.type = type;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { questionCode: { contains: search, mode: "insensitive" } },
        { chapter: { contains: search, mode: "insensitive" } },
        { topic: { contains: search, mode: "insensitive" } },
        {
          translations: {
            some: {
              statement: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          translations: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
    ]);

    return apiSuccess({
      questions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
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

    // Centralized create: Question ID claimed concurrency-safely, fingerprint
    // computed, and an exact-duplicate submission returns the existing question.
    const result = await createQuestion(
      {
        subject,
        chapter,
        type: legacyTypeToQuestionType(data.type),
        difficulty: data.difficulty,
        tags: legacyTagsToString(data.tags),
        createdById: session.user.id,
        status: "DRAFT",
        version: 1,
      },
      legacyToTranslationCreate(data) as unknown as TranslationInput[],
      { sourceLabel: "MANUAL" }
    );
    // Full record (with translations) for the response + verification trigger.
    const question = await prisma.question.findUnique({
      where: { id: result.question.id },
      include: { translations: true },
    });
    if (!question) throw new Error("Question not found after create.");

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_CREATE",
        entityType: "Question",
        entityId: question.id,
      },
    });

    // Automatically trigger non-blocking Multi-AI Verification across all 4 providers
    triggerQuestionVerification(question.id, {
      triggerSource: "MANUAL",
      userId: session.user.id,
    }).catch((err) => {
      console.error(`[MultiAiVerification] Background trigger failed for ${question.id}:`, err);
    });

    return apiSuccess({ question }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
