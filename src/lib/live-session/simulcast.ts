import "server-only";
import { prisma } from "@/lib/db";
import { OPEN_STATES } from "@/lib/live-session/states";

/**
 * Simulcast groups (decision D4): several batch schedules deliberately
 * taught as ONE live class. Membership is explicit — an admin creates the
 * group — never inferred from a shared lectureId. Every member schedule has
 * its own LiveSession occurrence (its own lifecycle state), all pointing at
 * the same group; exactly one member's WhiteboardSession is the room
 * everyone watches (the "primary": whichever member's teacher started).
 */

export class SimulcastGroupError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "SimulcastGroupError";
  }
}

const GROUP_START_TOLERANCE_MS = 15 * 60_000;

/**
 * Creates a group from ≥2 LIVE_CLASS schedules that start together and share
 * a teacher. Each gets an open, not-yet-live occurrence tagged with the group.
 */
export async function createSimulcastGroup(input: { scheduleIds: string[]; createdById: string; note?: string }) {
  const ids = Array.from(new Set(input.scheduleIds));
  if (ids.length < 2) throw new SimulcastGroupError("A simulcast group needs at least two schedules.");

  const schedules = await prisma.batchSchedule.findMany({
    where: { id: { in: ids } },
    include: { liveWhiteboardSession: { select: { id: true, videoTransport: true } } },
  });
  if (schedules.length !== ids.length) throw new SimulcastGroupError("One or more schedules were not found.", 404);
  if (schedules.some((s) => s.type !== "LIVE_CLASS")) throw new SimulcastGroupError("Only Live Class schedules can be grouped.");

  const first = schedules[0]!;
  if (schedules.some((s) => Math.abs(s.startsAt.getTime() - first.startsAt.getTime()) > GROUP_START_TOLERANCE_MS)) {
    throw new SimulcastGroupError("Grouped schedules must start within 15 minutes of each other.");
  }
  const teacherIds = new Set(schedules.map((s) => s.teacherId).filter(Boolean));
  if (teacherIds.size > 1) throw new SimulcastGroupError("Grouped schedules must have the same assigned teacher.");
  const teacherId =
    [...teacherIds][0] ??
    (await prisma.batchTeacher.findFirst({ where: { batchId: first.batchId }, select: { teacherId: true } }))?.teacherId;
  if (!teacherId) throw new SimulcastGroupError("Assign a teacher to these schedules before grouping them.");

  const open = await prisma.liveSession.findMany({
    where: { batchScheduleId: { in: ids }, state: { in: [...OPEN_STATES] } },
  });
  const blocked = open.find((s) => s.simulcastGroupId || !["SCHEDULED", "READY"].includes(s.state));
  if (blocked) {
    throw new SimulcastGroupError("A schedule is already grouped or its class has already started.", 409);
  }

  return prisma.$transaction(async (tx) => {
    const group = await tx.simulcastGroup.create({ data: { createdById: input.createdById, note: input.note ?? null } });
    for (const schedule of schedules) {
      const existingOpen = open.find((s) => s.batchScheduleId === schedule.id);
      if (existingOpen) {
        await tx.liveSession.update({ where: { id: existingOpen.id }, data: { simulcastGroupId: group.id } });
        continue;
      }
      const latest = await tx.liveSession.findFirst({
        where: { batchScheduleId: schedule.id },
        orderBy: { occurrence: "desc" },
        select: { occurrence: true },
      });
      await tx.liveSession.create({
        data: {
          batchScheduleId: schedule.id,
          occurrence: (latest?.occurrence ?? 0) + 1,
          // Delivery is decided when the primary starts; until then these
          // members carry no video of their own.
          deliveryMode: "LEGACY_LIVEKIT",
          youtubeChannel: null,
          state: "SCHEDULED",
          controllingTeacherId: schedule.teacherId ?? teacherId,
          plannedStartsAt: schedule.startsAt,
          effectiveEndsAt:
            schedule.endsAt.getTime() > schedule.startsAt.getTime()
              ? schedule.endsAt
              : new Date(schedule.startsAt.getTime() + 60 * 60_000),
          simulcastGroupId: group.id,
        },
      });
    }
    return group;
  });
}

/** Dissolves a group whose class hasn't started. */
export async function deleteSimulcastGroup(groupId: string) {
  const members = await prisma.liveSession.findMany({ where: { simulcastGroupId: groupId } });
  if (members.some((m) => !["SCHEDULED", "READY", "CANCELLED"].includes(m.state))) {
    throw new SimulcastGroupError("This group's class has already started; it can't be dissolved now.", 409);
  }
  await prisma.$transaction([
    prisma.liveSession.updateMany({ where: { simulcastGroupId: groupId }, data: { simulcastGroupId: null } }),
    prisma.simulcastGroup.delete({ where: { id: groupId } }),
  ]);
}

/**
 * The WhiteboardSession a grouped schedule's students should watch: the
 * group member that is running the room (has a whiteboard session and is
 * live, or else the most recently started one). Null when the schedule
 * isn't grouped or nobody has started yet.
 */
export async function resolveGroupWhiteboardSessionId(batchScheduleId: string): Promise<string | null> {
  const own = await prisma.liveSession.findFirst({
    where: { batchScheduleId, state: { in: [...OPEN_STATES] }, simulcastGroupId: { not: null } },
    select: { simulcastGroupId: true },
  });
  if (!own?.simulcastGroupId) return null;
  const primary = await prisma.liveSession.findFirst({
    where: { simulcastGroupId: own.simulcastGroupId, whiteboardSessionId: { not: null } },
    orderBy: [{ actualStartedAt: { sort: "desc", nulls: "last" } }],
    select: { whiteboardSessionId: true },
  });
  return primary?.whiteboardSessionId ?? null;
}

/**
 * Before a grouped schedule starts its own room: if another member of the
 * same group already runs the room, return that member's schedule id so the
 * caller can refuse (one group = one room). Null means this schedule may start.
 */
export async function groupRoomRunByAnotherSchedule(batchScheduleId: string): Promise<string | null> {
  const own = await prisma.liveSession.findFirst({
    where: { batchScheduleId, state: { in: [...OPEN_STATES] }, simulcastGroupId: { not: null } },
    select: { simulcastGroupId: true },
  });
  if (!own?.simulcastGroupId) return null;
  const other = await prisma.liveSession.findFirst({
    where: {
      simulcastGroupId: own.simulcastGroupId,
      batchScheduleId: { not: batchScheduleId },
      whiteboardSessionId: { not: null },
      state: { in: ["STARTING", "YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE", "LIVE", "ENDING"] },
    },
    select: { batchScheduleId: true },
  });
  return other?.batchScheduleId ?? null;
}

/** Batch ids of every schedule in the simulcast group(s) a whiteboard session is serving. */
export async function groupBatchIdsForWhiteboardSession(whiteboardSessionId: string): Promise<string[]> {
  const grouped = await prisma.liveSession.findMany({
    where: { whiteboardSessionId, simulcastGroupId: { not: null } },
    select: { simulcastGroupId: true },
  });
  const groupIds = [...new Set(grouped.map((g) => g.simulcastGroupId!))];
  if (groupIds.length === 0) return [];
  const members = await prisma.liveSession.findMany({
    where: { simulcastGroupId: { in: groupIds } },
    select: { batchSchedule: { select: { batchId: true } } },
  });
  return [...new Set(members.map((m) => m.batchSchedule.batchId))];
}
