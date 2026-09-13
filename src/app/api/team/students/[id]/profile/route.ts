import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getStudentCompleteProfile } from "@/lib/student/profile";

/**
 * Aggregated student profile for the admin Student Management console —
 * previously there was no per-student detail page/endpoint at all (only a
 * batch-access modal). Same gate as /team/students itself: only
 * STUDENT_READ_ANY or USER_READ can view any student's academic data;
 * this is enforced here server-side, never left to the frontend to hide a
 * link.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canAccess =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
    if (!canAccess) return apiError("Forbidden", 403);

    const profile = await getStudentCompleteProfile(params.id);
    if (!profile) return apiError("Student not found", 404);

    return apiSuccess({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
