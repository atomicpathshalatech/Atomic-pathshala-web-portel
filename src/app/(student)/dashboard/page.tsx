import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";
import { NextClassCard } from "@/components/student/NextClassCard";
import { getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { SectionHeader } from "@/components/student/home/SectionHeader";
import { ProgressCard } from "@/components/student/home/ProgressCard";
import { QuickAccessGrid, type QuickAccessItem } from "@/components/student/home/QuickAccessGrid";
import { ContinueLearningCard } from "@/components/student/home/ContinueLearningCard";
import { RecommendedCourses } from "@/components/student/home/RecommendedCourses";
import { PromoCard } from "@/components/student/home/PromoCard";

export const metadata: Metadata = {
  title: "Home",
};

type ScheduleWithTeacher = BatchSchedule & { teacher: (Teacher & { user: User }) | null };

export default async function StudentDashboardPage() {
  const { student } = await requireStudentSession();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: { select: { title: true } },
          teachers: { select: { id: true } },
          schedules: {
            where: { endsAt: { gte: now }, isTest: false },
            orderBy: { startsAt: "asc" },
            include: { teacher: { include: { user: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enrolledBatchIds = enrollments.map((e) => e.batch.id);
  const primaryBatch = enrollments[0]?.batch ?? null;

  const allUpcoming: ScheduleWithTeacher[] = enrollments
    .flatMap((e) => e.batch.schedules as ScheduleWithTeacher[])
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const nextClass = allUpcoming[0] ?? null;

  const nextClassStatus =
    nextClass && nextClass.type === "LIVE_CLASS"
      ? getEffectiveScheduleStatus(
          {
            id: nextClass.id,
            startsAt: nextClass.startsAt,
            endsAt: nextClass.endsAt,
            status: nextClass.status,
            type: nextClass.type,
          },
          now
        )
      : null;
  const showNextClass =
    !!nextClass &&
    (nextClass.type !== "LIVE_CLASS" ||
      (nextClassStatus !== "COMPLETED" &&
        nextClassStatus !== "CANCELLED" &&
        nextClassStatus !== "NOT_CONDUCTED"));

  const [
    dppCount,
    testsCount,
    mistakesCount,
    downloadsCount,
    doubtsOpenCount,
    todayScheduleCount,
    attendedToday,
    attemptsToday,
    recentLecture,
    recommendedRaw,
  ] = await Promise.all([
    prisma.batchSchedule.count({
      where: { batchId: { in: enrolledBatchIds }, type: "DPP", endsAt: { gte: now } },
    }),
    prisma.test.count({ where: { batchSchedule: { batchId: { in: enrolledBatchIds } } } }),
    prisma.attemptAnswer.count({
      where: {
        attempt: { studentId: student.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
        isCorrect: false,
      },
    }),
    prisma.studyMaterial
      .count({ where: { isPublished: true, allowDownload: true } })
      .catch(() => 0),
    prisma.doubt
      .count({ where: { studentId: student.id, status: { in: ["OPEN", "ASSIGNED"] } } })
      .catch(() => 0),
    prisma.batchSchedule.count({
      where: {
        batchId: { in: enrolledBatchIds },
        isTest: false,
        startsAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.liveClassAttendance.count({
      where: { studentId: student.id, joinedAt: { gte: startOfToday, lt: endOfToday } },
    }),
    prisma.attempt.count({
      where: {
        studentId: student.id,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        submittedAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.lectureProgress.findFirst({
      where: { studentId: student.id },
      orderBy: { completedAt: "desc" },
      include: {
        lecture: { include: { chapter: { include: { subject: { select: { title: true } } } } } },
      },
    }),
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] }, id: { notIn: enrolledBatchIds } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, code: true, targetExam: true, course: { select: { title: true } } },
    }),
  ]);

  const firstName = (student.user.name || "Student").split(" ")[0] || "Student";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const targetExam = student.targetExam || "NEET";

  const todayDone = Math.min(attendedToday + attemptsToday, todayScheduleCount);

  // "Continue learning" — real last-completed lecture, else the primary batch.
  const continueItem = recentLecture?.lecture
    ? {
        id: recentLecture.lecture.id,
        primary: recentLecture.lecture.chapter?.subject?.title || "Lectures",
        secondary: recentLecture.lecture.chapter?.title || recentLecture.lecture.title,
        meta: null,
        href: `/watch/${recentLecture.lecture.id}`,
        icon: "play_circle",
      }
    : primaryBatch
    ? {
        id: primaryBatch.id,
        primary: primaryBatch.name,
        secondary: primaryBatch.course?.title || "Your batch",
        meta: `${primaryBatch.teachers.length} faculty`,
        href: `/courses/${primaryBatch.id}`,
        icon: "school",
      }
    : null;

  const continueHref = continueItem?.href ?? (nextClass ? `/courses/${nextClass.batchId}` : "/courses");

  const quickAccess: QuickAccessItem[] = [
    { label: "My Batches", icon: "school", href: "/courses", accent: "blue", badge: enrollments.length ? `${enrollments.length}` : null },
    { label: "My Tests", icon: "quiz", href: "/tests", accent: "violet", badge: testsCount ? `${testsCount}` : null },
    { label: "Daily DPP", icon: "assignment", href: "/dpp", accent: "rose", badge: dppCount ? `${dppCount}` : null },
    { label: "My Doubts", icon: "help", href: "/doubts", accent: "orange", badge: doubtsOpenCount ? `${doubtsOpenCount}` : null },
    { label: "Performance", icon: "insights", href: "/leaderboard", accent: "emerald", badge: null },
    { label: "Study PDFs", icon: "menu_book", href: "/study-material", accent: "teal", badge: null },
    { label: "Mistake Book", icon: "auto_fix_high", href: "/mistakes", accent: "indigo", badge: mistakesCount ? `${mistakesCount}` : null },
    { label: "AI Guru", icon: "smart_toy", href: "/guru", accent: "amber", badge: null },
  ];

  const recommended = recommendedRaw.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    targetExam: b.targetExam,
    courseTitle: b.course?.title ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-2 lg:max-w-5xl">
      {/* Goal / batch context — one compact line */}
      {primaryBatch && (
        <Link
          href={`/courses/${primaryBatch.id}`}
          className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5"
        >
          <span className="material-symbols-outlined text-[20px] text-blue-600">workspace_premium</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">{primaryBatch.name}</p>
            <p className="truncate text-[11px] text-slate-500">
              Current goal · {targetExam}
              {enrollments.length > 1 ? ` · ${enrollments.length} batches` : ""}
            </p>
          </div>
          <span className="material-symbols-outlined text-slate-300">chevron_right</span>
        </Link>
      )}

      <ProgressCard
        greeting={greeting}
        firstName={firstName}
        targetExam={targetExam}
        streakDays={student.currentStreakDays}
        todayDone={todayDone}
        todayTotal={todayScheduleCount}
        continueHref={continueHref}
        continueLabel={continueItem ? "Continue learning" : "Explore courses"}
      />

      <section className="space-y-2.5">
        <SectionHeader title="Quick access" />
        <QuickAccessGrid items={quickAccess} />
      </section>

      {continueItem && (
        <section className="space-y-2.5">
          <SectionHeader title="Continue learning" href={continueItem.href} linkLabel="Open" />
          <ContinueLearningCard item={continueItem} />
        </section>
      )}

      <section className="space-y-2.5">
        <SectionHeader
          title={nextClassStatus === "LIVE" ? "Live now" : "Next class"}
          href="/schedule"
          linkLabel="Schedule"
        />
        {showNextClass && nextClass ? (
          <NextClassCard
            scheduleId={nextClass.id}
            type={nextClass.type}
            title={nextClass.title}
            teacherName={nextClass.teacher?.user.name ?? null}
            startsAtIso={nextClass.startsAt.toISOString()}
            initialStatus={nextClassStatus ?? "SCHEDULED"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center">
            <p className="text-[13px] font-medium text-slate-500">No upcoming classes</p>
            <Link href="/schedule" className="mt-1 inline-block text-xs font-semibold text-blue-600">
              View full schedule
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionHeader title="Practice &amp; revise" />
        <QuickAccessGrid
          items={[
            { label: "Question Practice", icon: "edit_note", href: "/practice", accent: "violet", badge: null },
            { label: "PYQ Practice", icon: "history_edu", href: "/tests", accent: "blue", badge: null },
            { label: "Daily DPP", icon: "assignment", href: "/dpp", accent: "rose", badge: dppCount ? `${dppCount}` : null },
            { label: "Downloads", icon: "download", href: "/study-material", accent: "indigo", badge: downloadsCount ? `${downloadsCount}` : null },
          ]}
        />
      </section>

      {recommended.length > 0 && (
        <section className="space-y-2.5">
          <SectionHeader title="Recommended for you" href="/courses" />
          <RecommendedCourses courses={recommended} />
        </section>
      )}

      {student.subscription?.status !== "ACTIVE" && <PromoCard />}
    </div>
  );
}
