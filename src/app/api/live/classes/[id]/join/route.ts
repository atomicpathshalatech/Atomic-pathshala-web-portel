import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createVideoAccessToken } from "@/lib/livekit/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    // Lookup LiveClass by ID or batchScheduleId
    let liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });

    if (!liveClass) {
      liveClass = await prisma.liveClass.findUnique({
        where: { batchScheduleId: params.id },
      });
    }

    if (!liveClass) {
      // Check if it exists as BatchSchedule
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: params.id },
      });
      if (!schedule) return apiError("Live class not found", 404);

      // Verify T-15 start window
      const opensAt = new Date(schedule.startsAt.getTime() - 15 * 60 * 1000);
      if (Date.now() < opensAt.getTime()) {
        return apiError("Classroom access opens 15 minutes before scheduled start time.", 403, {
          code: "JOIN_WINDOW_NOT_OPEN",
          details: { opensAt: opensAt.toISOString() },
        });
      }

      // Lookup linked room
      liveClass = await prisma.liveClass.findUnique({
        where: { batchScheduleId: schedule.id },
      });

      if (!liveClass) {
        return apiError("Classroom is being prepared by teacher. Please try again in a few moments.", 409);
      }
    }

    if (liveClass.status === "ENDED") {
      return apiError("This live class has already concluded.", 410);
    }

    // Verify student enrollment if linked to a batch
    if (liveClass.batchScheduleId) {
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: liveClass.batchScheduleId },
      });

      if (schedule && session.user.role === "STUDENT") {
        const student = await prisma.student.findUnique({
          where: { userId: session.user.id },
        });

        if (!student) return apiError("Student profile not found", 403);

        const enrollment = await prisma.batchEnrollment.findFirst({
          where: {
            batchId: schedule.batchId,
            studentId: student.id,
            status: "ACTIVE",
          },
        });

        if (!enrollment) {
          return apiError("You are not enrolled in the batch for this live class.", 403);
        }
      }
    }

    // Generate short-lived LiveKit token for student
    const token = await createVideoAccessToken({
      identity: session.user.id,
      name: session.user.name || "Student",
      roomName: liveClass.roomName,
    });

    return apiSuccess({
      liveClassId: liveClass.id,
      roomName: liveClass.roomName,
      status: liveClass.status,
      token,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
