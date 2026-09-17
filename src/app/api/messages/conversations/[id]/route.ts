import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getConversationThread } from "@/lib/messages/messaging-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const userRole = (session.user as any).role || "STUDENT";
    const data = await getConversationThread(params.id, session.user.id, userRole);

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
