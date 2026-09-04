import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  ArrowRight,
  ChevronLeft,
  Layers,
  Send,
  Download,
} from "lucide-react";
import { ExtractionReportData } from "@/lib/extraction/validator";

export const metadata: Metadata = {
  title: "Extraction Job Dashboard & Report",
};

export default async function ExtractionJobDetailPage({
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
      createdBy: { select: { name: true, email: true } },
      _count: { select: { questions: true } },
    },
  });

  if (!job) notFound();

  const report = (job.reportJson as ExtractionReportData | null) || {
    sourceName: job.sourceName,
    fileName: job.fileName,
    expectedRange: `${job.startNumber}–${job.endNumber}`,
    expectedCount: job.expectedCount,
    extractedCount: job.extractedCount,
    verifiedCount: job.verifiedCount,
    reviewCount: job.reviewCount,
    errorCount: job.errorCount,
    missingCount: job.missingCount,
    duplicateCount: job.duplicateCount,
    answerKeyMatchedCount: job.verifiedCount,
    solutionsMatchedCount: job.extractedCount,
    status: job.status as any,
    issues: [],
  };

  const isAllVerified = job.status === "VERIFIED" || (job.reviewCount === 0 && job.errorCount === 0 && job.missingCount === 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/team/question-extract"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to All Extraction Jobs</span>
      </Link>

      {/* 1. Job Header Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-extrabold text-xs tracking-wide font-mono uppercase shadow-sm">
              SOURCE: {job.sourceName}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              {job.fileName}
            </span>
            {job.examName && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                {job.examName}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
            Extraction Report &amp; Job Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Range: Q.{job.startNumber}–Q.{job.endNumber} ({job.expectedCount} expected) • Created on{" "}
            {new Date(job.createdAt).toLocaleString("en-IN")}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 flex-wrap">
          {job.reviewCount > 0 && (
            <Link
              href={`/team/question-extract/${job.id}/review`}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Review {job.reviewCount} Flagged</span>
            </Link>
          )}

          <Link
            href={`/team/question-extract/${job.id}/questions`}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            <span>Open All Questions ({job.extractedCount})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 2. Extraction Validation Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Expected vs Extracted</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {report.extractedCount} / {report.expectedCount}
          </p>
          <span className="text-[10px] text-slate-400">
            {report.extractedCount === report.expectedCount ? "✓ 100% Count Matched" : "⚠ Discrepancy detected"}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 uppercase">Verified Questions</span>
          <p className="text-2xl font-black text-emerald-600 font-mono">{report.verifiedCount}</p>
          <span className="text-[10px] text-slate-400">Passed all validation checks</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-amber-600 uppercase">Review Required</span>
          <p className="text-2xl font-black text-amber-600 font-mono">{report.reviewCount}</p>
          <span className="text-[10px] text-slate-400">Image, table or key checks</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-rose-600 uppercase">Missing / Errors</span>
          <p className="text-2xl font-black text-rose-600 font-mono">
            {report.missingCount + report.errorCount}
          </p>
          <span className="text-[10px] text-slate-400">
            {report.missingCount} missing • {report.errorCount} errors
          </span>
        </div>
      </div>

      {/* 3. Detailed Validation Report Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Audit &amp; Validation Engine Checklist
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isAllVerified
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            Status: {report.status.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Answer Key Matching:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {report.answerKeyMatchedCount} / {report.expectedCount} matched
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Solutions Extracted:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {report.solutionsMatchedCount} / {report.expectedCount} extracted
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Duplicate Question Numbers:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {report.duplicateCount} duplicates
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Missing Question Sequence:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {report.missingCount} missing
            </span>
          </div>
        </div>

        {/* Issue List (If Any) */}
        {report.issues && report.issues.length > 0 ? (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Flagged Items for Verification ({report.issues.length}):
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {report.issues.map((iss, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                    iss.severity === "ERROR"
                      ? "bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-200"
                      : "bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border text-[11px]">
                      Q.{iss.questionNumber}
                    </span>
                    <span className="font-medium text-xs">{iss.message}</span>
                  </div>
                  <Link
                    href={`/team/question-extract/${job.id}/questions?search=${iss.questionNumber}`}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border font-bold text-[11px] hover:bg-slate-100 transition shrink-0"
                  >
                    View Q.{iss.questionNumber}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Zero discrepancies detected. All {report.extractedCount} questions passed high-precision validation.</span>
          </div>
        )}
      </div>
    </div>
  );
}
