import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chapterQuestionWhere, standardAssignmentChapter } from "@/lib/questions/chapter-match";
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
    const viewAll = searchParams.get("viewAll") === "true";
    const status = searchParams.get("status");

    // If faculty/teacher without admin scope, only show their own assignments
    const where: any = {};
    if (!isAssignAdmin || !viewAll) {
      where.assignedToId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    const assignments = await prisma.questionAssignment.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute comprehensive live question stats for each assigned chapter
    const assignmentStats = await Promise.all(
      assignments.map(async (a) => {
        // Exactly this chapter's questions (standard NCERT name) — the old
        // "chapter or category CONTAINS" filter counted other chapters too.
        const chapterFilter = chapterQuestionWhere(a.subject, a.chapter);

        const [
          total,
          aiAudited,
          reviewed,
          pendingReview,
          published,
          revision,
          rework,
          draft,
          review1,
          review2,
        ] = await Promise.all([
          prisma.question.count({ where: chapterFilter }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              aiVerified: true,
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: { in: ["REVIEW_2", "PUBLISHED"] },
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: { in: ["DRAFT", "REVIEW_1"] },
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: "PUBLISHED",
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              OR: [
                { status: "REJECTED" },
                { review1Status: "CHANGES_REQUESTED" },
                { review2Status: "CHANGES_REQUESTED" },
              ],
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              correctionStatus: "REWORK",
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: "DRAFT",
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: "REVIEW_1",
            },
          }),
          prisma.question.count({
            where: {
              AND: [chapterFilter],
              status: "REVIEW_2",
            },
          }),
        ]);

        return {
          ...a,
          targetCount: total || a.targetCount || 0,
          liveStats: {
            total,
            aiAudited,
            reviewed,
            pendingReview,
            published,
            revision,
            rework,
            draft,
            review1,
            review2,
            rejected: revision,
          },
        };
      })
    );

    return apiSuccess({ assignments: assignmentStats, isAssignAdmin });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN);

    const body = await req.json();
    const { subject, chapter, assignedToId, instructions, notes } = body;

    if (!subject || !chapter || !assignedToId) {
      return apiError("Subject, Chapter, and Assigned Faculty are required", 400);
    }

    const assignedUser = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignedUser) {
      return apiError("Assigned user not found", 404);
    }

    // The standard chapter name, and exactly that chapter's questions.
    const cleanChap = standardAssignmentChapter(subject, chapter);
    const inChapter = chapterQuestionWhere(subject, chapter);

    // Check total questions in this chapter
    const totalQuestionsInChapter = await prisma.question.count({ where: inChapter });

    // Auto-generate title for clean chapter assignment
    const title = `${subject.trim()} — ${cleanChap}`;

    const assignment = await prisma.questionAssignment.create({
      data: {
        title,
        subject: subject.trim(),
        chapter: cleanChap,
        targetCount: totalQuestionsInChapter,
        assignedToId,
        assignedById: session.user.id,
        instructions: (instructions || notes)?.trim() || null,
        notes: (instructions || notes)?.trim() || null,
        status: "ASSIGNED",
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    // The chapter's questions go to the new reviewer: unassigned ones, and
    // ones assigned earlier that nobody has started on. (Only unassigned ones
    // moved before, so re-assigning a chapter left the new reviewer with
    // nothing.) Questions someone is correcting stay with them; published ones
    // are not reopened.
    await prisma.question.updateMany({
      where: {
        AND: [inChapter],
        status: { not: "PUBLISHED" },
        OR: [{ assignedToId: null }, { correctionStatus: { in: ["NONE", "ASSIGNED"] } }, { correctionStatus: null }],
      },
      data: {
        assignedToId,
        assignedById: session.user.id,
        assignedAt: new Date(),
        correctionStatus: "ASSIGNED",
      },
    });

    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
