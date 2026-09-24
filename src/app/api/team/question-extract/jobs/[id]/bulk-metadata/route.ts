import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const job = await prisma.extractionJob.findUnique({
      where: { id: params.id },
    });
    if (!job) return apiError("Extraction job not found.", 404);

    const body = await request.json();
    const {
      subject,
      chapter,
      topic,
      subTopic,
      difficulty,
      questionType,
      pyqExam,
      pyqYear,
      pyqMonth,
      applyTo = "ALL", // "ALL" | "SELECTED" | "REVIEW_ONLY"
      questionIds,
    } = body;

    // Build update payload only with provided fields
    const dataToUpdate: any = { isEdited: true };
    if (subject) dataToUpdate.subject = subject;
    if (chapter !== undefined) dataToUpdate.chapter = chapter || null;
    if (topic !== undefined) dataToUpdate.topic = topic || null;
    if (subTopic !== undefined) dataToUpdate.subTopic = subTopic || null;
    if (difficulty) dataToUpdate.difficulty = difficulty;
    if (questionType) dataToUpdate.questionType = questionType;
    if (pyqExam !== undefined) dataToUpdate.pyqExam = pyqExam || null;
    if (pyqYear !== undefined) dataToUpdate.pyqYear = pyqYear ? parseInt(String(pyqYear), 10) || null : null;
    if (pyqMonth !== undefined) dataToUpdate.pyqMonth = pyqMonth || null;

    const whereClause: any = { jobId: params.id };

    if (applyTo === "SELECTED" && Array.isArray(questionIds) && questionIds.length > 0) {
      whereClause.id = { in: questionIds };
    } else if (applyTo === "REVIEW_ONLY") {
      whereClause.status = { in: ["REVIEW_REQUIRED", "EXTRACTION_ERROR"] };
    }

    const updateResult = await prisma.extractedQuestion.updateMany({
      where: whereClause,
      data: dataToUpdate,
    });

    // Also update Job level defaults if provided
    const jobUpdateData: any = {};
    if (subject && subject !== "Auto Detect") jobUpdateData.subject = subject;
    if (chapter) jobUpdateData.chapter = chapter;
    if (pyqExam) jobUpdateData.pyqExam = pyqExam;
    if (pyqYear) jobUpdateData.pyqYear = parseInt(String(pyqYear), 10) || null;
    if (pyqMonth) jobUpdateData.pyqMonth = pyqMonth;

    if (Object.keys(jobUpdateData).length > 0) {
      await prisma.extractionJob.update({
        where: { id: params.id },
        data: jobUpdateData,
      });
    }

    // Fetch updated count
    const updatedCount = updateResult.count;

    return apiSuccess({
      updatedCount,
      message: `Successfully applied metadata to ${updatedCount} question(s) in 1 click!`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
