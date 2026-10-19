import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { removeQuestionFromExercise } from "@/lib/exercises/exercise-service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; exerciseQuestionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    await removeQuestionFromExercise(params.exerciseQuestionId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; exerciseQuestionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const data: any = {};
    if (body.sectionId !== undefined) data.sectionId = body.sectionId;
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder;
    if (body.marks !== undefined) data.marks = body.marks;
    if (body.negativeMarks !== undefined) data.negativeMarks = body.negativeMarks;

    const updated = await prisma.exerciseQuestion.update({
      where: { id: params.exerciseQuestionId },
      data,
    });

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
