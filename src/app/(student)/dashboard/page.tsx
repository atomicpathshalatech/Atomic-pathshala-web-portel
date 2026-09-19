import type { Metadata } from "next";
import Link from "next/link";
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

  // Build Next Upcoming Event Info for Today's Plan card
  const nextEvent: NextEventInfo | null = nextClass
    ? {
        title: `${nextClass.title}${nextClass.teacher?.user.name ? ` • ${nextClass.teacher.user.name}` : ""}`,
        type: nextClass.type,
        startsAtIso: nextClass.startsAt.toISOString(),
        href: nextClassStatus === "LIVE" ? `/live/${nextClass.id}` : `/schedule`,
        isLive: nextClassStatus === "LIVE",
      }
    : null;

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
