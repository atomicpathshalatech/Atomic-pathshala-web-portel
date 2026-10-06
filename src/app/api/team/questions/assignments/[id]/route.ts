import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const assignment = await prisma.questionAssignment.findUnique({
      where: { id: params.id },
    });

    if (!assignment) {
      return apiError("Assignment not found", 404);
    }

    const isAssignAdmin =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE));

    // Faculty can update status and notes of their own assigned tasks
    const isOwner = assignment.assignedToId === session.user.id;
    if (!isAssignAdmin && !isOwner) {
      return apiError("You do not have permission to update this assignment", 403);
    }

    const body = await req.json();
    const { status, notes, title, description, targetCount, dueDate } = body;

    const updated = await prisma.questionAssignment.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(isAssignAdmin && title && { title: title.trim() }),
        ...(isAssignAdmin && description !== undefined && { description }),
        ...(isAssignAdmin && targetCount !== undefined && { targetCount: parseInt(targetCount, 10) }),
        ...(isAssignAdmin && dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess({ assignment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN);

    await prisma.questionAssignment.delete({
      where: { id: params.id },
    });

    return apiSuccess({ success: true, message: "Assignment deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
