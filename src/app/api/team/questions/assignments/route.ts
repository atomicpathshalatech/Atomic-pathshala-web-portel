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

    // Compute live question stats for each assignment based on Subject & Chapter
    const assignmentStats = await Promise.all(
      assignments.map(async (a) => {
        const [total, draft, review1, review2, published, rejected] = await Promise.all([
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
            },
          }),
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
              status: "DRAFT",
            },
          }),
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
              status: "REVIEW_1",
            },
          }),
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
              status: "REVIEW_2",
            },
          }),
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
              status: "PUBLISHED",
            },
          }),
          prisma.question.count({
            where: {
              subject: { equals: a.subject, mode: "insensitive" },
              category: { equals: a.chapter, mode: "insensitive" },
              status: "REJECTED",
            },
          }),
        ]);

        return {
          ...a,
          liveStats: {
            total,
            draft,
            review1,
            review2,
            published,
            rejected,
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
    const { title, description, subject, chapter, topic, targetCount, difficulty, assignedToId, dueDate, notes } = body;

    if (!title || !subject || !chapter || !assignedToId) {
      return apiError("Title, subject, chapter, and assigned teacher are required", 400);
    }

    const assignedUser = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignedUser) {
      return apiError("Assigned user not found", 404);
    }

    const assignment = await prisma.questionAssignment.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        subject: subject.trim(),
        chapter: chapter.trim(),
        topic: topic?.trim() || null,
        targetCount: parseInt(targetCount || "0", 10) || 0,
        difficulty: difficulty || null,
        assignedToId,
        assignedById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes?.trim() || null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
