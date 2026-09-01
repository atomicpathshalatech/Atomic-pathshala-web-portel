import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { analyzeQuestionSimilarity } from "@/lib/questions/similarity";
import { QuestionType, Difficulty } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = request.nextUrl;
    const query = searchParams.get("query")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();
    const difficulty = searchParams.get("difficulty")?.trim();
    const type = searchParams.get("type")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (subject && subject !== "ALL") {
      where.subject = { equals: subject, mode: "insensitive" };
    }
    if (chapter) {
      where.chapter = { equals: chapter, mode: "insensitive" };
    }
    if (difficulty && difficulty !== "ALL") {
      where.difficulty = difficulty as Difficulty;
    }
    if (type && type !== "ALL") {
      where.type = type as QuestionType;
    }

    if (query) {
      where.OR = [
        { questionCode: { contains: query, mode: "insensitive" } },
        { chapter: { contains: query, mode: "insensitive" } },
        { topic: { contains: query, mode: "insensitive" } },
        {
          translations: {
            some: {
              statement: { contains: query, mode: "insensitive" },
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
          createdBy: { select: { name: true, email: true } },
          _count: {
            select: { sectionLinks: true, dppLinks: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    return apiSuccess({
      questions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
    const {
      subject,
      chapter,
      topic,
      subTopic,
      type = "SINGLE_CORRECT",
      difficulty = "MEDIUM",
      statementEn,
      statementHi,
      optionsEn = {},
      optionsHi = {},
      correctOptionIds = ["A"],
      solutionEn,
      solutionHi,
      tags = [],
      category,
      pyqSource,
      figureUrl,
      isPublished = true,
      dppId,
      testSectionId,
    } = body;

    if (!subject?.trim()) {
      return apiError("Subject is required.", 400);
    }
    if (!statementEn?.trim() && !statementHi?.trim()) {
      return apiError("At least one language statement is required.", 400);
    }

    // 1. Concurrency-Safe 8-Digit Question ID Generation
    const questionCode = await generateQuestionId(prisma, subject);

    // 2. Similarity & Duplicate Analysis
    const simReport = await analyzeQuestionSimilarity(prisma, {
      statementEn,
      statementHi,
      subject,
      chapter,
      topic,
      optionsEn,
      optionsHi,
    });

    const tagsString = Array.isArray(tags) ? tags.join(", ") : (tags || "");

    // 3. Build translations array
    const translationsData: any[] = [];
    if (statementEn?.trim()) {
      translationsData.push({
        language: "ENGLISH",
        statement: statementEn.trim(),
        options: optionsEn,
        correctOptionIds,
        solution: solutionEn?.trim() || null,
      });
    }
    if (statementHi?.trim()) {
      translationsData.push({
        language: "HINDI",
        statement: statementHi.trim(),
        options: optionsHi,
        correctOptionIds,
        solution: solutionHi?.trim() || null,
      });
    }

    // 4. Create Master Question Record
    const question = await prisma.question.create({
      data: {
        subject: subject.trim(),
        chapter: chapter?.trim() || null,
        topic: topic?.trim() || null,
        subTopic: subTopic?.trim() || null,
        type: type as QuestionType,
        difficulty: difficulty as Difficulty,
        imageUrl: figureUrl?.trim() || null,
        category: category?.trim() || null,
        pyqSource: pyqSource?.trim() || null,
        questionCode,
        solution: solutionEn?.trim() || solutionHi?.trim() || null,
        tags: tagsString,
        isPublished: !!isPublished,
        createdById: session.user.id,
        publishedById: isPublished ? session.user.id : null,
        publishedAt: isPublished ? new Date() : null,
        translations: {
          create: translationsData,
        },
        versions: {
          create: {
            versionNumber: 1,
            editedById: session.user.id,
            changeType: "CREATE",
            snapshot: {
              statementEn,
              statementHi,
              optionsEn,
              optionsHi,
              correctOptionIds,
              solutionEn,
              solutionHi,
              subject,
              chapter,
              topic,
            },
          },
        },
      },
      include: {
        translations: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    let dppQuestion = null;
    let sectionQuestion = null;

    // 5. Link to DPP if requested
    if (dppId) {
      const dppCount = await prisma.dppQuestion.count({ where: { dppId } });
      dppQuestion = await prisma.dppQuestion.create({
        data: {
          dppId,
          questionId: question.id,
          order: dppCount + 1,
        },
      });
      // Increment question usage count
      await prisma.question.update({
        where: { id: question.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // 6. Link to Test Section if requested
    if (testSectionId) {
      const secCount = await prisma.sectionQuestion.count({ where: { sectionId: testSectionId } });
      sectionQuestion = await prisma.sectionQuestion.create({
        data: {
          sectionId: testSectionId,
          questionId: question.id,
          order: secCount + 1,
        },
      });
      await prisma.question.update({
        where: { id: question.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // 7. Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_ENGINE_CREATE",
        entityType: "Question",
        entityId: question.id,
        metadata: {
          questionCode,
          subject,
          chapter,
          highestSimilarity: simReport.highestScore,
          dppId: dppId || null,
          testSectionId: testSectionId || null,
        },
      },
    });

    return apiSuccess(
      {
        question,
        dppQuestion,
        sectionQuestion,
        similarityReport: simReport,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}