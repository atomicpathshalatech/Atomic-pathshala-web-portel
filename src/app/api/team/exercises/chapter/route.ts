import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getExercisesForChapter } from "@/lib/exercises/exercise-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();

    if (!subject || !chapter) {
      return NextResponse.json({ error: "Both subject and chapter query parameters are required" }, { status: 400 });
    }

    const exercises = await getExercisesForChapter(subject, chapter);
    return apiSuccess({ exercises });
  } catch (err) {
    return handleApiError(err);
  }
}
