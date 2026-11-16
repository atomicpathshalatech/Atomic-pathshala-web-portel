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
  examId: z.string().min(1, "Exam is required"),
  year: z.number().int().min(1980).max(2100).nullable().optional(),
  session: z.string().trim().nullable().optional(),
  shift: z.string().trim().nullable().optional(),
  paper: z.string().trim().nullable().optional(),
  questionNumber: z.string().trim().nullable().optional(),
  subject: z.string().trim().min(1, "Subject is required"),
  chapter: z.string().trim().nullable().optional(),
  topic: z.string().trim().nullable().optional(),
  subTopic: z.string().trim().nullable().optional(),
  questionType: z.string().default("SINGLE_CORRECT"),
  difficulty: z.string().default("MEDIUM"),
  statement: z.string().trim().min(1, "Question statement is required"),
  statementHi: z.string().trim().nullable().optional(),
  options: z.record(z.string()).default({}),
  optionsHi: z.record(z.string()).nullable().optional(),
  correctAnswer: z.string().trim().min(1, "Correct answer is required"),
  solution: z.string().trim().nullable().optional(),
  solutionHi: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
  publish: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_CREATE);
    const body = manualSchema.parse(await request.json());

    const exam = await prisma.pyqExam.findUnique({
      where: { id: body.examId },
    });
    if (!exam) {
      return apiError("Exam not found", 404);
    }

    const answers = body.correctAnswer.toUpperCase().replace(/\s+/g, "").split(",");
    const fingerprint = questionFingerprint(
      body.statement,
      Object.keys(body.options).length ? (body.options as Record<string, string>) : null
    );

    // Check duplicate
    const existing = await prisma.question.findFirst({
      where: { contentFingerprint: fingerprint },
      select: { id: true, questionCode: true },
    });

    const now = new Date();
    const label = formatOccurrenceLabel({
      examName: exam.name,
      year: body.year,
      session: body.session,
      shift: body.shift,
      paper: body.paper,
    });

    let questionId: string;
    let isDuplicate = false;

    if (existing) {
      // Connect existing question to this new occurrence sitting
      questionId = existing.id;
      isDuplicate = true;
    } else {
      // Create new canonical question
      const created = await withNewQuestionCode(body.subject, (questionCode) => {
        const slug = buildQuestionSlug({
          id: "manual",
          questionCode,
          examName: exam.name,
          examCanonicalType: exam.canonicalType,
          year: body.year,
          subject: body.subject,
          chapter: body.chapter,
          originalNumber: body.questionNumber,
        });

        return prisma.question.create({
          data: {
            slug,
            questionCode,
            subject: body.subject,
            chapter: body.chapter,
            topic: body.topic,
            subTopic: body.subTopic,
            type: toQuestionType(body.questionType),
            difficulty: toDifficulty(body.difficulty),
            category: `${exam.legacyCode ?? exam.slug.toUpperCase()}_PYQ`,
            pyqExam: exam.legacyCode ?? exam.name,
            pyqYear: body.year,
            pyqMonth: body.session,
            pyqQuestionNumber: body.questionNumber,
            pyqSource: `${label} — Q.${body.questionNumber || "1"}`,
            examLevel:
              exam.canonicalType === "NEET_UG"
                ? "NEET"
                : exam.canonicalType === "JEE_MAIN"
                ? "JEE_MAIN"
                : exam.canonicalType === "JEE_ADVANCED"
                ? "JEE_ADVANCED"
                : "OTHER",
            solution: body.solution,
            imageUrl: body.imageUrl,
            tags: ["PYQ", exam.name, body.year ? String(body.year) : "", "Manual"].filter(Boolean).join(", "),
            contentFingerprint: fingerprint,
            status: body.publish ? "PUBLISHED" : "DRAFT",
            isPublished: body.publish,
            publishedAt: body.publish ? now : null,
            publishedById: body.publish ? userId : null,
            createdById: userId,
            translations: {
              create: [
                ...(!/[ऀ-ॿ]/.test(body.statement)
                  ? [
                      {
                        language: "ENGLISH",
                        statement: body.statement,
                        options: body.options as Prisma.InputJsonValue,
                        correctOptionIds: answers,
                        solution: body.solution,
                      },
                    ]
                  : []),
                ...(body.statementHi || /[ऀ-ॿ]/.test(body.statement)
                  ? [
                      {
                        language: "HINDI",
                        statement: body.statementHi || body.statement,
                        options: (body.optionsHi || body.options) as Prisma.InputJsonValue,
                        correctOptionIds: answers,
                        solution: body.solutionHi ?? body.solution,
                      },
                    ]
                  : []),
              ],
            },
          },
        });
      });
      questionId = created.id;
    }

    // Upsert the PyqOccurrence
    const occurrenceKey = buildOccurrenceKey({
      questionId,
      examId: exam.id,
      year: body.year,
      session: body.session,
      shift: body.shift,
      paper: body.paper,
      questionNumber: body.questionNumber || "1",
    });

    const occurrence = await prisma.pyqOccurrence.upsert({
      where: { occurrenceKey },
      create: {
        questionId,
        examId: exam.id,
        year: body.year,
        session: body.session,
        shift: body.shift,
        paper: body.paper,
        questionNumber: body.questionNumber,
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
          year: body.year,
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
      message: isDuplicate
        ? "Existing question matched and linked to this exam occurrence."
        : "Question created and published successfully.",
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
