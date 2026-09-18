import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await request.json();
    const { action, teacherNotes, status, fixData } = body as {
      action: "UPDATE_STATUS" | "FIX_QUESTION" | "RESOLVE_ALL" | "REJECT_ALL";
      teacherNotes?: string;
      status?: string;
      fixData?: {
        statement?: string;
        options?: any;
        correctAnswer?: string;
        solution?: string;
        language?: string;
        difficulty?: string;
        chapter?: string;
        topic?: string;
      };
    };

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: {
        translations: true,
        reports: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    if (action === "FIX_QUESTION" && fixData) {
      // 1. Create a QuestionVersion snapshot of previous state before modifying
      const latestVersionNum = question.versions[0]?.versionNumber ?? question.version ?? 1;
      const nextVersionNum = latestVersionNum + 1;

      await prisma.questionVersion.create({
        data: {
          questionId: question.id,
          versionNumber: latestVersionNum,
          editedById: session.user.id,
          reason: teacherNotes || "Corrected based on student reports",
          changeType: "CORRECTION_FROM_REPORT",
          snapshot: {
            subject: question.subject,
            chapter: question.chapter,
            topic: question.topic,
            solution: question.solution,
            status: question.status,
            translations: question.translations,
          } as any,
        },
      });

      // 2. Update Question and Translation in place
      const targetLang = fixData.language?.toLowerCase() || question.translations[0]?.language || "english";
      const existingTranslation = question.translations.find(
        (t) => t.language.toLowerCase() === targetLang
      ) || question.translations[0];

      if (existingTranslation) {
        await prisma.questionTranslation.update({
          where: { id: existingTranslation.id },
          data: {
            statement: fixData.statement !== undefined ? fixData.statement : existingTranslation.statement,
            options: (fixData.options !== undefined ? fixData.options : existingTranslation.options) as any,
            correctOptionIds:
              fixData.correctAnswer !== undefined
                ? [fixData.correctAnswer]
                : (existingTranslation.correctOptionIds as any),
            solution: fixData.solution !== undefined ? fixData.solution : existingTranslation.solution,
          },
        });
      } else if (fixData.statement) {
        await prisma.questionTranslation.create({
          data: {
            questionId: question.id,
            language: targetLang,
            statement: fixData.statement,
            options: fixData.options || [],
            correctOptionIds: fixData.correctAnswer ? [fixData.correctAnswer] : [],
            solution: fixData.solution || null,
          },
        });
      }

      await prisma.question.update({
        where: { id: question.id },
        data: {
          version: nextVersionNum,
          solution: fixData.solution !== undefined ? fixData.solution : question.solution,
          chapter: fixData.chapter !== undefined ? fixData.chapter : question.chapter,
          topic: fixData.topic !== undefined ? fixData.topic : question.topic,
          difficulty: (fixData.difficulty as any) || question.difficulty,
          editedById: session.user.id,
          editedAt: new Date(),
        },
      });

      // 3. Mark all active reports on this question as RESOLVED
      await prisma.questionReport.updateMany({
        where: { questionId: question.id, status: { in: ["NEW", "CLAIMED", "UNDER_REVIEW"] } },
        data: {
          status: "RESOLVED",
          teacherNotes: teacherNotes || "Question and answer verified & corrected",
          resolvedAt: new Date(),
          claimedById: session.user.id,
        },
      });

      return apiSuccess({
        message: "Question successfully corrected in place and reports marked resolved.",
        version: nextVersionNum,
      });
    }

    if (action === "UPDATE_STATUS" && status) {
      // Update reports status
      const mappedReportStatus =
        status === "REJECTED"
          ? "REJECTED"
          : status === "RESOLVED" || status === "CORRECTED"
            ? "RESOLVED"
            : status === "UNDER_REVIEW"
              ? "CLAIMED"
              : "NEW";

      await prisma.questionReport.updateMany({
        where: { questionId: question.id },
        data: {
          status: mappedReportStatus,
          teacherNotes: teacherNotes || undefined,
          claimedById: session.user.id,
          resolvedAt: mappedReportStatus === "RESOLVED" || mappedReportStatus === "REJECTED" ? new Date() : undefined,
        },
      });

      return apiSuccess({ message: `Status updated to ${status}` });
    }

    if (action === "REJECT_ALL") {
      await prisma.questionReport.updateMany({
        where: { questionId: question.id },
        data: {
          status: "REJECTED",
          teacherNotes: teacherNotes || "Reviewed by faculty: question and answer are correct as stated.",
          claimedById: session.user.id,
          resolvedAt: new Date(),
        },
      });
      return apiSuccess({ message: "All reports marked as rejected." });
    }

    return apiError("Invalid action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
