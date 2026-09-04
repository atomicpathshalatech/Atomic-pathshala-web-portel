import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    if (!teacher) return apiError("Teacher profile not found", 403);

    const body = await request.json();
    const {
      presentationUrl,
      presentationName,
      presentationType,
      classroomTheme = "LIGHT",
      cameraShape = "SQUARE",
      cameraPosition = "UPPER_RIGHT",
    } = body;

    const sessionStart = schedule.startsAt ? new Date(schedule.startsAt) : new Date();
    const sessionEnd = schedule.endsAt ? new Date(schedule.endsAt) : new Date(Date.now() + 60 * 60 * 1000);

    const wbSession = await prisma.whiteboardSession.upsert({
      where: { batchScheduleId: params.scheduleId },
      update: {
        presentationUrl: presentationUrl || null,
        presentationName: presentationName || null,
        presentationType: presentationType || null,
        classroomTheme: classroomTheme === "DARK" ? "DARK" : "LIGHT",
        cameraShape: cameraShape === "CIRCULAR" ? "CIRCULAR" : "SQUARE",
        cameraPosition: cameraPosition || "UPPER_RIGHT",
        scheduledStart: sessionStart,
        scheduledEnd: sessionEnd,
      },
      create: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        status: "ACTIVE",
        livePhase: "PREPARING",
        presentationUrl: presentationUrl || null,
        presentationName: presentationName || null,
        presentationType: presentationType || null,
        classroomTheme: classroomTheme === "DARK" ? "DARK" : "LIGHT",
        cameraShape: cameraShape === "CIRCULAR" ? "CIRCULAR" : "SQUARE",
        cameraPosition: cameraPosition || "UPPER_RIGHT",
        scheduledStart: sessionStart,
        scheduledEnd: sessionEnd,
        pages: {
          create: {
            pageNumber: 1,
            objects: [],
          },
        },
      },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
      },
    });

    // Notify connected clients of updated pre-flight configuration
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        presentationUrl: wbSession.presentationUrl,
        presentationName: wbSession.presentationName,
        presentationType: wbSession.presentationType,
        classroomTheme: wbSession.classroomTheme,
        cameraShape: wbSession.cameraShape,
      });
    } catch (pushErr) {
      console.warn("Realtime config push warning:", pushErr);
    }

    return apiSuccess({
      message: "Pre-flight setup saved successfully.",
      whiteboardSession: wbSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
