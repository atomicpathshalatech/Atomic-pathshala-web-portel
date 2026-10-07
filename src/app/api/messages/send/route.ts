import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { sendMessage } from "@/lib/messages/messaging-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const reqBody = await request.json().catch(() => ({}));
    const rawMessage = reqBody.message ?? reqBody.body ?? "";
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const recipientType = (reqBody.recipientType || reqBody.recipientRole) as any;
    const recipientId = (reqBody.recipientId || reqBody.recipientUserId || reqBody.teacherId || reqBody.studentId)
      ? String(reqBody.recipientId || reqBody.recipientUserId || reqBody.teacherId || reqBody.studentId).trim()
      : undefined;
    const conversationId = reqBody.conversationId ? String(reqBody.conversationId).trim() : undefined;
    const clientMessageId = reqBody.clientMessageId ? String(reqBody.clientMessageId).trim() : undefined;
    const replyToId = reqBody.replyToId ? String(reqBody.replyToId).trim() : undefined;
    const mediaUrl = reqBody.mediaUrl || null;
    const mediaType = reqBody.mediaType || null;
    const mediaName = reqBody.mediaName || null;
    const mediaSize = typeof reqBody.mediaSize === "number" ? reqBody.mediaSize : null;
    const isForwarded = Boolean(reqBody.isForwarded);

    if (!message && !mediaUrl) {
      return apiError("Message or media cannot be empty", 400);
    }

    const userRole = (session.user as any).role || "STUDENT";

    let senderRole = "STUDENT";
    if (
      userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN" ||
      userRole === "FOUNDER" ||
      userRole === "SUB_ADMIN"
    ) {
      senderRole = "ADMIN";
    } else if (userRole === "TEACHER") {
      senderRole = "TEACHER";
    }

    const result = await sendMessage({
      senderUserId: session.user.id,
      senderRole,
      recipientType: recipientType || "ADMIN",
      recipientId,
      message,
      conversationId,
      clientMessageId,
      replyToId,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      isForwarded,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
