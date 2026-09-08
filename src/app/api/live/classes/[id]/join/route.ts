import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createVideoAccessToken } from "@/lib/livekit/server";
import { canStudentJoinClass } from "@/lib/schedule/access-rules";

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

    let schedule = null;
    if (liveClass?.batchScheduleId) {
      schedule = await prisma.batchSchedule.findUnique({
        where: { id: liveClass.batchScheduleId },
        include: { liveWhiteboardSession: true },
      });
    } else {
      schedule = await prisma.batchSchedule.findUnique({
        where: { id: params.id },
        include: { liveWhiteboardSession: true },
      });
    }

    const now = new Date();

    if (!liveClass && schedule) {
      // Check if student is allowed to enter yet
      const evaluation = canStudentJoinClass(schedule, now);
      if (!evaluation.allowed) {
        return apiError(
          evaluation.reason || "Classroom access opens 15 minutes before scheduled start time.",
          403,
          {
            code: evaluation.code || "JOIN_TOO_EARLY",
            details: {
              opensAt: evaluation.opensAt.toISOString(),
              secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
              serverTime: now.toISOString(),
            },
          }
        );
      }

      // Lookup linked room
      liveClass = await prisma.liveClass.findUnique({
        where: { batchScheduleId: schedule.id },
      });

      if (!liveClass) {
        return apiError("Classroom is being prepared by teacher. Please try again in a few moments.", 409);
      }
    }

    if (!liveClass) {
      return apiError("Live class not found", 404);
    }

    const scheduleTarget = schedule ?? {
      id: liveClass.id,
      startsAt: liveClass.scheduledStart,
      endsAt: liveClass.scheduledEnd,
      status: liveClass.status,
    };

    const evaluation = canStudentJoinClass(scheduleTarget, now);
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Classroom access is not open yet.",
        403,
        {
          code: evaluation.code || "JOIN_TOO_EARLY",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
            serverTime: now.toISOString(),
          },
        }
      );
    }

    if (liveClass.status === "ENDED") {
      return apiError("This live class has already concluded.", 410);
    }

    // Verify student enrollment if linked to a batch
    if (liveClass.batchScheduleId) {
      const parentSchedule = schedule || await prisma.batchSchedule.findUnique({
        where: { id: liveClass.batchScheduleId },
      });

      if (parentSchedule && session.user.role === "STUDENT") {
        const student = await prisma.student.findUnique({
          where: { userId: session.user.id },
        });

        if (!student) return apiError("Student profile not found", 403);

        const enrollment = await prisma.batchEnrollment.findFirst({
          where: {
            batchId: parentSchedule.batchId,
            studentId: student.id,
            status: "ACTIVE",
          },
        });

        if (!enrollment) {
          return apiError("You are not enrolled in the batch for this live class.", 403, {
            code: "ENROLLMENT_REQUIRED",
          });
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
      serverTime: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
