import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TwoPanelQuestionReviewer } from "@/components/team-portal/extraction/TwoPanelQuestionReviewer";
import { ChevronLeft } from "lucide-react";
import { ImportToDraftButton } from "@/components/team-portal/extraction/ImportToDraftButton";

export const metadata: Metadata = {
  title: "Extracted Questions Explorer & Approval",
};

export default async function ExtractedQuestionsExplorerPage({
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
        orderBy: [
          { sourceSequenceNumber: "asc" },
          { sourcePage: "asc" },
          { originalNumber: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!job) notFound();

  const verifiedCount = job.questions.filter((q) => q.status === "VERIFIED").length;
  const approvedCount = job.questions.filter((q) => q.approvalStatus === "APPROVED").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href={`/team/question-extract/${job.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Extraction Report</span>
        </Link>

        {/* Publication Stats */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">
            Approved: <b className="text-emerald-600">{approvedCount}</b> of {job.questions.length} • Verified: <b className="text-blue-600">{verifiedCount}</b>
          </span>
          <ImportToDraftButton
            jobId={job.id}
            verifiedCount={verifiedCount}
            disabled={verifiedCount === 0}
          />
        </div>
      </div>

      {/* Two-Panel Sequence-Preserving Question Explorer Component */}
      <TwoPanelQuestionReviewer
        questions={job.questions.map((q) => ({
          ...q,
          options: q.options as any,
          status: q.status as any,
          approvalStatus: q.approvalStatus,
          rejectionReason: q.rejectionReason,
          publishedQuestionId: q.publishedQuestionId,
          sourceSequenceNumber: q.sourceSequenceNumber,
          assignedQuestionCode: q.assignedQuestionCode,
          sectionHeader: q.sectionHeader,
          reviewReasons: (q.reviewReasons as string[]) || [],
        }))}
        jobId={job.id}
        sourceName={job.sourceName}
        expectedCount={job.expectedCount}
      />
    </div>
  );
}
