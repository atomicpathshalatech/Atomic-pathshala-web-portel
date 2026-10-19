import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { importQuestionsToExercise } from "@/lib/exercises/exercise-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const rawInput = body.rawInput;
    const targetSectionId = body.targetSectionId;

    if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
      return NextResponse.json(
        { error: "Please enter at least one Question ID or Question Code to import." },
        { status: 400 }
      );
    }

    const result = await importQuestionsToExercise({
      exerciseId: params.id,
      rawInput,
      targetSectionId,
      userId: session.user.id,
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
