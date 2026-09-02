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
    const subject = searchParams.get("subject")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const subTopic = searchParams.get("subTopic")?.trim();
    const difficulty = searchParams.get("difficulty")?.trim();
    const type = searchParams.get("type")?.trim();
    const status = searchParams.get("status")?.trim();
    const createdById = searchParams.get("createdById")?.trim();
    const reviewedById = searchParams.get("reviewedById")?.trim();
    const editedById = searchParams.get("editedById")?.trim();
    const onlyPublished = searchParams.get("onlyPublished") === "true";

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

    const where: any = {};

    if (search) {
      where.OR = [
        { questionCode: { contains: search, mode: "insensitive" } },
        { tags: { contains: search, mode: "insensitive" } },
        { translations: { some: { statement: { contains: search, mode: "insensitive" } } } },
        { translations: { some: { solution: { contains: search, mode: "insensitive" } } } },
      ];
    }

    if (subject && subject !== "ALL") {
      where.subject = { equals: subject, mode: "insensitive" };
    }

    if (topic && topic !== "ALL") {
      where.OR = [
        { topic: { contains: topic, mode: "insensitive" } },
        { chapter: { contains: topic, mode: "insensitive" } },
      ];
    }

    if (subTopic && subTopic !== "ALL") {
      where.subTopic = { contains: subTopic, mode: "insensitive" };
    }

    if (difficulty && difficulty !== "ALL") {
      where.difficulty = difficulty as any;
    }

    if (type && type !== "ALL") {
      where.type = type as any;
    }

    if (onlyPublished) {
      where.isPublished = true;
      where.status = "PUBLISHED";
    } else if (status && status !== "ALL") {
      if (status === "PUBLISHED") {
        where.isPublished = true;
        where.status = "PUBLISHED";
      } else if (status === "DRAFT") {
        where.status = "DRAFT";
      } else if (status === "REVIEW_1") {
        where.status = "REVIEW_1";
      } else if (status === "REVIEW_2") {
        where.status = "REVIEW_2";
      } else if (status === "REJECTED") {
        where.status = "REJECTED";
      }
    }

    if (createdById && createdById !== "ALL") {
      where.createdById = createdById;
    }

    if (reviewedById && reviewedById !== "ALL") {
      where.OR = [
        { review1ById: reviewedById },
        { review2ById: reviewedById },
        { publishedById: reviewedById },
      ];
    }

    if (editedById && editedById !== "ALL") {
      where.editedById = editedById;
    }

    const [questions, total, publishedCount, review1Count, review2Count, draftCount] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          translations: true,
          createdBy: { select: { id: true, name: true, email: true } },
          editedBy: { select: { id: true, name: true, email: true } },
          review1By: { select: { id: true, name: true, email: true } },
          review2By: { select: { id: true, name: true, email: true } },
          publishedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
      prisma.question.count({ where: { status: "PUBLISHED" } }),
      prisma.question.count({ where: { status: "REVIEW_1" } }),
      prisma.question.count({ where: { status: "REVIEW_2" } }),
      prisma.question.count({ where: { status: "DRAFT" } }),
    ]);

    return apiSuccess({
      questions,
      total,
      page,
      pageSize,
      counts: {
        published: publishedCount,
        review1: review1Count,
        review2: review2Count,
        draft: draftCount,
        total: publishedCount + review1Count + review2Count + draftCount,
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

    const question = await prisma.question.create({
      data: {
        subject,
        chapter,
        type: legacyTypeToQuestionType(data.type),
        difficulty: data.difficulty,
        tags: legacyTagsToString(data.tags),
        createdById: session.user.id,
        status: "DRAFT",
        version: 1,
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
