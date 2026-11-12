import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const isAssignAdmin =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE));

    const searchParams = req.nextUrl.searchParams;
    const tab = (searchParams.get("tab") || "PENDING").toUpperCase();
    const subject = (searchParams.get("subject") || "ALL").toUpperCase();
    const search = searchParams.get("search")?.trim() || "";
    const requestedTeacherId = searchParams.get("teacherId");

    // Strictly enforce teacher ownership: regular teachers can ONLY query their own assignments
    const targetUserId = isAssignAdmin && requestedTeacherId ? requestedTeacherId : session.user.id;

    // Source of truth counts
    const completedCondition = {
      assignedToId: targetUserId,
      OR: [
        { correctionStatus: { in: ["SUBMITTED", "APPROVED", "COMPLETED"] } },
        { status: "PUBLISHED" },
        { correctionSubmittedAt: { not: null } },
      ],
    };

    const pendingCondition = {
      assignedToId: targetUserId,
      AND: [
        {
          OR: [
            { correctionStatus: { in: ["ASSIGNED", "IN_CORRECTION", "REWORK", "NONE"] } },
            { correctionStatus: null },
          ],
        },
        { status: { not: "PUBLISHED" } },
        { correctionSubmittedAt: null },
      ],
    };

    const [totalAssigned, completedCount, pendingCount] = await Promise.all([
      prisma.question.count({ where: { assignedToId: targetUserId } }),
      prisma.question.count({ where: completedCondition }),
      prisma.question.count({ where: pendingCondition }),
    ]);

    // Build query filter for list
    const listWhere: any = tab === "COMPLETED" ? { ...completedCondition } : { ...pendingCondition };

    if (subject !== "ALL") {
      listWhere.subject = { equals: subject, mode: "insensitive" };
    }

    if (search) {
      listWhere.AND = [
        ...(listWhere.AND || []),
        {
          OR: [
            { questionCode: { contains: search, mode: "insensitive" } },
            { chapter: { contains: search, mode: "insensitive" } },
            { topic: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
            {
              translations: {
                some: {
                  statement: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        },
      ];
    }

    const questions = await prisma.question.findMany({
      where: listWhere,
      select: {
        id: true,
        questionCode: true,
        subject: true,
        chapter: true,
        topic: true,
        subTopic: true,
        type: true,
        difficulty: true,
        status: true,
        correctionStatus: true,
        correctionNotes: true,
        correctionSubmittedAt: true,
        assignedAt: true,
        createdAt: true,
        review1Status: true,
        review2Status: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
        translations: {
          select: {
            id: true,
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: true,
          },
        },
      },
      orderBy: tab === "COMPLETED" ? { correctionSubmittedAt: "desc" } : { assignedAt: "desc" },
      take: 200,
    });

    return apiSuccess({
      questions,
      totalAssigned,
      pendingCount,
      completedCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await req.json();
    const { questionId, action, notes, difficulty, solution } = body;

    if (!questionId) {
      return apiError("Question ID is required.", 400);
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return apiError("Question not found.", 404);
    }

    const isAssignAdmin =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE));

    // Security: Only assigned teacher or admin can submit review
    if (!isAssignAdmin && question.assignedToId !== session.user.id) {
      return apiError("Forbidden: You are not assigned to review this question.", 403);
    }

    const now = new Date();
    const isApproved = action === "APPROVE" || action === "COMPLETED";

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        correctionStatus: isApproved ? "COMPLETED" : "REWORK",
        correctionSubmittedAt: now,
        correctionSubmittedById: session.user.id,
        correctionNotes: notes?.trim() || question.correctionNotes,
        status: isApproved ? "REVIEW_2" : "DRAFT",
        review1Status: isApproved ? "APPROVED" : "CHANGES_REQUESTED",
        review1ById: session.user.id,
        review1At: now,
        review1Notes: notes?.trim() || null,
        ...(difficulty ? { difficulty } : {}),
        ...(solution ? { solution } : {}),
        editedById: session.user.id,
        editedAt: now,
      },
      select: {
        id: true,
        questionCode: true,
        correctionStatus: true,
        status: true,
        correctionSubmittedAt: true,
      },
    });

    return apiSuccess({
      message: isApproved ? "Question review completed successfully!" : "Changes requested / rework assigned.",
      question: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
