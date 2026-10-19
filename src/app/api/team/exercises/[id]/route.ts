import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getExerciseDetails } from "@/lib/exercises/exercise-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const exercise = await getExerciseDetails(params.id);
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    return apiSuccess(exercise);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const allowedFields = [
      "title",
      "subtitle",
      "description",
      "instructions",
      "exerciseType",
      "organizationMode",
      "status",
      "languageMode",
      "answerKeyMode",
      "solutionMode",
      "defaultMarks",
      "defaultNegativeMarks",
      "layoutSettings",
      "topic",
      "subTopic",
    ];

    const dataToUpdate: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        dataToUpdate[key] = body[key];
      }
    }

    const updated = await prisma.exercise.update({
      where: { id: params.id },
      data: dataToUpdate,
    });

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    // Exercise deletion cascades to sections and exerciseQuestion mappings,
    // NEVER deleting the underlying canonical Question in the Question Bank.
    await prisma.exercise.delete({
      where: { id: params.id },
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
