import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { withNewQuestionCode, toQuestionType, toDifficulty } from "@/lib/questions/create-with-code";
import { buildOccurrenceKey, formatOccurrenceLabel } from "@/lib/pyq/keys";
import { questionFingerprint } from "@/lib/pyq/fingerprint";
import { buildQuestionSlug } from "@/lib/pyq/slug-generator";

const manualSchema = z.object({
  questionId: z.string().trim().nullable().optional(),
  examId: z.string().trim().nullable().optional(),
  pyqExam: z.string().trim().nullable().optional(),
  year: z.number().int().min(1980).max(2100).nullable().optional(),
  pyqYear: z.union([z.number(), z.string()]).nullable().optional(),
  session: z.string().trim().nullable().optional(),
  pyqMonth: z.string().trim().nullable().optional(),
  shift: z.string().trim().nullable().optional(),
  pyqShift: z.string().trim().nullable().optional(),
  paper: z.string().trim().nullable().optional(),
  pyqPaper: z.string().trim().nullable().optional(),
  questionNumber: z.string().trim().nullable().optional(),
  pyqQuestionNumber: z.string().trim().nullable().optional(),
  subject: z.string().trim().min(1, "Subject is required"),
  chapter: z.string().trim().nullable().optional(),
  topic: z.string().trim().nullable().optional(),
  subTopic: z.string().trim().nullable().optional(),
  type: z.string().nullable().optional(),
  questionType: z.string().default("SINGLE_CORRECT"),
  difficulty: z.string().default("MEDIUM"),
  statement: z.string().trim().nullable().optional(),
  statementEn: z.string().trim().nullable().optional(),
  statementHi: z.string().trim().nullable().optional(),
  options: z.record(z.string()).nullable().optional(),
  optionsEn: z.record(z.string()).nullable().optional(),
  optionsHi: z.record(z.string()).nullable().optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  correctOptionIds: z.array(z.string()).nullable().optional(),
  solution: z.string().trim().nullable().optional(),
  solutionEn: z.string().trim().nullable().optional(),
  solutionHi: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
  figureUrl: z.string().trim().nullable().optional(),
  referenceImageUrl: z.string().trim().nullable().optional(),
  solutionImageUrl: z.string().trim().nullable().optional(),
  camDrawData: z.any().optional(),
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
  publish: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_CREATE);
    const body = manualSchema.parse(await request.json());

    // 1. Resolve Exam
    let exam = null;
    if (body.examId) {
      exam = await prisma.pyqExam.findUnique({
        where: { id: body.examId },
      });
    }

    if (!exam && body.pyqExam) {
      const examNameOrCode = body.pyqExam.toUpperCase();
      let canonicalType: string | undefined;
      if (examNameOrCode.includes("NEET")) canonicalType = "NEET_UG";
      else if (examNameOrCode.includes("ADVANCED")) canonicalType = "JEE_ADVANCED";
      else if (examNameOrCode.includes("JEE")) canonicalType = "JEE_MAIN";

      exam = await prisma.pyqExam.findFirst({
        where: {
          OR: [
            ...(canonicalType ? [{ canonicalType }] : []),
            { name: { contains: body.pyqExam, mode: "insensitive" } },
            { slug: { contains: body.pyqExam.toLowerCase() } },
          ],
        },
      });
    }

    if (!exam) {
      // Fallback to first available exam
      exam = await prisma.pyqExam.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }

    if (!exam) {
      return apiError("No PYQ Exam found in system", 404);
    }

    // 2. Normalize Fields
    const resolvedStatementEn = body.statementEn?.trim() || body.statement?.trim() || "";
    const resolvedStatementHi = body.statementHi?.trim() || "";
    const primaryStatement = resolvedStatementEn || resolvedStatementHi;

    if (!primaryStatement) {
      return apiError("Question statement is required.", 400);
    }

    const resolvedOptionsEn = (body.optionsEn || body.options || {}) as Record<string, string>;
    const resolvedOptionsHi = (body.optionsHi || {}) as Record<string, string>;

    let answers: string[] = ["A"];
    if (Array.isArray(body.correctAnswer) && body.correctAnswer.length > 0) {
      answers = body.correctAnswer.map((s) => String(s).toUpperCase().trim());
    } else if (Array.isArray(body.correctOptionIds) && body.correctOptionIds.length > 0) {
      answers = body.correctOptionIds.map((s) => String(s).toUpperCase().trim());
    } else if (typeof body.correctAnswer === "string" && body.correctAnswer.trim()) {
      answers = body.correctAnswer.toUpperCase().replace(/\s+/g, "").split(",").filter(Boolean);
    }

    const resolvedYear =
      body.year ??
      (body.pyqYear ? parseInt(String(body.pyqYear), 10) : new Date().getFullYear());
    const resolvedSession = body.session?.trim() || body.pyqMonth?.trim() || null;
    const resolvedShift = body.shift?.trim() || body.pyqShift?.trim() || null;
    const resolvedPaper = body.paper?.trim() || body.pyqPaper?.trim() || null;
    const resolvedQNum = body.questionNumber?.trim() || body.pyqQuestionNumber?.trim() || "Question 01";
    const resolvedType = body.type || body.questionType || "SINGLE_CORRECT";
    const resolvedFigureUrl = body.figureUrl || body.imageUrl || body.referenceImageUrl || null;
    const resolvedSolutionEn = body.solutionEn?.trim() || body.solution?.trim() || null;
    const resolvedSolutionHi = body.solutionHi?.trim() || null;

    const fingerprint = questionFingerprint(
      primaryStatement,
      Object.keys(resolvedOptionsEn).length ? resolvedOptionsEn : null
    );

    const now = new Date();
    const label = formatOccurrenceLabel({
      examName: exam.name,
      year: resolvedYear,
      session: resolvedSession,
      shift: resolvedShift,
      paper: resolvedPaper,
    });

    let questionId: string;
    let savedQuestionCode: string | null = null;
    let isDuplicate = false;

    // Check if target questionId provided (Edit mode)
    if (body.questionId) {
      questionId = body.questionId;
      const updated = await prisma.question.update({
        where: { id: questionId },
        data: {
          subject: body.subject,
          chapter: body.chapter || null,
          topic: body.topic || null,
          subTopic: body.subTopic || null,
          type: toQuestionType(resolvedType),
          difficulty: toDifficulty(body.difficulty),
          solution: resolvedSolutionEn || resolvedSolutionHi,
          imageUrl: resolvedFigureUrl,
          camDrawData: body.camDrawData || undefined,
          isPublished: body.publish,
          status: body.publish ? "PUBLISHED" : "DRAFT",
          translations: {
            deleteMany: {},
            create: [
              ...(resolvedStatementEn
                ? [
                    {
                      language: "ENGLISH",
                      statement: resolvedStatementEn,
                      options: resolvedOptionsEn as Prisma.InputJsonValue,
                      correctOptionIds: answers,
                      solution: resolvedSolutionEn,
                    },
                  ]
                : []),
              ...(resolvedStatementHi
                ? [
                    {
                      language: "HINDI",
                      statement: resolvedStatementHi,
                      options: (Object.keys(resolvedOptionsHi).length ? resolvedOptionsHi : resolvedOptionsEn) as Prisma.InputJsonValue,
                      correctOptionIds: answers,
                      solution: resolvedSolutionHi || resolvedSolutionEn,
                    },
                  ]
                : []),
            ],
          },
        },
        select: { id: true, questionCode: true },
      });
      savedQuestionCode = updated.questionCode;
    } else {
      // Create or detect duplicate
      const existing = await prisma.question.findFirst({
        where: { contentFingerprint: fingerprint },
        select: { id: true, questionCode: true },
      });

      if (existing) {
        questionId = existing.id;
        savedQuestionCode = existing.questionCode;
        isDuplicate = true;
      } else {
        const created = await withNewQuestionCode(body.subject, (questionCode) => {
          const slug = buildQuestionSlug({
            id: "manual",
            questionCode,
            examName: exam.name,
            examCanonicalType: exam.canonicalType,
            year: resolvedYear,
            subject: body.subject,
            chapter: body.chapter,
            originalNumber: resolvedQNum,
          });

          return prisma.question.create({
            data: {
              slug,
              questionCode,
              subject: body.subject,
              chapter: body.chapter || null,
              topic: body.topic || null,
              subTopic: body.subTopic || null,
              type: toQuestionType(resolvedType),
              difficulty: toDifficulty(body.difficulty),
              category: `${exam.legacyCode ?? exam.slug.toUpperCase()}_PYQ`,
              pyqExam: exam.legacyCode ?? exam.name,
              pyqYear: resolvedYear,
              pyqMonth: resolvedSession,
              pyqQuestionNumber: resolvedQNum,
              pyqSource: `${label} — Q.${resolvedQNum}`,
              examLevel:
                exam.canonicalType === "NEET_UG"
                  ? "NEET"
                  : exam.canonicalType === "JEE_MAIN"
                  ? "JEE_MAIN"
                  : exam.canonicalType === "JEE_ADVANCED"
                  ? "JEE_ADVANCED"
                  : "OTHER",
              solution: resolvedSolutionEn || resolvedSolutionHi,
              imageUrl: resolvedFigureUrl,
              camDrawData: body.camDrawData || undefined,
              tags: ["PYQ", exam.name, resolvedYear ? String(resolvedYear) : "", "Manual"].filter(Boolean).join(", "),
              contentFingerprint: fingerprint,
              status: body.publish ? "PUBLISHED" : "DRAFT",
              isPublished: body.publish,
              publishedAt: body.publish ? now : null,
              publishedById: body.publish ? userId : null,
              createdById: userId,
              translations: {
                create: [
                  ...(resolvedStatementEn
                    ? [
                        {
                          language: "ENGLISH",
                          statement: resolvedStatementEn,
                          options: resolvedOptionsEn as Prisma.InputJsonValue,
                          correctOptionIds: answers,
                          solution: resolvedSolutionEn,
                        },
                      ]
                    : []),
                  ...(resolvedStatementHi
                    ? [
                        {
                          language: "HINDI",
                          statement: resolvedStatementHi,
                          options: (Object.keys(resolvedOptionsHi).length ? resolvedOptionsHi : resolvedOptionsEn) as Prisma.InputJsonValue,
                          correctOptionIds: answers,
                          solution: resolvedSolutionHi || resolvedSolutionEn,
                        },
                      ]
                    : []),
                ],
              },
            },
          });
        });

        questionId = created.id;
        savedQuestionCode = created.questionCode;
      }
    }

    // Persist Permanent Reference & Solution Assets if provided
    if (body.referenceImageUrl?.trim()) {
      await prisma.questionAsset.create({
        data: {
          questionId,
          type: "REFERENCE",
          storageKey: `ref-${questionId}`,
          publicUrl: body.referenceImageUrl.trim(),
          originalName: `question-reference-${savedQuestionCode || questionId}.png`,
          mimeType: "image/png",
          sizeBytes: body.referenceImageUrl.length,
          createdById: userId,
        },
      }).catch((e) => console.warn("[Question Asset] Reference create warning:", e));
    }

    if (body.solutionImageUrl?.trim()) {
      await prisma.questionAsset.create({
        data: {
          questionId,
          type: "SOLUTION",
          storageKey: `sol-${questionId}`,
          publicUrl: body.solutionImageUrl.trim(),
          originalName: `solution-reference-${savedQuestionCode || questionId}.png`,
          mimeType: "image/png",
          sizeBytes: body.solutionImageUrl.length,
          createdById: userId,
        },
      }).catch((e) => console.warn("[Question Asset] Solution create warning:", e));
    }

    // Upsert the PyqOccurrence
    const occurrenceKey = buildOccurrenceKey({
      questionId,
      examId: exam.id,
      year: resolvedYear,
      session: resolvedSession,
      shift: resolvedShift,
      paper: resolvedPaper,
      questionNumber: resolvedQNum,
    });

    const occurrence = await prisma.pyqOccurrence.upsert({
      where: { occurrenceKey },
      create: {
        questionId,
        examId: exam.id,
        year: resolvedYear,
        session: resolvedSession,
        shift: resolvedShift,
        paper: resolvedPaper,
        questionNumber: resolvedQNum,
        sourceLabel: label,
        sourceReference: `Manual Entry by user ${userId}`,
        verificationStatus: "VERIFIED",
        detectionMethod: "MANUAL",
        occurrenceKey,
        verifiedById: userId,
        verifiedAt: now,
        createdById: userId,
      },
      update: {
        verificationStatus: "VERIFIED",
        verifiedById: userId,
        verifiedAt: now,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "PYQ_QUESTION_MANUAL_CREATE",
        entityType: "Question",
        entityId: questionId,
        metadata: {
          examId: exam.id,
          year: resolvedYear,
          subject: body.subject,
          chapter: body.chapter,
          isDuplicateLinked: isDuplicate,
        },
      },
    });

    return apiSuccess({
      questionId,
      occurrenceId: occurrence.id,
      isDuplicateLinked: isDuplicate,
      question: {
        id: questionId,
        questionCode: savedQuestionCode,
        subject: body.subject,
        chapter: body.chapter,
      },
      message: isDuplicate
        ? "Existing question matched and linked to this exam occurrence."
        : "PYQ question saved and published successfully.",
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
