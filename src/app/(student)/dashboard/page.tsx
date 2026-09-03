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
    <div className="space-y-10 max-w-7xl">
      {/* Welcome Strip Banner */}
      <section className="bg-gradient-to-r from-orange-50/90 via-white to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
        <div className="z-10 space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            You are targeting <span className="font-bold text-slate-900 dark:text-white">{student.targetExam || "NEET"}</span>. Stay consistent and keep your streak alive today.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-orange-100/70 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/60">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Daily Goal: 3/5 Tasks</span>
          </span>
          <Link
            href={nextClass ? `/courses/${nextClass.batchId}` : "/schedule"}
            className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-orange-500 dark:hover:bg-orange-600 rounded-xl shadow-md shadow-slate-900/10 transition-colors flex items-center gap-1.5"
          >
            <span>Resume Learning</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Up Next / Live Spotlight */}
      {nextClass && (
        <section className="glass-card rounded-2xl p-5 md:p-6 relative overflow-hidden bg-gradient-to-r from-blue-500/10 via-surface to-surface border border-blue-200/50 dark:border-blue-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Next Scheduled Session &middot; {nextClass.type.replace("_", " ")}
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                {nextClass.title}
              </h2>
              {nextClass.teacher && (
                <p className="text-xs text-on-surface-variant">
                  Instructor: <b>{nextClass.teacher.user.name}</b>
                </p>
              )}
              <div className="pt-1">
                <NextClassCountdown startsAtIso={nextClass.startsAt.toISOString()} />
              </div>
            </div>

            <Link
              href={nextClass.type === "LIVE_CLASS" ? `/live-class/${nextClass.id}` : "/schedule"}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all text-center self-start sm:self-auto shrink-0"
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              1. Learn &amp; Understand
            </h2>
            <p className="text-xs text-on-surface-variant">
              Live lectures, comprehensive recordings, and structured study material.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
            href="/courses"
            contextText={`${enrollments.length} Batches Active`}
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
      <section className="space-y-4">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            2. Daily Practice &amp; Revision
          </h2>
          <p className="text-xs text-on-surface-variant">
            Targeted question solving, previous year questions, daily practice problems, and error analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <FeatureCard
            title="Question Practice"
            description="Practice questions topic by topic"
            icon="edit_note"
            theme="orange"
            href="/practice"
            contextText="NEET, JEE & NCERT Quiz"
          />
          <FeatureCard
            title="PYQ Practice"
            description="Practice previous year questions"
            icon="history_edu"
            theme="rose"
            href="/tests"
            contextText="NEET &amp; JEE Archives"
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
      <section className="space-y-4">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            3. Test &amp; Analyze
          </h2>
          <p className="text-xs text-on-surface-variant">
            Simulated test series, All India Rank diagnostics, and deep performance analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          <FeatureCard
            title="Test Series"
            description="Take tests and measure your preparation"
            icon="quiz"
            theme="green"
            href="/tests"
            contextText={testsCount > 0 ? `${testsCount} Mock Tests` : "Mock Tests"}
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
      <section className="space-y-4">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            4. AI Concept &amp; Doubt Help
          </h2>
          <p className="text-xs text-on-surface-variant">
            Instant step-by-step problem solver, conceptual explanation, and doubt escalation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-5">
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
        <section className="space-y-4 pt-4 border-t border-outline-variant/20">
          <div className="flex justify-between items-center">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              My Enrolled Batches
            </h2>
            <Link href="/courses" className="text-xs font-semibold text-primary hover:underline">
              View All Courses &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((e) => (
              <Link
                key={e.id}
                href={`/courses/${e.batch.id}`}
                className="glass-card rounded-2xl p-5 border border-outline-variant/30 hover:border-primary/50 transition-all hover:shadow-md block"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-xl">science</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {e.batch.code}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-on-surface line-clamp-1">{e.batch.name}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  {e.batch.course?.title ?? "Standard Curriculum"}
                </p>
                <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{e.batch.teachers.length} Faculty</span>
                  <span className="text-primary font-semibold">Open Batch &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
