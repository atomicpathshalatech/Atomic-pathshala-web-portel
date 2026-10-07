import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  editMessage,
  deleteMessage,
  reactToMessage,
  toggleStarMessage,
  togglePinMessage,
  broadcastTyping,
} from "@/lib/messages/messaging-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    const userRole = (session.user as any).role || "STUDENT";

    switch (action) {
      case "react": {
        const { messageId, emoji } = body;
        if (!messageId || !emoji) return apiError("messageId and emoji are required", 400);
        const reactions = await reactToMessage(messageId, session.user.id, emoji);
        return apiSuccess({ reactions });
      }

      case "star": {
        const { messageId } = body;
        if (!messageId) return apiError("messageId is required", 400);
        const result = await toggleStarMessage(messageId, session.user.id);
        return apiSuccess(result);
      }

      case "pin": {
        const { messageId } = body;
        if (!messageId) return apiError("messageId is required", 400);
        const result = await togglePinMessage(messageId);
        return apiSuccess(result);
      }

      case "edit": {
        const { messageId, text } = body;
        if (!messageId || typeof text !== "string") return apiError("messageId and text are required", 400);
        const updated = await editMessage(messageId, session.user.id, text);
        return apiSuccess({ message: updated });
      }

      case "delete": {
        const { messageId, mode } = body;
        if (!messageId) return apiError("messageId is required", 400);
        const result = await deleteMessage(messageId, session.user.id, userRole, mode === "EVERYONE" ? "EVERYONE" : "ME");
        return apiSuccess(result);
      }

      case "typing": {
        const { conversationId, isTyping } = body;
        if (!conversationId) return apiError("conversationId is required", 400);
        await broadcastTyping(conversationId, session.user.id, session.user.name || "User", Boolean(isTyping));
        return apiSuccess({ ok: true });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
