import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(500, "Message max 500 characters"),
  isAnnouncement: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { message, isAnnouncement } = messageSchema.parse(body);

    const isTeacherOrAdmin =
      session.user.role === "TEACHER" || session.user.role === "ADMIN";

    const announcementFlag = isTeacherOrAdmin ? isAnnouncement : false;

    // Rate-limit check: user cannot send more than 1 message per 2 seconds
    const recent = await prisma.liveChatMessage.findFirst({
      where: {
        liveClassId: params.classId,
        userId: session.user.id,
        createdAt: { gte: new Date(Date.now() - 2000) },
      },
    });

    if (recent && !isTeacherOrAdmin) {
      return apiError("Slow down! Please wait 2 seconds between messages.", 429);
    }

    const chatMsg = await prisma.liveChatMessage.create({
      data: {
        liveClassId: params.classId,
        userId: session.user.id,
        authorName: session.user.name || "Student",
        authorRole: session.user.role || "STUDENT",
        message: message.trim(),
        isAnnouncement: announcementFlag,
      },
    });

    // Realtime broadcast to room channel
    try {
      await pusherServer.trigger(
        sessionChannel(params.classId),
        WB_EVENTS.MESSAGE_SENT,
        {
          id: chatMsg.id,
          userId: chatMsg.userId,
          authorName: chatMsg.authorName,
          authorRole: chatMsg.authorRole,
          message: chatMsg.message,
          isAnnouncement: chatMsg.isAnnouncement,
          createdAt: chatMsg.createdAt.toISOString(),
        }
      );
    } catch (pushErr) {
      console.warn("[LiveChat] Realtime push warning:", pushErr);
    }

    return apiSuccess({
      message: chatMsg,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
