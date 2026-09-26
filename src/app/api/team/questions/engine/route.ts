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
    const category = searchParams.get("category")?.trim();
    const source = searchParams.get("source")?.trim();
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
    if (source === "ATOMIC_GURU" || category === "ATOMIC_GURU") {
      where.OR = [
        { category: { contains: "ATOMIC_GURU", mode: "insensitive" } },
        { tags: { contains: "ATOMIC_GURU", mode: "insensitive" } },
      ];
    } else if (source === "NCERT_HUB" || category === "NCERT_HUB" || source === "NCERT") {
      where.OR = [
        { category: { contains: "NCERT", mode: "insensitive" } },
        { tags: { contains: "NCERT", mode: "insensitive" } },
      ];
    } else if (category && category !== "ALL") {
      where.category = { contains: category, mode: "insensitive" };
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
      correctOptionIds,
      correctAnswer,
      solutionEn,
      solutionHi,
      tags = [],
      category,
      pyqExam,
      pyqYear,
      pyqMonth,
      pyqQuestionNumber,
      pyqSource,
      figureUrl,
      referenceImageUrl,
      solutionImageUrl,
      isPublished = true,
      dppId,
      testSectionId,
    } = body;

    let formattedPyqSource = pyqSource?.trim() || null;
    if (pyqExam) {
      const qNum = pyqQuestionNumber?.trim() || "Question 01";
      if (pyqExam === "NEET") {
        formattedPyqSource = `NEET ${pyqYear || ""} — ${qNum}`.replace("  —", " —");
      } else if (pyqExam === "JEE_MAINS") {
        formattedPyqSource = `JEE Main ${pyqYear || ""}${pyqMonth ? ` — ${pyqMonth}` : ""} — ${qNum}`.replace("  —", " —");
      } else if (pyqExam === "JEE_ADVANCED") {
        formattedPyqSource = `JEE Advanced ${pyqYear || ""} — ${qNum}`.replace("  —", " —");
      }
    }

    const resolvedCorrectOptionIds = Array.isArray(correctAnswer)
      ? correctAnswer
      : Array.isArray(correctOptionIds)
      ? correctOptionIds
      : [correctAnswer || correctOptionIds || "A"];

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

    // 4. Create Master Question Record (Always created as UNDER REVIEW / DRAFT)
    const question = await prisma.question.create({
      data: {
        subject: subject.trim(),
        chapter: chapter?.trim() || null,
        topic: topic?.trim() || null,
        subTopic: subTopic?.trim() || null,
        type: type as QuestionType,
        difficulty: difficulty as Difficulty,
        imageUrl: figureUrl?.trim() || referenceImageUrl?.trim() || null,
        category: category?.trim() || null,
        pyqExam: pyqExam?.trim() || null,
        pyqYear: pyqYear ? parseInt(String(pyqYear), 10) || null : null,
        pyqMonth: pyqMonth?.trim() || null,
        pyqQuestionNumber: pyqQuestionNumber?.trim() || null,
        pyqSource: formattedPyqSource,
        questionCode,
        solution: solutionEn?.trim() || solutionHi?.trim() || null,
        tags: tagsString,
        status: "REVIEW_1", // Enforce Centralized Question Review pipeline
        isPublished: false, // Never automatically published on creation
        createdById: session.user.id,
        publishedById: null,
        publishedAt: null,
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
              correctOptionIds: resolvedCorrectOptionIds,
              solutionEn,
              solutionHi,
              subject,
              chapter,
              topic,
              referenceImageUrl,
              solutionImageUrl,
            },
          },
        },
      },
      include: {
        translations: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    // 4.1 Persist Permanent Reference & Solution Assets if provided
    if (referenceImageUrl?.trim()) {
      await prisma.questionAsset.create({
        data: {
          questionId: question.id,
          type: "REFERENCE",
          storageKey: `ref-${question.id}`,
          publicUrl: referenceImageUrl.trim(),
          originalName: `question-reference-${questionCode}.png`,
          mimeType: "image/png",
          sizeBytes: referenceImageUrl.length,
          createdById: session.user.id,
        },
      }).catch((e) => console.warn("[Question Asset] Reference create warning:", e));
    }

    if (solutionImageUrl?.trim()) {
      await prisma.questionAsset.create({
        data: {
          questionId: question.id,
          type: "SOLUTION",
          storageKey: `sol-${question.id}`,
          publicUrl: solutionImageUrl.trim(),
          originalName: `solution-reference-${questionCode}.png`,
          mimeType: "image/png",
          sizeBytes: solutionImageUrl.length,
          createdById: session.user.id,
        },
      }).catch((e) => console.warn("[Question Asset] Solution create warning:", e));
    }

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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await request.json();
    const {
      questionId,
      subject,
      chapter,
      topic,
      subTopic,
      type = "SINGLE_CORRECT",
      difficulty = "MEDIUM",
      category,
      pyqExam,
      pyqYear,
      pyqMonth,
      pyqQuestionNumber,
      pyqSource,
      statementEn,
      statementHi,
      optionsEn,
      optionsHi,
      correctAnswer,
      solutionEn,
      solutionHi,
      figureUrl,
      referenceImageUrl,
      solutionImageUrl,
      tags = [],
      dppId,
      testSectionId,
    } = body;

    if (!questionId) {
      return apiError("questionId is required for editing a question.", 400);
    }

    const existing = await prisma.question.findUnique({
      where: { id: questionId },
      include: { translations: true },
    });
    if (!existing) return apiError("Question not found.", 404);

    const targetExam = pyqExam !== undefined ? (pyqExam ? pyqExam.trim() : null) : existing.pyqExam;
    const targetYear = pyqYear !== undefined ? (pyqYear ? parseInt(String(pyqYear), 10) || null : null) : existing.pyqYear;
    const targetMonth = pyqMonth !== undefined ? (pyqMonth ? pyqMonth.trim() : null) : existing.pyqMonth;
    const targetQNum = pyqQuestionNumber !== undefined ? (pyqQuestionNumber ? pyqQuestionNumber.trim() : null) : existing.pyqQuestionNumber;

    let formattedPyqSource = pyqSource !== undefined ? (pyqSource ? pyqSource.trim() : null) : existing.pyqSource;
    if (targetExam) {
      const qNum = targetQNum || "Question 01";
      if (targetExam === "NEET") {
        formattedPyqSource = `NEET ${targetYear || ""} — ${qNum}`.replace("  —", " —");
      } else if (targetExam === "JEE_MAINS") {
        formattedPyqSource = `JEE Main ${targetYear || ""}${targetMonth ? ` — ${targetMonth}` : ""} — ${qNum}`.replace("  —", " —");
      } else if (targetExam === "JEE_ADVANCED") {
        formattedPyqSource = `JEE Advanced ${targetYear || ""} — ${qNum}`.replace("  —", " —");
      }
    }

    const resolvedCorrectOptionIds = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer || "A"];
    const tagsString = Array.isArray(tags) ? tags.join(", ") : (tags || "");

    // 1. Upsert English translation if present
    if (statementEn?.trim()) {
      await prisma.questionTranslation.upsert({
        where: {
          questionId_language: { questionId, language: "ENGLISH" },
        },
        create: {
          questionId,
          language: "ENGLISH",
          statement: statementEn.trim(),
          options: optionsEn || {},
          correctOptionIds: resolvedCorrectOptionIds,
          solution: solutionEn?.trim() || null,
        },
        update: {
          statement: statementEn.trim(),
          options: optionsEn || {},
          correctOptionIds: resolvedCorrectOptionIds,
          solution: solutionEn?.trim() || null,
        },
      });
    }

    // 2. Upsert Hindi translation if present
    if (statementHi?.trim()) {
      await prisma.questionTranslation.upsert({
        where: {
          questionId_language: { questionId, language: "HINDI" },
        },
        create: {
          questionId,
          language: "HINDI",
          statement: statementHi.trim(),
          options: optionsHi || {},
          correctOptionIds: resolvedCorrectOptionIds,
          solution: solutionHi?.trim() || null,
        },
        update: {
          statement: statementHi.trim(),
          options: optionsHi || {},
          correctOptionIds: resolvedCorrectOptionIds,
          solution: solutionHi?.trim() || null,
        },
      });
    }

    // 3. Update master question
    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        subject: subject ? subject.trim() : existing.subject,
        chapter: chapter !== undefined ? chapter?.trim() || null : existing.chapter,
        topic: topic !== undefined ? topic?.trim() || null : existing.topic,
        subTopic: subTopic !== undefined ? subTopic?.trim() || null : existing.subTopic,
        type: type as QuestionType,
        difficulty: difficulty as Difficulty,
        category: category !== undefined ? category?.trim() || null : existing.category,
        pyqExam: targetExam,
        pyqYear: targetYear,
        pyqMonth: targetMonth,
        pyqQuestionNumber: targetQNum,
        pyqSource: formattedPyqSource,
        solution: solutionEn?.trim() || solutionHi?.trim() || existing.solution,
        imageUrl: figureUrl?.trim() || referenceImageUrl?.trim() || existing.imageUrl,
        tags: tagsString || existing.tags,
        version: { increment: 1 },
        editedById: session.user.id,
        editedAt: new Date(),
        versions: {
          create: {
            versionNumber: existing.version + 1,
            editedById: session.user.id,
            changeType: "EDIT",
            snapshot: {
              statementEn,
              statementHi,
              optionsEn,
              optionsHi,
              correctOptionIds: resolvedCorrectOptionIds,
              solutionEn,
              solutionHi,
              subject,
              chapter,
              topic,
              referenceImageUrl,
              solutionImageUrl,
            },
          },
        },
      },
      include: {
        translations: true,
        assets: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    // Keep a REFERENCE QuestionAsset row in sync on edit too (POST already
    // does this on create). Question.imageUrl is still the primary field the
    // edit form reads back, but the asset table should not go stale.
    const referenceUrlForAsset = (figureUrl?.trim() || referenceImageUrl?.trim() || "") as string;
    if (figureUrl !== undefined || referenceImageUrl !== undefined) {
      if (referenceUrlForAsset) {
        const existingRefAsset = await prisma.questionAsset.findFirst({
          where: { questionId, type: "REFERENCE" },
        });
        if (existingRefAsset) {
          await prisma.questionAsset
            .update({
              where: { id: existingRefAsset.id },
              data: { publicUrl: referenceUrlForAsset, sizeBytes: referenceUrlForAsset.length },
            })
            .catch((e) => console.warn("[Question Asset] Reference update warning:", e));
        } else {
          await prisma.questionAsset
            .create({
              data: {
                questionId,
                type: "REFERENCE",
                storageKey: `ref-${questionId}`,
                publicUrl: referenceUrlForAsset,
                originalName: `question-reference-${updated.questionCode}.png`,
                mimeType: "image/png",
                sizeBytes: referenceUrlForAsset.length,
                createdById: session.user.id,
              },
            })
            .catch((e) => console.warn("[Question Asset] Reference create warning:", e));
        }
      } else {
        await prisma.questionAsset
          .deleteMany({ where: { questionId, type: "REFERENCE" } })
          .catch((e) => console.warn("[Question Asset] Reference delete warning:", e));
      }
    }

    if (solutionImageUrl !== undefined) {
      if (solutionImageUrl?.trim()) {
        const existingSolAsset = await prisma.questionAsset.findFirst({
          where: { questionId, type: "SOLUTION" },
        });
        if (existingSolAsset) {
          await prisma.questionAsset.update({
            where: { id: existingSolAsset.id },
            data: { publicUrl: solutionImageUrl.trim(), sizeBytes: solutionImageUrl.length },
          }).catch((e) => console.warn("[Question Asset] Solution update warning:", e));
        } else {
          await prisma.questionAsset.create({
            data: {
              questionId,
              type: "SOLUTION",
              storageKey: `sol-${questionId}`,
              publicUrl: solutionImageUrl.trim(),
              originalName: `solution-reference-${updated.questionCode}.png`,
              mimeType: "image/png",
              sizeBytes: solutionImageUrl.length,
              createdById: session.user.id,
            },
          }).catch((e) => console.warn("[Question Asset] Solution create warning:", e));
        }
      } else {
        await prisma.questionAsset.deleteMany({
          where: { questionId, type: "SOLUTION" },
        }).catch((e) => console.warn("[Question Asset] Solution delete warning:", e));
      }
    }

    let sectionQuestion = null;
    let dppQuestion = null;

    // Link to Test Section if requested and not yet linked
    if (testSectionId) {
      const existingSecLink = await prisma.sectionQuestion.findFirst({
        where: { sectionId: testSectionId, questionId },
      });
      if (!existingSecLink) {
        const secCount = await prisma.sectionQuestion.count({ where: { sectionId: testSectionId } });
        sectionQuestion = await prisma.sectionQuestion.create({
          data: {
            sectionId: testSectionId,
            questionId,
            order: secCount + 1,
          },
        });
        await prisma.question.update({
          where: { id: questionId },
          data: { usageCount: { increment: 1 } },
        });
      } else {
        sectionQuestion = existingSecLink;
      }
    }

    // Link to DPP if requested and not yet linked
    if (dppId) {
      const existingDppLink = await prisma.dppQuestion.findFirst({
        where: { dppId, questionId },
      });
      if (!existingDppLink) {
        const dppCount = await prisma.dppQuestion.count({ where: { dppId } });
        dppQuestion = await prisma.dppQuestion.create({
          data: {
            dppId,
            questionId,
            order: dppCount + 1,
          },
        });
        await prisma.question.update({
          where: { id: questionId },
          data: { usageCount: { increment: 1 } },
        });
      } else {
        dppQuestion = existingDppLink;
      }
    }

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_ENGINE_UPDATE",
        entityType: "Question",
        entityId: questionId,
        metadata: {
          questionCode: updated.questionCode,
          subject: updated.subject,
          chapter: updated.chapter,
          version: updated.version,
          testSectionId: testSectionId || null,
          dppId: dppId || null,
        },
      },
    });

    return apiSuccess({ question: updated, sectionQuestion, dppQuestion });
  } catch (error) {
    return handleApiError(error);
  }
}