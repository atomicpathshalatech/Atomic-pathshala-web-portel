import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getHierarchicalQuestionBank,
  acknowledgeNodeSeen,
} from "@/lib/question-bank-hierarchical/hierarchy-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || undefined;
    const statusFilter = (searchParams.get("status") as "ALL" | "REVIEWED" | "DRAFT") || "ALL";

    const data = await getHierarchicalQuestionBank(userId, searchQuery, statusFilter);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { action, entityType, entityId } = body;

    if (action === "acknowledge_seen" && entityType && entityId) {
      await acknowledgeNodeSeen(session.user.id, entityType, entityId);
      return apiSuccess({ success: true, message: "Node acknowledged" });
    }

    return apiError("Invalid action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
