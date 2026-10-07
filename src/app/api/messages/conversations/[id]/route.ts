import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getConversationThread, updateConversationSettings } from "@/lib/messages/messaging-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const userRole = (session.user as any).role || "STUDENT";
    const data = await getConversationThread(params.id, session.user.id, userRole, {
      cursor,
      limit,
    });

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json().catch(() => ({}));
    const updated = await updateConversationSettings(params.id, session.user.id, {
      isPinned: typeof body.isPinned === "boolean" ? body.isPinned : undefined,
      isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined,
      isMuted: typeof body.isMuted === "boolean" ? body.isMuted : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      iconUrl: typeof body.iconUrl === "string" ? body.iconUrl : undefined,
      onlyAdminsCanPost: typeof body.onlyAdminsCanPost === "boolean" ? body.onlyAdminsCanPost : undefined,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
