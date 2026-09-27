import "server-only";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/rbac/guard";
import { resolveTeacherForSchedule } from "@/lib/batch/access";

/**
 * Per-class authorization for every teacher-side live-class control route
 * (start, end, extend, preflight, broadcast, map-youtube, stream-key).
 *
 * A generic permission like WHITEBOARD_ACCESS only says "this user is some
 * kind of teacher" — on its own it let any teacher END/MAP/MODIFY another
 * teacher's class just by changing the scheduleId in the URL. This resolves
 * the schedule the request actually targets and then applies the same rule
 * resolveTeacherForSchedule already uses elsewhere: the schedule's own
 * teacher, a teacher assigned to that batch, or an admin with BATCH_UPDATE.
 *
 * The route param has historically been accepted as a BatchSchedule id, a
 * WhiteboardSession id, or a Lecture id (see start/stream-key/broadcast), so
 * all three are resolved here — but authorization is always decided against
 * the one BatchSchedule they resolve to, never against the raw param.
 */
export async function resolveLiveClassScheduleId(idOrAlias: string): Promise<string | null> {
  const schedule = await prisma.batchSchedule.findUnique({ where: { id: idOrAlias }, select: { id: true } });
  if (schedule) return schedule.id;

  const wb = await prisma.whiteboardSession.findUnique({
    where: { id: idOrAlias },
    select: { batchScheduleId: true },
  });
  if (wb?.batchScheduleId) return wb.batchScheduleId;

  const byLecture = await prisma.batchSchedule.findFirst({
    where: { lectureId: idOrAlias },
    select: { id: true },
  });
  return byLecture?.id ?? null;
}

export async function assertCanControlLiveClass(userId: string, idOrAlias: string) {
  const scheduleId = await resolveLiveClassScheduleId(idOrAlias);
  if (!scheduleId) return { scheduleId: null, schedule: null, teacher: null } as const;

  const { schedule, teacher } = await resolveTeacherForSchedule(userId, scheduleId);
  if (!schedule) return { scheduleId: null, schedule: null, teacher: null } as const;
  if (!teacher) throw new ForbiddenError("You are not authorized to control this live class.");

  return { scheduleId, schedule, teacher } as const;
}
