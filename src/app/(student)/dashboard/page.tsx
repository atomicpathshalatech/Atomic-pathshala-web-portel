import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";
import { NextClassCountdown } from "@/components/student/NextClassCountdown";
import { FeatureCard } from "@/components/student/FeatureCard";

export const metadata: Metadata = {
  title: "Student Hub — Home",
};

type ScheduleWithTeacher = BatchSchedule & { teacher: (Teacher & { user: User }) | null };

function isToday(date: Date) {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export default async function StudentDashboardPage() {
  const { student } = await requireStudentSession();
  const now = new Date();

  // 1. Fetch active batch enrollments and schedules
  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: { select: { title: true } },
          teachers: { include: { teacher: { include: { user: true } } } },
          schedules: {
            where: { endsAt: { gte: now } },
            orderBy: { startsAt: "asc" },
            include: { teacher: { include: { user: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enrolledBatchIds = enrollments.map((e) => e.batch.id);
  const primaryBatchId = enrolledBatchIds[0] || null;

  const allUpcoming: ScheduleWithTeacher[] = enrollments
    .flatMap((e) => e.batch.schedules as ScheduleWithTeacher[])
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const nextClass = allUpcoming[0] ?? null;
  const FIFTEEN_MINS_MS = 15 * 60 * 1000;
  const isClassLive = nextClass
    ? nextClass.status === "LIVE" || (nextClass.startsAt <= now && nextClass.endsAt >= now)
    : false;
  const isWaitingRoomOpen = nextClass
    ? (nextClass.startsAt.getTime() - now.getTime()) <= FIFTEEN_MINS_MS && nextClass.endsAt >= now
    : false;
  const canJoinClass = isClassLive || isWaitingRoomOpen;

  // 2. Fetch real counts for feature badges (Zero fake data)
  const [
    dppCount,
    testsCount,
    mistakesCount,
    studentTestAttempts,
  ] = await Promise.all([
    // Today's or active DPP count
    prisma.batchSchedule.count({
      where: {
        batchId: { in: enrolledBatchIds },
        type: "DPP",
        endsAt: { gte: now },
      },
    }),
    // Available published tests in enrolled batches
    prisma.test.count({
      where: {
        batchSchedule: { batchId: { in: enrolledBatchIds } },
      },
    }),
    // Incorrect answers across all submitted attempts (Mistake Book)
    prisma.attemptAnswer.count({
      where: {
        attempt: {
          studentId: student.id,
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        },
        isCorrect: false,
      },
    }),
    // Student test attempts for accuracy calculation
    prisma.attempt.findMany({
      where: {
        studentId: student.id,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      select: { answers: { select: { isCorrect: true } } },
    }),
  ]);

  // Real overall accuracy
  const totalCorrect = studentTestAttempts.reduce(
    (sum, a) => sum + a.answers.filter((x) => x.isCorrect === true).length,
    0
  );
  const totalAttempted = studentTestAttempts.reduce(
    (sum, a) => sum + a.answers.filter((x) => x.isCorrect !== null).length,
    0
  );
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null;

  const firstName = (student.user.name || "Student").split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Welcome Strip Banner */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Targeting <span className="font-bold text-slate-800">{student.targetExam || "NEET"}</span>. Stay consistent and keep your study streak alive today.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Daily Goal: 3/5 Tasks</span>
          </span>
          <Link
            href={nextClass ? `/courses/${nextClass.batchId}` : "/schedule"}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span>Resume Learning</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Up Next / Live Spotlight */}
      {nextClass && (
        <section className="bg-white border border-blue-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  Next Scheduled Session &middot; {nextClass.type.replace("_", " ")}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {nextClass.title}
              </h2>
              {nextClass.teacher && (
                <p className="text-xs text-slate-500">
                  Instructor: <b>{nextClass.teacher.user.name}</b>
                </p>
              )}
              <div className="pt-0.5">
                <NextClassCountdown startsAtIso={nextClass.startsAt.toISOString()} />
              </div>
            </div>

            <Link
              href={nextClass.type === "LIVE_CLASS" ? `/live-class/${nextClass.id}` : "/schedule"}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all text-center self-start sm:self-auto shrink-0"
            >
              {isClassLive
                ? "Join Live Class Now"
                : isWaitingRoomOpen
                ? "Enter Waiting Room"
                : "View Classroom"}
            </Link>
          </div>
        </section>
      )}

      {/* SECTION 2 — LEARN */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            1. Learn &amp; Understand
          </h2>
          <p className="text-xs text-slate-500">
            Live lectures, comprehensive recordings, and structured study material.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
          <FeatureCard
            title="Live Classes"
            description="Join live classes and learn in real time"
            icon="videocam"
            theme="blue"
            href="/live-class"
            isLive={isClassLive}
            contextText={allUpcoming.length > 0 ? `${allUpcoming.length} upcoming` : "Daily Schedule"}
          />
          <FeatureCard
            title="Recorded Classes"
            description="Watch lectures anytime, at your own pace"
            icon="play_circle"
            theme="teal"
            href={primaryBatchId ? `/courses/${primaryBatchId}/subjects` : "/courses"}
            contextText={primaryBatchId ? "Physics, Chem & Bio" : `${enrollments.length} Batches Active`}
          />
          <FeatureCard
            title="Study Material"
            description="Notes, PDFs and essential study resources"
            icon="menu_book"
            theme="cyan"
            href="/rewards"
            contextText="Handbooks &amp; Notes"
          />
        </div>
      </section>

      {/* SECTION 3 — PRACTICE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            2. Daily Practice &amp; Revision
          </h2>
          <p className="text-xs text-slate-500">
            Targeted question solving, previous year questions, daily practice problems, and error analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          <FeatureCard
            title="Question Practice"
            description="Practice questions topic by topic"
            icon="edit_note"
            theme="orange"
            href="/practice"
            contextText="NEET &amp; NCERT Quiz"
          />
          <FeatureCard
            title="PYQ Practice"
            description="Practice previous year questions"
            icon="history_edu"
            theme="rose"
            href="/tests"
            contextText="NEET Archives"
          />
          <FeatureCard
            title="Daily DPP"
            description="Complete today's daily practice"
            icon="assignment"
            theme="red"
            href="/dpp"
            contextText={dppCount > 0 ? `${dppCount} Assigned` : "Daily Problems"}
          />
          <FeatureCard
            title="Mistake Book"
            description="Review questions you got wrong"
            icon="auto_fix_high"
            theme="amber"
            href="/mistakes"
            contextText={mistakesCount > 0 ? `${mistakesCount} to review` : "Mistakes Clean"}
          />
        </div>
      </section>

      {/* SECTION 4 — TEST & ANALYZE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            3. Test &amp; Analyze
          </h2>
          <p className="text-xs text-slate-500">
            Simulated test series, All India Rank diagnostics, and deep performance analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          <FeatureCard
            title="Atomic Test Series"
            description="Take tests and measure your preparation"
            icon="quiz"
            theme="green"
            href="/tests"
            contextText={testsCount > 0 ? `${testsCount} Mock Tests` : "Test Series"}
          />
          <FeatureCard
            title="My Performance"
            description="Track scores, accuracy and progress"
            icon="analytics"
            theme="indigo"
            href="/leaderboard"
            contextText={overallAccuracy !== null ? `${overallAccuracy}% Accuracy` : "AIR Leaderboard"}
          />
        </div>
      </section>

      {/* SECTION 5 — AI ASSISTANT (ATOMIC GURU) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            4. AI Concept &amp; Doubt Help
          </h2>
          <p className="text-xs text-slate-500">
            Instant step-by-step problem solver, conceptual explanation, and doubt escalation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
          <FeatureCard
            title="Atomic Guru"
            description="Ask doubts and understand concepts with AI"
            icon="psychology"
            theme="purple"
            href="/guru"
            contextText="Instant 24/7 AI Helper"
          />
        </div>
      </section>

      {/* Enrolled Batches Section */}
      {enrollments.length > 0 && (
        <section className="space-y-3 pt-3 border-t border-slate-200/80">
          <div className="flex justify-between items-center">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              My Enrolled Batches
            </h2>
            <Link href="/courses" className="text-xs font-bold text-orange-600 hover:underline">
              View All Batches &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrollments.map((e) => (
              <Link
                key={e.id}
                href={`/courses/${e.batch.id}`}
                className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 hover:border-slate-300 transition-all hover:shadow-2xs block"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-orange-500 text-lg">science</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                    {e.batch.code}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{e.batch.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {e.batch.course?.title ?? "Standard Curriculum"}
                </p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>{e.batch.teachers.length} Faculty</span>
                  <span className="text-orange-600 font-bold">Open Batch &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
