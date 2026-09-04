import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TwoPanelQuestionReviewer } from "@/components/team-portal/extraction/TwoPanelQuestionReviewer";
import { ChevronLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Review Required Queue — Question Extract",
};

export default async function ReviewRequiredQueuePage({
  params,
}: {
  params: { jobId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead =
    (await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
  if (!canRead) redirect("/team");

  const job = await prisma.extractionJob.findUnique({
    where: { id: params.jobId },
    include: {
      questions: {
        where: {
          status: { in: ["REVIEW_REQUIRED", "EXTRACTION_ERROR", "DUPLICATE", "MISSING"] },
        },
        orderBy: { originalNumber: "asc" },
      },
    },
  });

  if (!job) notFound();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header & Triage stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-sm">
        <div>
          <Link
            href={`/team/question-extract/${job.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline mb-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Job Dashboard</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-200 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <span>Review Required Triage Queue</span>
          </h1>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            Source: <b>{job.sourceName}</b> • {job.questions.length} question(s) flagged for manual verification before moving to Drafts.
          </p>
        </div>

        <Link
          href={`/team/question-extract/${job.id}/questions`}
          className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold text-xs shadow-sm hover:bg-amber-100 transition"
        >
          View All {job.expectedCount} Questions
        </Link>
      </div>

      {/* Flagged Questions Two-Panel Reviewer */}
      {job.questions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
            All Questions Have Been Verified!
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            There are 0 questions left in the review queue. You can now move all verified questions to Question Bank Drafts.
          </p>
          <Link
            href={`/team/question-extract/${job.id}/questions`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 shadow-sm transition"
          >
            <span>Go to Verified Questions Explorer</span>
          </Link>
        </div>
      ) : (
        <TwoPanelQuestionReviewer
          questions={job.questions.map((q) => ({
            ...q,
            options: q.options as any,
            status: q.status as any,
            reviewReasons: (q.reviewReasons as string[]) || [],
          }))}
          jobId={job.id}
          sourceName={job.sourceName}
          expectedCount={job.expectedCount}
        />
      )}
    </div>
  );
}
