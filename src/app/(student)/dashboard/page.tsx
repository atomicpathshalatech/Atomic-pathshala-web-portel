import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";
import { getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { SectionHeader } from "@/components/student/home/SectionHeader";
import { ProgressCard, type NextEventInfo } from "@/components/student/home/ProgressCard";
import { QuickAccessGrid, type QuickAccessItem } from "@/components/student/home/QuickAccessGrid";
import { RecommendedCourses } from "@/components/student/home/RecommendedCourses";
import { PromoCard } from "@/components/student/home/PromoCard";
import { StudentBannerCarousel, type StudentBanner } from "@/components/student/home/StudentBannerCarousel";
import { EducatorsShowcase, type EducatorItem } from "@/components/student/home/EducatorsShowcase";
import { StudentFeedbackSection, type StudentFeedbackItem } from "@/components/student/home/StudentFeedbackSection";
import { UpcomingTestCard, type UpcomingTestItem } from "@/components/student/home/UpcomingTestCard";

export const metadata: Metadata = {
  title: "Home — Atomic Pathshala",
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
    bannersDb,
    teachersDb,
    testimonialsDb,
    upcomingTestsDb,
  ] = await Promise.all([
    prisma.batchSchedule.count({
      where: { batchId: { in: enrolledBatchIds }, type: "DPP", endsAt: { gte: now } },
    }),
    prisma.test.count({
      where: {
        archived: false,
        status: { in: ["PUBLISHED", "DRAFT", "APPROVED"] },
        OR: [
          { batchSchedule: { batchId: { in: enrolledBatchIds } } },
          { testSeries: { isNot: null } },
        ],
      },
    }),
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
    prisma.banner.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ priority: "desc" }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        ctaUrl: true,
        ctaText: true,
        openInNewTab: true,
      },
    }).catch(() => []),
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        user: {
          status: "ACTIVE",
          role: {
            name: { in: ["TEACHER", "ACADEMIC_HEAD", "DEPARTMENT_HEAD", "SUPER_ADMIN", "ADMIN", "FOUNDER"] },
          },
        },
      },
      include: { user: { select: { name: true, photoUrl: true } } },
      orderBy: { createdAt: "asc" },
      take: 12,
    }).catch(() => []),
    prisma.testimonial.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).catch(() => []),
    prisma.test.findMany({
      where: {
        archived: false,
        status: { in: ["PUBLISHED", "DRAFT", "APPROVED"] },
        OR: [
          { batchSchedule: { batchId: { in: enrolledBatchIds } } },
          { testSeries: { isNot: null } },
        ],
        AND: [
          {
            OR: [
              { openTime: { gte: now } },
              { closeTime: { gte: now } },
              { batchSchedule: { endsAt: { gte: now } } },
              { status: "DRAFT" },
            ],
          },
        ],
      },
      include: {
        batchSchedule: { select: { startsAt: true, endsAt: true, title: true } },
        testSeries: { select: { id: true, name: true, examType: true } },
        sections: {
          select: {
            id: true,
            targetCount: true,
            marksPerQuestion: true,
            _count: { select: { questions: true } },
          },
        },
        attempts: { where: { studentId: student.id }, select: { id: true, status: true } },
      },
      orderBy: [{ openTime: "asc" }, { createdAt: "desc" }],
      take: 6,
    }).catch(() => []),
  ]);

  const firstName = (student.user.name || "Student").split(" ")[0] || "Student";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const targetExam = student.targetExam || "NEET";

  const todayDone = Math.min(attendedToday + attemptsToday, todayScheduleCount);

  // Continue learning link
  const continueHref = recentLecture?.lecture
    ? `/watch/${recentLecture.lecture.id}`
    : primaryBatch
    ? `/courses/${primaryBatch.id}`
    : nextClass
    ? `/courses/${nextClass.batchId}`
    : "/courses";

  // Process Upcoming Tests for student
  const pendingUpcomingTests = upcomingTestsDb.filter(
    (t: any) => !t.attempts?.some((a: any) => a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED")
  );
  const primaryUpcomingTest = pendingUpcomingTests[0] ?? null;

  let upcomingTestCard: UpcomingTestItem | null = null;
  if (primaryUpcomingTest) {
    const t: any = primaryUpcomingTest;
    const assignedCount =
      t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 0;
    const targetCount =
      t.sections?.reduce((sum: number, s: any) => sum + (s.targetCount || 0), 0) || 0;
    const defaultCount = (t.examType || t.testSeries?.examType || "").toUpperCase().includes("JEE") ? 75 : 180;
    const qCount = targetCount > 0 ? targetCount : assignedCount > 0 ? assignedCount : defaultCount;

    const computedMarks =
      t.sections?.reduce((sum: number, s: any) => {
        const c = s.targetCount > 0 ? s.targetCount : s._count?.questions || 0;
        const m = s.marksPerQuestion ?? t.correctMarks ?? 4;
        return sum + c * m;
      }, 0) || 0;
    const totalMarks = computedMarks > 0 ? computedMarks : qCount * (t.correctMarks || 4);

    const openDate = t.openTime
      ? new Date(t.openTime)
      : t.batchSchedule?.startsAt
      ? new Date(t.batchSchedule.startsAt)
      : now;
    const isLive = now >= openDate && (!t.closeTime || now <= new Date(t.closeTime));

    upcomingTestCard = {
      id: t.id,
      name: t.name,
      openTimeIso: openDate.toISOString(),
      closeTimeIso: t.closeTime ? new Date(t.closeTime).toISOString() : null,
      durationMin: t.durationMin || 180,
      questionCount: qCount,
      totalMarks,
      isLive,
      statusLabel: isLive
        ? "Live Now"
        : openDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
    };
  }

  // Build Next Upcoming Event Info for Today's Plan card (class or test)
  let nextEvent: NextEventInfo | null = null;
  const testStart = upcomingTestCard ? new Date(upcomingTestCard.openTimeIso) : null;
  const classStart = nextClass ? nextClass.startsAt : null;
  const isClassNext =
    classStart &&
    (!testStart || classStart.getTime() <= testStart.getTime() || nextClassStatus === "LIVE");

  if (isClassNext && nextClass) {
    nextEvent = {
      title: `${nextClass.title}${nextClass.teacher?.user.name ? ` • ${nextClass.teacher.user.name}` : ""}`,
      type: nextClass.type,
      startsAtIso: nextClass.startsAt.toISOString(),
      href: nextClassStatus === "LIVE" ? `/live/${nextClass.id}` : `/schedule`,
      isLive: nextClassStatus === "LIVE",
    };
  } else if (upcomingTestCard) {
    nextEvent = {
      title: `${upcomingTestCard.name} • ${upcomingTestCard.isLive ? "Live Test" : "Upcoming Test"}`,
      type: "TEST",
      startsAtIso: upcomingTestCard.openTimeIso,
      href: "/tests",
      isLive: upcomingTestCard.isLive,
    };
  }

  // Format Banners
  const banners: StudentBanner[] = bannersDb.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    ctaUrl: b.ctaUrl,
    ctaText: b.ctaText,
    openInNewTab: b.openInNewTab,
  }));

  // Format Educators
  const educators: EducatorItem[] = teachersDb.map((t) => {
    const rawQual = t.qualifications;
    let qualArr: string[] = [];
    if (Array.isArray(rawQual)) {
      qualArr = rawQual.map((q) => (typeof q === "string" ? q : (q as any)?.degree || String(q)));
    }
    return {
      id: t.id,
      name: t.displayName || t.user.name || "Atomic Faculty",
      photoUrl: t.user.photoUrl || null,
      department: t.department || "Faculty",
      subjects: t.subjects || [],
      experienceYears: t.experienceYears || null,
      qualifications: qualArr,
      bio: t.bio || null,
    };
  });

  // Format Feedback
  const feedbacks: StudentFeedbackItem[] = testimonialsDb.map((item) => ({
    id: item.id,
    studentName: item.studentName,
    photoUrl: item.photoUrl,
    studentClass: item.studentClass,
    targetExam: item.targetExam,
    quote: item.quote,
    rating: item.rating,
    createdAt: item.createdAt.toISOString(),
  }));

  const quickAccess: QuickAccessItem[] = [
    { label: "My Batches", icon: "school", href: "/courses", accent: "blue", badge: enrollments.length ? `${enrollments.length}` : null },
    { label: "My Tests", icon: "quiz", href: "/tests", accent: "violet", badge: testsCount ? `${testsCount}` : null },
    { label: "Daily DPP", icon: "assignment", href: "/dpp", accent: "rose", badge: dppCount ? `${dppCount}` : null },
    { label: "My Doubts", icon: "help", href: "/doubts", accent: "orange", badge: doubtsOpenCount ? `${doubtsOpenCount}` : null },
    { label: "My Progress", icon: "insights", href: "/performance", accent: "emerald", badge: null },
    { label: "Leaderboard", icon: "military_tech", href: "/leaderboard", accent: "amber", badge: null },
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
    <div className="mx-auto max-w-2xl space-y-6 pb-6 lg:max-w-5xl">
      {/* 1. Top 16:9 Clickable Banner Carousel */}
      <StudentBannerCarousel banners={banners} />

      {/* 2. Today's Plan & Live Event Countdown (Warm Earthy Vibrant) */}
      <ProgressCard
        greeting={greeting}
        firstName={firstName}
        targetExam={targetExam}
        streakDays={student.currentStreakDays}
        todayDone={todayDone}
        todayTotal={todayScheduleCount}
        continueHref={continueHref}
        continueLabel="Continue Learning"
        nextEvent={nextEvent}
      />

      {/* 2.5 Prominent Upcoming / Live Test Card */}
      {upcomingTestCard && (
        <UpcomingTestCard test={upcomingTestCard} />
      )}

      {/* 3. Quick Access */}
      <section className="space-y-2.5">
        <SectionHeader title="Quick access" />
        <QuickAccessGrid items={quickAccess} />
      </section>

      {/* 4. Practice & Revise (Cleaned up: Topic-wise Question Practice, NCERT, PYQ, DPP, Downloads) */}
      <section className="space-y-3">
        <SectionHeader title="Practice &amp; revise" />
        <QuickAccessGrid
          items={[
            { label: "NCERT Practice", icon: "menu_book", href: "/practice/ncert", accent: "emerald", badge: "NEW" },
            { label: "Topic-wise Question Practice", icon: "edit_note", href: "/practice", accent: "violet", badge: null },
            { label: "PYQ Practice", icon: "history_edu", href: "/tests", accent: "blue", badge: null },
            { label: "Daily DPP", icon: "assignment", href: "/dpp", accent: "rose", badge: dppCount ? `${dppCount}` : null },
            { label: "Downloads", icon: "download", href: "/downloads", accent: "indigo", badge: downloadsCount ? `${downloadsCount}` : null },
          ]}
        />
      </section>

      {/* 5. Educators Profile Showcase */}
      <EducatorsShowcase educators={educators} />

      {/* 6. Our Student Feedback Carousel */}
      <StudentFeedbackSection initialFeedbacks={feedbacks} studentName={student.user.name || "Student"} />

      {/* Recommended Courses if any */}
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
