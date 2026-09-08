import { requireStudentSession } from "@/lib/auth/session";
import { StudentShell } from "@/components/student/StudentShell";

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, student } = await requireStudentSession();

  // Subscription status now rides along on the cached student lookup in
  // requireStudentSession() — no separate query here.
  const hasActiveSubscription = student?.subscription?.status === "ACTIVE";

  // Fallback safe values for admin/teacher preview or newly registered users
  const studentName = student?.user?.name || session.user.name || "Student";
  const studentIdCode = student?.studentIdCode || "AP-STUDENT";
  const targetExam = student?.targetExam || "NEET";
  const currentStreakDays = student?.currentStreakDays || 1;

  return (
    <StudentShell
      studentName={studentName}
      studentIdCode={studentIdCode}
      targetExam={targetExam}
      currentStreakDays={currentStreakDays}
      hasActiveSubscription={hasActiveSubscription}
    >
      {children}
    </StudentShell>
  );
}
