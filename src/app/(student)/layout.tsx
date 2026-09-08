import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentShell } from "@/components/student/StudentShell";

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, student } = await requireStudentSession();

  let hasActiveSubscription = false;
  try {
    if (student) {
      const subscription = await prisma.subscription.findUnique({
        where: { studentId: student.id },
        select: { status: true },
      });
      hasActiveSubscription = subscription?.status === "ACTIVE";
    }
  } catch (error) {
    console.error("Error loading student subscription in layout:", error);
  }

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
