import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { doubtCreateSchema } from "@/lib/validation/doubt";

/**
 * A student's own doubts — ownership-scoped, not RBAC-gated, same pattern
 * as `/api/batches/my` (a basic student action, not a team-portal
 * permission check).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const doubts = await prisma.doubt.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: {
        resolvedBy: { select: { name: true } },
        batchSchedule: { select: { id: true, title: true } },
      },
    });

    return apiSuccess({ doubts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const body = doubtCreateSchema.parse(await request.json());

    // A classroomSessionId is only ever trusted after confirming this
    // student actually has resolveClassroomAccess to that session — never
    // taken as-is from the request body.
    let classroomSessionId: string | null = null;
    if (body.classroomSessionId) {
      const { resolveClassroomAccess } = await import("@/lib/classroom/access");
      const access = await resolveClassroomAccess(session.user.id, body.classroomSessionId);
      if (access?.role === "STUDENT") classroomSessionId = body.classroomSessionId;
    }

    // Same rule for a recorded-class doubt: only link the schedule after
    // confirming the student can actually watch that batch's classes.
    let batchScheduleId: string | null = null;
    if (body.batchScheduleId) {
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: body.batchScheduleId },
        select: { id: true, batchId: true },
      });
      if (schedule) {
        const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
        const access = await resolveBatchAccess(session.user.id, schedule.batchId);
        if (
          access.status === "ACTIVE_ENROLLMENT" ||
          access.status === "ACTIVE_SUBSCRIPTION" ||
          access.status === "ADMIN_GRANTED"
        ) {
          batchScheduleId = schedule.id;
        }
      }
    }

    const doubt = await prisma.doubt.create({
      data: {
        studentId: student.id,
        subject: body.subject,
        body: body.body || (body.studentVoiceUrl ? "(Voice doubt)" : "(Photo doubt)"),
        priority: body.priority,
        attachmentUrl: body.attachmentUrl || null,
        classroomSessionId,
        batchScheduleId,
        videoTimestampSec: batchScheduleId ? body.videoTimestampSec ?? null : null,
        studentVoiceUrl: body.studentVoiceUrl || null,
        studentVoiceDurationSec: body.studentVoiceUrl ? body.studentVoiceDurationSec ?? null : null,
      },
    });

    return apiSuccess({ doubt }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
