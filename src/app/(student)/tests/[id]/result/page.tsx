import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { getStoredTestAnalysis } from "@/lib/test-engine/analysis-engine";
import { StudentResultDashboard } from "@/components/student/result/StudentResultDashboard";

export const metadata: Metadata = {
  title: "Test Result & AIR Detailed Analytics | Atomic Pathshala",
};

export default async function TestResultPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { batchSchedule: true, testSeries: true },
  });
  if (!test) notFound();
  if (!test.batchScheduleId && !test.testSeriesId) redirect("/tests");

  const { student } = await resolveStudentForTest(session.user.id, test);
  if (!student) redirect("/tests");

  const attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
  });
  if (!attempt) redirect("/tests");
  if (attempt.status === "IN_PROGRESS") redirect(`/tests/${test.id}/attempt`);

  const analysis = await getStoredTestAnalysis(attempt.id);
  if (!analysis) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analysis in Progress</h2>
        <p className="text-xs text-slate-500">
          Your test answers have been saved. Generating performance metrics...
        </p>
      </div>
    );
  }

  return <StudentResultDashboard analysis={analysis} />;
}
