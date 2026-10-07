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
        const cleanChap = a.chapter
          .replace(/^\[class\s*\d+\]\s*/i, "")
          .replace(/^ch\s*\d+:\s*/i, "")
          .replace(/^\d+[\.:\s-]+/i, "")
          .trim();

        const chapterFilter = {
          subject: { equals: a.subject, mode: "insensitive" as const },
          OR: [
            { chapter: { contains: cleanChap, mode: "insensitive" as const } },
            { category: { contains: cleanChap, mode: "insensitive" as const } },
          ],
        };

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
              ...chapterFilter,
              aiVerified: true,
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              status: { in: ["REVIEW_2", "PUBLISHED"] },
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              status: { in: ["DRAFT", "REVIEW_1"] },
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              status: "PUBLISHED",
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              OR: [
                { status: "REJECTED" },
                { review1Status: "CHANGES_REQUESTED" },
                { review2Status: "CHANGES_REQUESTED" },
              ],
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              correctionStatus: "REWORK",
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              status: "DRAFT",
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
              status: "REVIEW_1",
            },
          }),
          prisma.question.count({
            where: {
              ...chapterFilter,
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

    const cleanChap = chapter
      .replace(/^\[class\s*\d+\]\s*/i, "")
      .replace(/^ch\s*\d+:\s*/i, "")
      .replace(/^\d+[\.:\s-]+/i, "")
      .trim();

    // Check total questions in this chapter
    const totalQuestionsInChapter = await prisma.question.count({
      where: {
        subject: { equals: subject.trim(), mode: "insensitive" },
        OR: [
          { chapter: { contains: cleanChap, mode: "insensitive" } },
          { category: { contains: cleanChap, mode: "insensitive" } },
        ],
      },
    });

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

    // Automatically associate unassigned questions in this chapter to the assigned reviewer
    await prisma.question.updateMany({
      where: {
        subject: { equals: subject.trim(), mode: "insensitive" },
        OR: [
          { chapter: { contains: cleanChap, mode: "insensitive" } },
          { category: { contains: cleanChap, mode: "insensitive" } },
        ],
        assignedToId: null,
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
