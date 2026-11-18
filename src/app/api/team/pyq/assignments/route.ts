import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeamUser, can } from "@/lib/pyq/api";

/**
 * GET /api/team/pyq/assignments
 * Query params:
 *   - filter: "mine" | "all" (defaults to "mine" unless user is Admin/SuperAdmin and requests "all")
 *   - status: optional status filter
 *   - subject, chapter, priority
 * Returns summary cards (total, pending, in-progress, completed) and grouped chapter assignments.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const sp = request.nextUrl.searchParams;
    const filter = sp.get("filter")?.toLowerCase() || "mine";
    const statusFilter = sp.get("status")?.toUpperCase();
    const subjectFilter = sp.get("subject")?.trim();
    const chapterFilter = sp.get("chapter")?.trim();
    const priorityFilter = sp.get("priority")?.toUpperCase();

    // Determine target user filter
    const isSuperOrAdmin =
      sessionUser.role === "SUPER_ADMIN" ||
      sessionUser.role === "ADMIN" ||
      sessionUser.role === "FOUNDER" ||
      (await can(sessionUser.id, PERMISSIONS.QUESTION_ASSIGN));
    const showAll = filter === "all" && isSuperOrAdmin;

    const assignmentWhere: any = {
      ...(showAll ? {} : { assignedToId: sessionUser.id }),
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(subjectFilter && subjectFilter !== "ALL"
        ? { subject: { equals: subjectFilter, mode: "insensitive" } }
        : {}),
      ...(chapterFilter ? { chapter: { contains: chapterFilter, mode: "insensitive" } } : {}),
      ...(priorityFilter && priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
    };

    // Fetch assignments
    const assignments = await prisma.pyqAssignment.findMany({
      where: assignmentWhere,
      orderBy: [{ createdAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true, email: true, photoUrl: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        exam: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
    });

    // Also calculate personal or global metrics for 4 primary dashboard cards
    const userTargetId = showAll ? undefined : sessionUser.id;
    const questionWhereBase: any = {
      ...(userTargetId ? { assignedToId: userTargetId } : { assignedToId: { not: null } }),
    };

    const [totalAssignedCount, pendingReviewCount, inProgressCount, completedCount] =
      await Promise.all([
        prisma.question.count({
          where: { ...questionWhereBase, pyqVerificationStatus: { in: ["ASSIGNED", "IN_REVIEW", "NEEDS_CORRECTION", "VERIFIED"] } },
        }),
        prisma.question.count({
          where: { ...questionWhereBase, pyqVerificationStatus: "ASSIGNED" },
        }),
        prisma.question.count({
          where: { ...questionWhereBase, pyqVerificationStatus: "IN_REVIEW" },
        }),
        prisma.question.count({
          where: { ...questionWhereBase, pyqVerificationStatus: "VERIFIED" },
        }),
      ]);

    return apiSuccess({
      filter: showAll ? "all" : "mine",
      isSuperOrAdmin,
      summary: {
        totalAssigned: totalAssignedCount,
        pendingReview: pendingReviewCount,
        inProgress: inProgressCount,
        completedReviews: completedCount,
      },
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.subject,
        chapter: a.chapter,
        examName: a.exam?.name || "NEET UG",
        assignmentType: a.assignmentType,
        priority: a.priority,
        deadline: a.deadline,
        instructions: a.instructions,
        status: a.status,
        totalQuestions: a.totalQuestions,
        pendingCount: a.pendingCount,
        inReviewCount: a.inReviewCount,
        verifiedCount: a.verifiedCount,
        rejectedCount: a.rejectedCount,
        assignedTo: a.assignedTo,
        assignedBy: a.assignedBy,
        assignedAt: a.assignedAt,
        completedAt: a.completedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/pyq/assignments
 * Create a new question assignment:
 * - Complete Chapter Assignment (finds all unverified questions in the chapter)
 * - Selected Questions Assignment (assigns specific question IDs)
 * - Self Assignment (assigns to the requesting user)
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const body = await request.json();
    const {
      assignmentType = "CHAPTER", // CHAPTER | SELECTED_QUESTIONS | SELF
      subject,
      chapter,
      examId,
      questionIds,
      assignedToId,
      priority = "NORMAL",
      deadline,
      instructions,
    } = body;

    if (!subject || !chapter) {
      return apiError("Subject and Chapter are required", 400);
    }

    // Determine target assignee
    let targetUserId = assignedToId;
    if (assignmentType === "SELF") {
      targetUserId = sessionUser.id;
    }

    if (!targetUserId) {
      return apiError("Target reviewer is required", 400);
    }

    // Check permissions: only Admins / Super Admins / Founders / users with QUESTION_ASSIGN can assign to others; self-assignment allowed for any reviewer
    const isSelf = targetUserId === sessionUser.id;
    const canAssignOthers =
      sessionUser.role === "SUPER_ADMIN" ||
      sessionUser.role === "ADMIN" ||
      sessionUser.role === "FOUNDER" ||
      (await can(sessionUser.id, PERMISSIONS.QUESTION_ASSIGN));

    if (!isSelf && !canAssignOthers) {
      return apiError("Permission denied: only Admins can assign questions to other team members", 403);
    }

    // Find the questions to assign
    let targetQuestions: { id: string }[] = [];

    if (assignmentType === "SELECTED_QUESTIONS") {
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return apiError("No question IDs provided for selected questions assignment", 400);
      }
      targetQuestions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true },
      });
    } else {
      // CHAPTER or SELF assignment across chapter
      targetQuestions = await prisma.question.findMany({
        where: {
          subject: { equals: subject, mode: "insensitive" },
          chapter: { contains: chapter, mode: "insensitive" },
          OR: [
            { pyqVerificationStatus: { not: "VERIFIED" } },
            { pyqVerificationStatus: null },
          ],
          ...(examId ? { pyqOccurrences: { some: { examId } } } : {}),
        },
        select: { id: true },
      });
    }

    if (targetQuestions.length === 0) {
      return apiError("No eligible unverified questions found in this chapter to assign", 400);
    }

    const dueDate = deadline ? new Date(deadline) : null;
    const count = targetQuestions.length;

    // Fetch assignee name for history log
    const assignee = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true, email: true },
    });

    // Execute atomic creation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PyqAssignment
      const assignment = await tx.pyqAssignment.create({
        data: {
          title: `${subject} - ${chapter} (${assignmentType})`,
          subject,
          chapter,
          examId: examId || undefined,
          assignmentType,
          priority,
          deadline: dueDate,
          instructions: instructions || undefined,
          status: "ASSIGNED",
          totalQuestions: count,
          pendingCount: count,
          inReviewCount: 0,
          verifiedCount: 0,
          assignedToId: targetUserId,
          assignedById: sessionUser.id,
        },
      });

      // 2. Create junction rows in PyqAssignmentQuestion
      const junctionData = targetQuestions.map((q) => ({
        assignmentId: assignment.id,
        questionId: q.id,
        status: "PENDING",
      }));

      await tx.pyqAssignmentQuestion.createMany({
        data: junctionData,
        skipDuplicates: true,
      });

      // 3. Update questions status to ASSIGNED and link assignee
      const qIds = targetQuestions.map((q) => q.id);
      await tx.question.updateMany({
        where: { id: { in: qIds } },
        data: {
          pyqVerificationStatus: "ASSIGNED",
          assignedToId: targetUserId,
          assignedById: sessionUser.id,
          assignedAt: new Date(),
        },
      });

      // 4. Log review histories
      const historyRows = targetQuestions.map((q) => ({
        questionId: q.id,
        reviewerId: targetUserId,
        action: "ASSIGNED",
        comments: `Assigned to ${assignee?.name || assignee?.email} by ${sessionUser.name} (Priority: ${priority})`,
      }));

      await tx.pyqReviewHistory.createMany({
        data: historyRows,
      });

      // 5. In-app notification for the assignee
      await tx.notification.create({
        data: {
          userId: targetUserId,
          title: "New PYQ Review Assignment",
          body: `You have been assigned ${count} question(s) in "${chapter}" (${subject}) with ${priority} priority.`,
          type: "GENERAL",
          category: "SYSTEM",
          priority: priority === "URGENT" ? "URGENT" : priority === "HIGH" ? "HIGH" : "NORMAL",
          channel: "IN_APP",
          actionUrl: `/team/pyq-library?tab=MY_REVIEWS&chapter=${encodeURIComponent(chapter)}`,
          createdById: sessionUser.id,
        },
      });

      return assignment;
    });

    return apiSuccess({
      message: `Successfully assigned ${count} question(s) to ${assignee?.name || assignee?.email}`,
      assignment: result,
      assignedCount: count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
