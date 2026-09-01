import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudentShell } from "@/components/student/StudentShell";

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Look up student profile in database
  let student = null;
  let hasActiveSubscription = false;

  try {
    student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });

    if (student) {
      const subscription = await prisma.subscription.findUnique({
        where: { studentId: student.id },
        select: { status: true },
      });
      hasActiveSubscription = subscription?.status === "ACTIVE";
    }
  } catch (error) {
    console.error("Error loading student profile in layout:", error);
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
