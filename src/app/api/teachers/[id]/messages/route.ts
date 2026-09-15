import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await prisma.teacher.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, name: true, photoUrl: true } } },
    });
    if (!teacher) return apiError("Teacher not found", 404);

    // Identify requester role
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { id: true, name: true, photoUrl: true } } },
    });

    const isTeacherSelf = teacher.userId === session.user.id;
    const isAdmin =
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ADMIN" ||
      session.user.role === "FOUNDER";

    // If caller is student, get or create conversation with this teacher
    if (student) {
      let conversation = await prisma.teacherDirectConversation.findUnique({
        where: {
          studentId_teacherId: {
            studentId: student.id,
            teacherId: teacher.id,
          },
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.teacherDirectConversation.create({
          data: {
            studentId: student.id,
            teacherId: teacher.id,
          },
          include: {
            messages: true,
          },
        });
      }

      return apiSuccess({
        conversationId: conversation.id,
        teacher: {
          id: teacher.id,
          name: teacher.user.name,
          photoUrl: teacher.user.photoUrl,
        },
        student: {
          id: student.id,
          name: student.user.name,
          photoUrl: student.user.photoUrl,
        },
        messages: conversation.messages,
      });
    }

    // If caller is the teacher themselves or an admin, require studentId query param
    if (isTeacherSelf || isAdmin) {
      const { searchParams } = new URL(request.url);
      const studentId = searchParams.get("studentId");
      if (!studentId) {
        // Return recent conversation list for this teacher
        const conversations = await prisma.teacherDirectConversation.findMany({
          where: { teacherId: teacher.id },
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, photoUrl: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        });

        return apiSuccess({ conversations });
      }

      const conversation = await prisma.teacherDirectConversation.findUnique({
        where: {
          studentId_teacherId: {
            studentId,
            teacherId: teacher.id,
          },
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
          },
          student: {
            include: {
              user: { select: { id: true, name: true, photoUrl: true } },
            },
          },
        },
      });

      return apiSuccess({
        conversationId: conversation?.id,
        messages: conversation?.messages || [],
        student: conversation?.student,
      });
    }

    throw new ForbiddenError("Not authorized to access messages.");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await prisma.teacher.findUnique({ where: { id: params.id } });
    if (!teacher) return apiError("Teacher not found", 404);

    const body = await request.json().catch(() => ({}));
    const messageText = typeof body.message === "string" ? body.message.trim() : "";

    if (!messageText) {
      return apiError("Message body cannot be empty", 400);
    }
    if (messageText.length > 2000) {
      return apiError("Message exceeds 2000 characters limit", 400);
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    const isTeacherSelf = teacher.userId === session.user.id;
    const isAdmin =
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ADMIN" ||
      session.user.role === "FOUNDER";

    let conversationId = body.conversationId;
    let senderRole = "STUDENT";

    if (student) {
      senderRole = "STUDENT";
      const conversation = await prisma.teacherDirectConversation.upsert({
        where: {
          studentId_teacherId: {
            studentId: student.id,
            teacherId: teacher.id,
          },
        },
        create: {
          studentId: student.id,
          teacherId: teacher.id,
        },
        update: {
          updatedAt: new Date(),
        },
      });
      conversationId = conversation.id;
    } else if (isTeacherSelf) {
      senderRole = "TEACHER";
      if (!conversationId) return apiError("conversationId is required", 400);
    } else if (isAdmin) {
      senderRole = "ADMIN";
      if (!conversationId) return apiError("conversationId is required", 400);
    } else {
      throw new ForbiddenError("Only students, the educator, or administrators can send messages.");
    }

    // Save message
    const message = await prisma.teacherDirectMessage.create({
      data: {
        conversationId,
        senderUserId: session.user.id,
        senderRole,
        body: messageText,
      },
    });

    // Update conversation timestamp
    await prisma.teacherDirectConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Broadcast via Pusher for realtime sync
    try {
      await pusherServer.trigger(
        directConversationChannel(conversationId),
        DIRECT_MESSAGE_EVENTS.NEW_MESSAGE,
        {
          id: message.id,
          conversationId,
          senderUserId: message.senderUserId,
          senderRole: message.senderRole,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
        }
      );
    } catch (pusherErr) {
      console.warn("Pusher direct message trigger skipped or failed:", pusherErr);
    }

    return apiSuccess({ message }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
