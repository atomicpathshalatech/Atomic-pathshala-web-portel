import "server-only";
import { prisma } from "@/lib/db";

export const TEST_BATCH_CODE = "WB-TEST-LAB";

/**
 * Whiteboard Test Lab — an always-open practice classroom for an Admin or
 * Teacher that runs the *real* live-class engine (TeacherLiveClassRoom /
 * StudentLiveClassRoom / the /api/whiteboard/sessions/* routes / Pusher)
 * without scheduling a class, assigning a batch, or inviting students.
 *
 * Find-or-create, idempotent per user:
 *   1. a Teacher row (auto-provisioned for Admins who don't have one),
 *   2. one shared hidden ARCHIVED batch to satisfy the required FK,
 *   3. an `isTest` BatchSchedule for this teacher,
 *   4. its `isTest` WhiteboardSession, already in the LIVE phase.
 *
 * `isTest` rows are excluded from student "next class" feeds,
 * /team/my-schedule, attendance and analytics.
 */
export async function getOrCreateTestLab(userId: string) {
  // 1 — Teacher row (auto-provision for non-teacher admins)
  let teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    teacher = await prisma.teacher.create({
      data: {
        userId,
        employeeCode: `WBTEST-${userId.slice(0, 10)}`,
        department: "Whiteboard Test Lab",
        subjects: [],
        bio: `Auto-created so ${user?.name ?? "this admin"} can use the Whiteboard Test Lab.`,
        onboardingStatus: "ACTIVE",
      },
    });
  }

  // 2 — shared hidden batch (ARCHIVED keeps it out of the course catalogue
  // and every "active/upcoming batches" list)
  let batch = await prisma.batch.findUnique({ where: { code: TEST_BATCH_CODE } });
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        code: TEST_BATCH_CODE,
        name: "Whiteboard Test Lab",
        description: "Internal — backs the Whiteboard Test Lab. Not a real batch.",
        status: "ARCHIVED",
        createdById: userId,
      },
    });
  }

  // 3 — the teacher's test schedule
  const farPast = new Date("2020-01-01T00:00:00.000Z");
  const farFuture = new Date("2400-01-01T00:00:00.000Z");
  let schedule = await prisma.batchSchedule.findFirst({
    where: { isTest: true, teacherId: teacher.id, batchId: batch.id },
  });
  if (!schedule) {
    schedule = await prisma.batchSchedule.create({
      data: {
        batchId: batch.id,
        teacherId: teacher.id,
        title: "Whiteboard Test Lab",
        type: "LIVE_CLASS",
        status: "LIVE",
        isTest: true,
        startsAt: farPast,
        endsAt: farFuture,
        createdById: userId,
      },
    });
  } else if (schedule.status !== "LIVE") {
    // The Test Lab is an always-open practice room. If a previous "End
    // Class" moved the schedule to COMPLETED/CANCELLED, canTeacherEnterClass
    // would then reject every re-entry with "This live class has already
    // concluded." Put it back to LIVE.
    schedule = await prisma.batchSchedule.update({
      where: { id: schedule.id },
      data: { status: "LIVE", startsAt: farPast, endsAt: farFuture },
    });
  }

  // 4 — its whiteboard session, already LIVE so the room opens straight in.
  // Page 1 is created up front (same as POST /api/whiteboard/sessions) —
  // without it the canvas has no active page and the room falls back to the
  // pre-flight wizard.
  const now = new Date();
  let wb = await prisma.whiteboardSession.findUnique({
    where: { batchScheduleId: schedule.id },
    include: { pages: true },
  });
  if (!wb) {
    wb = await prisma.whiteboardSession.create({
      data: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: "Whiteboard Test Lab",
        status: "ACTIVE",
        isTest: true,
        livePhase: "LIVE",
        startedAt: now,
        actualStartedAt: now,
        scheduledStart: farPast,
        scheduledEnd: farFuture,
        pages: { create: { pageNumber: 1, objects: [] } },
      },
      include: { pages: true },
    });
  } else {
    // Heal an earlier test session that was ended (manual "End Class" or the
    // lazy auto-end): reopen it so the room starts straight into LIVE again
    // instead of showing "This live class has already concluded."
    const needsReopen =
      wb.status !== "ACTIVE" || wb.livePhase !== "LIVE" || wb.endedAt !== null;
    if (needsReopen) {
      wb = await prisma.whiteboardSession.update({
        where: { id: wb.id },
        data: {
          status: "ACTIVE",
          livePhase: "LIVE",
          endedAt: null,
          actualEndedAt: null,
          actualStartedAt: wb.actualStartedAt ?? now,
        },
        include: { pages: true },
      });
    }
    if (wb.pages.length === 0) {
      await prisma.whiteboardPage.create({
        data: { sessionId: wb.id, pageNumber: 1, objects: [] },
      });
    }
  }

  return { scheduleId: schedule.id, whiteboardSessionId: wb.id, teacherId: teacher.id };
}
