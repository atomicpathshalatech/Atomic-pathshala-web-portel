import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";
import { chapterQuestionWhere, standardAssignmentChapter } from "@/lib/questions/chapter-match";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    // Assigning work to others needs the assign permission — being allowed to
    // create questions used to be enough.
    const canAssign =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN)) ||
      session.user.role === "ADMIN" ||
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ACADEMIC_HEAD";

    if (!canAssign) return apiError("Forbidden — Admin or Question Manager role required.", 403);

    const body = await request.json();
    const { questionIds, assignedToId, notes, dueDate, subject, chapter, topic } = body;

    if (!assignedToId) {
      return apiError("Please select a faculty/reviewer to assign.", 400);
    }

    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, email: true },
    });

    if (!assignedUser) {
      return apiError("Selected assignee user not found.", 404);
    }

    // Scenario A: Specific Question IDs provided
    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const updateResult = await prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: {
          assignedToId: assignedUser.id,
          assignedById: session.user.id,
          assignedAt: new Date(),
          correctionStatus: "ASSIGNED",
          correctionNotes: notes || null,
        },
      });

      return apiSuccess({
        message: `Successfully assigned ${updateResult.count} question(s) to ${assignedUser.name || assignedUser.email}.`,
        count: updateResult.count,
        assignee: assignedUser,
      });
    }

    // Scenario B: Chapter / Subject / Topic based assignment
    if (subject && chapter) {
      // Exactly this chapter (standard name); published questions are not reopened.
      const whereClause: Prisma.QuestionWhereInput = {
        AND: [chapterQuestionWhere(subject, chapter)],
        status: { not: "PUBLISHED" },
        ...(topic ? { topic: { equals: String(topic).trim(), mode: "insensitive" as const } } : {}),
      };

      const matchingQuestions = await prisma.question.findMany({
        where: whereClause,
        select: { id: true },
        take: body.targetCount ? Math.min(Number(body.targetCount), 1000) : 500,
      });

      const idsToAssign = matchingQuestions.map((q) => q.id);

      if (idsToAssign.length > 0) {
        await prisma.question.updateMany({
          where: { id: { in: idsToAssign } },
          data: {
            assignedToId: assignedUser.id,
            assignedById: session.user.id,
            assignedAt: new Date(),
            correctionStatus: "ASSIGNED",
            correctionNotes: notes || null,
          },
        });
      }

      // Also create a master QuestionAssignment entry for dashboard tracking
      const masterAssignment = await prisma.questionAssignment.create({
        data: {
          title: `Correction & Review: ${subject} - ${chapter}${topic ? ` (${topic})` : ""}`,
          subject,
          chapter: standardAssignmentChapter(subject, chapter),
          topic: topic || null,
          targetCount: idsToAssign.length,
          status: "ASSIGNED",
          assignedToId: assignedUser.id,
          assignedById: session.user.id,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes || null,
        },
      });

      return apiSuccess({
        message: `Assigned ${idsToAssign.length} questions in ${chapter} to ${assignedUser.name || assignedUser.email}.`,
        count: idsToAssign.length,
        assignmentId: masterAssignment.id,
        assignee: assignedUser,
      });
    }

    return apiError("Please select questions or specify subject and chapter to assign.", 400);
  } catch (error) {
    console.error("[AssignQuestionsAPI] Error:", error);
    return apiError(error instanceof Error ? error.message : "Failed to assign questions.", 500);
  }
}
