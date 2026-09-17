import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getConversationsForUser } from "@/lib/messages/messaging-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || undefined;
    const search = searchParams.get("search") || undefined;

    const userRole = (session.user as any).role || "STUDENT";

    const conversations = await getConversationsForUser(session.user.id, userRole, {
      tab,
      search,
    });

    return apiSuccess({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
