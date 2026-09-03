import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getUserRevisionDashboard,
  addPortionToRevision,
  removePortionFromRevision,
} from "@/lib/question-bank-hierarchical/revision-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const data = await getUserRevisionDashboard(session.user.id);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { action, entityType, entityId, title, fullPath, revisionItemId } = body;

    if (action === "add" && entityType && entityId && title && fullPath) {
      const item = await addPortionToRevision(session.user.id, {
        entityType,
        entityId,
        title,
        fullPath,
      });
      return apiSuccess({ success: true, item });
    }

    if (action === "remove" && revisionItemId) {
      await removePortionFromRevision(session.user.id, revisionItemId);
      return apiSuccess({ success: true, message: "Portion removed from active revision." });
    }

    return apiError("Invalid revision action or payload.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
