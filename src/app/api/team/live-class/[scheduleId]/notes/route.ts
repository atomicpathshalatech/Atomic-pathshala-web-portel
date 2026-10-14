import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { attachClassNotes, classNotesHistory, ClassNotesError } from "@/lib/batch/class-notes";

/** Staff: every notes PDF attached to this class, newest first, and which one each replaced. */
export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId) return apiError("Class not found", 404);
    return apiSuccess({ history: await classNotesHistory(scheduleId) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Teacher (or admin) attaches a notes PDF to a class — any kind, before or after it happens. */
export async function POST(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId) return apiError("Class not found", 404);

    const body = await request.json().catch(() => ({}));
    const fileAssetId = typeof body.fileAssetId === "string" ? body.fileAssetId.trim() : "";
    if (!fileAssetId) return apiError("Upload the notes PDF first.", 400);

    const result = await attachClassNotes(scheduleId, fileAssetId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ClassNotesError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
