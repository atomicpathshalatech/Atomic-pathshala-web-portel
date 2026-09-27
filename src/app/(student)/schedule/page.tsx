import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { HorizontalScheduleCalendar, type ScheduleItem, type BatchOption } from "@/components/schedule/HorizontalScheduleCalendar";
import { reconcileRecordingStatus } from "@/lib/livekit/egress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "My Schedule",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { batch?: string; blocked?: string; reason?: string };
}) {
  const { student } = await requireStudentSession();
  const blockedReason = searchParams?.blocked === "1" ? searchParams?.reason || "That class isn't accessible right now." : null;

  const [enrollments, doubtBookings] = await Promise.all([
    prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      include: {
        batch: {
          include: {
            schedules: {
              orderBy: { startsAt: "asc" },
              include: {
                batch: true,
                teacher: { include: { user: true } },
                lecture: {
                  select: { id: true, videoUrl: true, chapterId: true },
                },
                liveWhiteboardSession: {
                  select: {
                    id: true,
                    status: true,
                    livePhase: true,
                    recordingStatus: true,
                    recordingStorageKey: true,
                    recordingEgressId: true,
                    pdfStatus: true,
                    pdfStorageKey: true,
                    presentationUrl: true,
                    youtubeArchiveVideoUrl: true,
                    youtubeVideoId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.doubtBooking.findMany({
      where: {
        studentId: student.id,
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      include: {
        slot: true,
        teacher: {
          include: {
            user: { select: { name: true, email: true, photoUrl: true } },
          },
        },
      },
      orderBy: { slot: { startTime: "asc" } },
    }),
  ]);

  if (enrollments.length === 0 && doubtBookings.length === 0) {
    return (
      <div className="max-w-6xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-10 shadow-sm">
        <header>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Schedule
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">
            Track your learning journey and classroom timetable.
          </p>
        </header>
        {blockedReason && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3 text-xs md:text-sm text-amber-800 dark:text-amber-200">
            <span className="material-symbols-outlined text-base mt-0.5">info</span>
            <p>{blockedReason}</p>
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs md:text-sm">
          You are not enrolled in a batch yet — once enrolled or after booking a 1:1 session, your live timetable, DPPs, tests, and doubt sessions will appear here.
        </div>
      </div>
    );
  }

  // Collect unique batches for filter
  const batches: BatchOption[] = enrollments.map((e) => ({
    id: e.batch.id,
    name: e.batch.name,
    code: e.batch.code,
  }));

  if (doubtBookings.length > 0) {
    batches.push({
      id: "doubt-sessions",
      name: "1:1 Doubt Sessions",
      code: "1:1",
    });
  }

  // Flatten all schedules WITHOUT filtering out past, completed or cancelled
  const flatSchedules = enrollments.flatMap((e) => e.batch.schedules);

  // Self-heal any recording whose egress_ended webhook never landed (see
  // reconcileRecordingStatus) before rendering - otherwise a missed webhook
  // leaves the student staring at "Recording in Process" indefinitely even
  // though the class ended and the recording finished processing long ago.
  await Promise.all(
    flatSchedules.map(async (s) => {
      if (!s.liveWhiteboardSession) return;
      const updated = await reconcileRecordingStatus(s.liveWhiteboardSession);
      if (updated) {
        s.liveWhiteboardSession.recordingStatus = updated.recordingStatus;
        s.liveWhiteboardSession.recordingStorageKey = updated.recordingStorageKey;
      }
    })
  );

  const batchScheduleItems: ScheduleItem[] = flatSchedules.map((s) => ({
    id: s.id,
    title: s.title,
    subject: s.subject,
    type: s.type,
    status: s.status,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    batchId: s.batchId,
    batch: {
      id: s.batch.id,
      name: s.batch.name,
      code: s.batch.code,
    },
    teacher: s.teacher
      ? {
          id: s.teacher.id,
          user: {
            name: s.teacher.user.name,
            email: s.teacher.user.email,
          },
        }
      : null,
    lectureId: s.lecture?.id || null,
    lectureVideoUrl: s.lecture?.videoUrl || null,
    liveWhiteboardSession: s.liveWhiteboardSession
      ? {
          id: s.liveWhiteboardSession.id,
          status: s.liveWhiteboardSession.status,
          livePhase: s.liveWhiteboardSession.livePhase,
          recordingStatus: s.liveWhiteboardSession.recordingStatus,
          recordingStorageKey: s.liveWhiteboardSession.recordingStorageKey,
          pdfStatus: s.liveWhiteboardSession.pdfStatus,
          pdfStorageKey: s.liveWhiteboardSession.pdfStorageKey,
          presentationUrl: s.liveWhiteboardSession.presentationUrl,
          youtubeArchiveVideoUrl: s.liveWhiteboardSession.youtubeArchiveVideoUrl,
          youtubeVideoId: s.liveWhiteboardSession.youtubeVideoId,
        }
      : null,
  }));

  const doubtScheduleItems: ScheduleItem[] = doubtBookings.map((b) => ({
    id: `doubt-booking-${b.id}`,
    title: `1:1 Doubt Session: ${b.teacher.user.name || "Atomic Faculty"}`,
    subject: "1:1 Doubt",
    type: "DOUBT_SESSION",
    status: b.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED",
    startsAt: b.slot.startTime.toISOString(),
    endsAt: b.slot.endTime.toISOString(),
    batchId: "doubt-sessions",
    batch: {
      id: "doubt-sessions",
      name: "1:1 Doubt Sessions",
      code: "1:1",
    },
    teacher: {
      id: b.teacher.id,
      user: {
        name: b.teacher.user.name,
        email: b.teacher.user.email,
      },
    },
    bookingId: b.id,
  }));

  const allSchedules: ScheduleItem[] = [...batchScheduleItems, ...doubtScheduleItems].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  return (
    <HorizontalScheduleCalendar
      schedules={allSchedules}
      batches={batches}
      role="STUDENT"
      title="My Schedule"
      subtitle={`${batches.length} Category${batches.length === 1 ? "" : "s"} • Live Classrooms, Tests & 1:1 Sessions`}
      blockedReason={blockedReason}
    />
  );
}
