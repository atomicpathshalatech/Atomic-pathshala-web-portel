import "server-only";
import { prisma } from "@/lib/db";
import { ForbiddenError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Per-class authorization for every teacher-side live-class control route
 * (enter room, start, end, extend, preflight, broadcast, map-youtube,
 * stream-key).
 *
 * A generic permission like WHITEBOARD_ACCESS only says "this user is some
 * kind of teacher" — on its own it let any teacher END/MAP/MODIFY another
 * teacher's class just by changing the scheduleId in the URL.
 *
 * Who controls a class (decision D5):
 *   - the teacher assigned on the schedule (BatchSchedule.teacherId);
 *   - when the schedule names no teacher, the batch's assigned teachers;
 *   - anyone holding LIVE_CLASS_ADMIN (admins / academic heads).
 * A batch co-teacher does NOT control a class another teacher is assigned to.
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

type ControlDecision = { allowed: boolean; viaAdmin: boolean; ownTeacherId: string | null };

/** The D5 rule for one already-resolved schedule. */
export async function decideLiveClassControl(
  userId: string,
  schedule: { teacherId: string | null; batchId: string }
): Promise<ControlDecision> {
  const ownTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });

  if (ownTeacher) {
    if (schedule.teacherId) {
      if (schedule.teacherId === ownTeacher.id) return { allowed: true, viaAdmin: false, ownTeacherId: ownTeacher.id };
    } else {
      const batchTeacher = await prisma.batchTeacher.findFirst({
        where: { batchId: schedule.batchId, teacherId: ownTeacher.id },
        select: { id: true },
      });
      if (batchTeacher) return { allowed: true, viaAdmin: false, ownTeacherId: ownTeacher.id };
    }
  }

  if (await hasPermission(userId, PERMISSIONS.LIVE_CLASS_ADMIN)) {
    return { allowed: true, viaAdmin: true, ownTeacherId: ownTeacher?.id ?? null };
  }
  return { allowed: false, viaAdmin: false, ownTeacherId: ownTeacher?.id ?? null };
}

/**
 * The Teacher row a class runs under. The assigned teacher's own row when
 * they act; for an admin acting on someone else's class, the schedule's
 * teacher (or a batch teacher), falling back to an admin instructor profile
 * so an admin can still run an unassigned class.
 */
async function resolveActingTeacher(
  userId: string,
  schedule: { teacherId: string | null; batchId: string },
  decision: ControlDecision
) {
  if (!decision.viaAdmin && decision.ownTeacherId) {
    return prisma.teacher.findUnique({ where: { id: decision.ownTeacherId } });
  }
  if (schedule.teacherId) {
    const assigned = await prisma.teacher.findUnique({ where: { id: schedule.teacherId } });
    if (assigned) return assigned;
  }
  if (decision.ownTeacherId) return prisma.teacher.findUnique({ where: { id: decision.ownTeacherId } });

  const batchTeacher = await prisma.batchTeacher.findFirst({ where: { batchId: schedule.batchId }, select: { teacherId: true } });
  if (batchTeacher) return prisma.teacher.findUnique({ where: { id: batchTeacher.teacherId } });

  // Same admin-instructor profile the older resolveTeacherForSchedule path creates.
  const code = Date.now().toString().slice(-6);
  return prisma.teacher.create({
    data: {
      userId,
      employeeCode: `ADM-INST-${code}`,
      department: "Academic Operations",
      subjects: ["General", "All Subjects"],
      bio: "Academic Administrator and Instructor",
    },
  });
}

export async function assertCanControlLiveClass(userId: string, idOrAlias: string) {
  const scheduleId = await resolveLiveClassScheduleId(idOrAlias);
  if (!scheduleId) return { scheduleId: null, schedule: null, teacher: null, viaAdmin: false } as const;

  const schedule = await prisma.batchSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return { scheduleId: null, schedule: null, teacher: null, viaAdmin: false } as const;

  const decision = await decideLiveClassControl(userId, schedule);
  if (!decision.allowed) throw new ForbiddenError("You are not authorized to control this live class.");

  const teacher = await resolveActingTeacher(userId, schedule, decision);
  if (!teacher) throw new ForbiddenError("Teacher profile could not be resolved for this live class.");

  return { scheduleId, schedule, teacher, viaAdmin: decision.viaAdmin } as const;
}

/**
 * For routes that accept a Lecture id and upsert a BatchSchedule from it:
 * decide control against the lecture's own teacher BEFORE any schedule row
 * is created or changed, so a non-owner can't even trigger that write.
 */
export async function assertCanControlLecture(userId: string, lecture: { teacherId: string | null }) {
  const decision = await decideLiveClassControl(userId, { teacherId: lecture.teacherId, batchId: "" });
  if (!decision.allowed) throw new ForbiddenError("You are not authorized to control this live class.");
}
