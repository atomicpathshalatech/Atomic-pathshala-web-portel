import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { getStoredTestAnalysis } from "@/lib/test-engine/analysis-engine";
import { StudentResultDashboard } from "@/components/student/result/StudentResultDashboard";
import { DppResultDashboard } from "@/components/student/result/DppResultDashboard";
import { areResultsReleased, resultsReleaseAt } from "@/lib/tests/schedule-rules";
import { formatISTDateTime } from "@/lib/date-utils";

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
  if (!test.batchScheduleId && !test.testSeriesId && !test.chapterId && test.testType !== "DPP") redirect("/tests");

  const { student } = await resolveStudentForTest(session.user.id, test);
  if (!student) redirect("/tests");

  const attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
  });
  if (!attempt) redirect("/tests");
  if (attempt.status === "IN_PROGRESS") redirect(`/tests/${test.id}/attempt`);

  // Results (score, analysis, solutions, PDF) open for everyone together once
  // the scheduled test time is over — not the moment a student submits.
  if (!areResultsReleased(test)) {
    const releaseAt = resultsReleaseAt(test);
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-emerald-600">task_alt</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Test submitted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your answers for <b>{test.name}</b> are saved. The result, solutions and paper PDF open for everyone after the
          test time is over:
        </p>
        <p className="inline-block rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          {formatISTDateTime(releaseAt)} (IST)
        </p>
        <p className="text-xs text-slate-500">
          आपका टेस्ट जमा हो गया है। रिज़ल्ट ऊपर दिए समय के बाद सभी छात्रों के लिए एक साथ खुलेगा।
        </p>
      </div>
    );
  }

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

  if (analysis.isDpp) {
    return <DppResultDashboard analysis={analysis} />;
  }

  return <StudentResultDashboard analysis={analysis} />;
}
