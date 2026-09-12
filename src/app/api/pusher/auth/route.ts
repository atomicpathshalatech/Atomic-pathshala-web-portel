import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiError } from "@/lib/api/response";

/**
 * Pusher channel authorizer. This is the ONLY place identity for realtime
 * channels gets decided — the browser client never gets to declare its own
 * user id or name (unlike the draft `ws` code this replaces, which trusted
 * `?userId=&userName=` query params). Access is delegated to
 * resolveWhiteboardAccess() in src/lib/whiteboard/access.ts — the same
 * function every /api/whiteboard/* route uses — so realtime and REST access
 * can never drift out of sync with each other.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError("Unauthorized", 401);

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");
  if (!socketId || !channelName) return apiError("Missing socket_id/channel_name", 400);

  const presenceMatch = channelName.match(/^presence-wb-session-(.+)$/);
  const teacherMatch = channelName.match(/^private-wb-teacher-(.+)$/);
  const doubtBookingMatch = channelName.match(/^private-doubt-booking-(.+)$/);

  try {
    if (presenceMatch) {
      // Non-null: the regex has exactly one capture group, so a truthy
      // match always has index 1 populated.
      const access = await resolveWhiteboardAccess(session.user.id, presenceMatch[1]!);
      if (!access) return apiError("Forbidden", 403);

      const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
        user_id: `${access.role}:${access.entityId}`,
        user_info: { name: access.name, role: access.role },
      });
      return Response.json(authResponse);
    }

    if (teacherMatch) {
      const access = await resolveWhiteboardAccess(session.user.id, teacherMatch[1]!);
      if (!access || access.role !== "TEACHER") return apiError("Forbidden", 403);

      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return Response.json(authResponse);
    }

    if (doubtBookingMatch) {
      const bookingId = doubtBookingMatch[1]!;
      const booking = await prisma.doubtBooking.findUnique({
        where: { id: bookingId },
        include: { student: { select: { userId: true } }, teacher: { select: { userId: true } } },
      });
      if (!booking) return apiError("Forbidden", 403);

      const isStudent = booking.student.userId === session.user.id;
      const isTeacher = booking.teacher.userId === session.user.id;
      let isAdmin = false;
      if (!isStudent && !isTeacher) {
        const { hasPermission } = await import("@/lib/rbac/guard");
        const { PERMISSIONS } = await import("@/lib/rbac/permissions");
        isAdmin = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
      }
      if (!isStudent && !isTeacher && !isAdmin) return apiError("Forbidden", 403);

      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return Response.json(authResponse);
    }

    const userMatch = channelName.match(/^private-user-(.+)$/);
    const batchMatch = channelName.match(/^private-batch-(.+)$/);

    if (userMatch) {
      if (userMatch[1] !== session.user.id) {
        return apiError("Forbidden", 403);
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return Response.json(authResponse);
    }

    if (batchMatch) {
      const batchId = batchMatch[1]!;
      const isEnrolled = await prisma.batchEnrollment.findFirst({
        where: {
          batchId,
          status: "ACTIVE",
          student: { userId: session.user.id },
        },
      });

      if (!isEnrolled && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
        return apiError("Forbidden", 403);
      }

      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return Response.json(authResponse);
    }

    return apiError("Unknown channel", 400);
  } catch (error) {
    console.error("[pusher_auth_error]", error);
    return apiError("Could not authorize channel", 500);
  }
}
