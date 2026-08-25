import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentShell } from "@/components/student/StudentShell";

/**
 * Student portal shell — sidebar + top bar on desktop, top bar + drawer +
 * bottom nav on mobile (StudentShell). Every page under `(student)/*`
 * (dashboard, courses, live-class, doubts, schedule, id-card, settings, and
 * the pre-existing tests/dpp/practice-board/subscription/notifications
 * routes) renders as `{children}` inside this layout automatically — no
 * per-page chrome needed.
 *
 * StudentShell now carries the goal/streak header + 5-tab nav (Home / My
 * Schedule / Practice / Tests / Batches) — targetExam and
 * currentStreakDays come straight off the Student row `requireStudentSession`
 * already fetches, no extra query needed.
 */
export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { student } = await requireStudentSession();

  // Drives whether the persistent "Upgrade" banner shows — a student on an
  // ACTIVE plan doesn't need to be told to get one. TRIAL still counts as
  // "not yet subscribed" (the banner is exactly the nudge a trial user
  // should see), same as CANCELLED/PAST_DUE/EXPIRED.
  const subscription = await prisma.subscription.findUnique({
    where: { studentId: student.id },
    select: { status: true },
  });
  const hasActiveSubscription = subscription?.status === "ACTIVE";

  return (
    <StudentShell
      studentName={student.user.name}
      studentIdCode={student.studentIdCode}
      targetExam={student.targetExam}
      currentStreakDays={student.currentStreakDays}
      hasActiveSubscription={hasActiveSubscription}
    >
      {children}
    </StudentShell>
  );
}
