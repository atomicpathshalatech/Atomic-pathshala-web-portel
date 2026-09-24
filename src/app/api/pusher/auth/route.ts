import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { verifyBroadcastToken } from "@/lib/live-class/broadcast-token";
import { apiError } from "@/lib/api/response";

/**
 * Pusher channel authorizer. Identity for realtime channels gets decided
 * here via session or verified broadcast token (for OBS Browser Sources).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");
  const broadcastToken = params.get("broadcast_token") || request.nextUrl.searchParams.get("broadcast_token");
  if (!socketId || !channelName) return apiError("Missing socket_id/channel_name", 400);

  const presenceMatch = channelName.match(/^presence-wb-session-(.+)$/);
  const teacherMatch = channelName.match(/^private-wb-teacher-(.+)$/);
  const doubtBookingMatch = channelName.match(/^private-doubt-booking-(.+)$/);
  const classroomPresenceMatch = channelName.match(/^presence-classroom-(.+)$/);
  const classroomTeacherMatch = channelName.match(/^private-classroom-teacher-(.+)$/);

  try {
    // 1. Check Broadcast Token (OBS Browser Source / Headless ingest)
    if (broadcastToken && presenceMatch) {
      const payload = verifyBroadcastToken(broadcastToken);
      if (payload) {
        const wbSession = await prisma.whiteboardSession.findFirst({
          where: { id: presenceMatch[1]!, batchScheduleId: payload.scheduleId },
          select: { id: true },
        });
        if (wbSession) {
          const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
            user_id: `OBS:${payload.teacherUserId}`,
            user_info: { name: "OBS Stage", role: "OBS" },
          });
          return Response.json(authResponse);
        }
      }
    }

    // 2. Standard Session Authorization
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    if (presenceMatch) {
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

    if (classroomPresenceMatch) {
      const access = await resolveClassroomAccess(session.user.id, classroomPresenceMatch[1]!);
      if (!access) return apiError("Forbidden", 403);

      const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
        user_id: `${access.role}:${access.entityId}`,
        user_info: { name: access.name, role: access.role },
      });
      return Response.json(authResponse);
    }

    if (classroomTeacherMatch) {
      const access = await resolveClassroomAccess(session.user.id, classroomTeacherMatch[1]!);
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

      const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "FOUNDER", "TEACHER", "ACADEMIC_HEAD"];
      if (!isEnrolled && !STAFF_ROLES.includes(session.user.role || "")) {
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
