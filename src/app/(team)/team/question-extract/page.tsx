import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ExtractionJobCard } from "@/components/team-portal/extraction/ExtractionJobCard";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Database,
  Layers,
  Plus,
  Search,
  Filter,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Question Extract — High-Precision Ingestion Engine",
};

export default async function QuestionExtractHubPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; search?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const where: any = {};
  if (searchParams.source && searchParams.source !== "ALL") {
    where.sourceName = { equals: searchParams.source, mode: "insensitive" };
  }
  if (searchParams.status && searchParams.status !== "ALL") {
    where.status = searchParams.status;
  }
  if (searchParams.search) {
    where.OR = [
      { sourceName: { contains: searchParams.search, mode: "insensitive" } },
      { fileName: { contains: searchParams.search, mode: "insensitive" } },
      { examName: { contains: searchParams.search, mode: "insensitive" } },
    ];
  }

  const [jobs, totalJobs, totalVerified, totalReview, totalDraft] = await Promise.all([
    prisma.extractionJob.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.extractionJob.count(),
    prisma.extractedQuestion.count({ where: { status: "VERIFIED" } }),
    prisma.extractedQuestion.count({ where: { status: "REVIEW_REQUIRED" } }),
    prisma.extractedQuestion.count({ where: { status: "IMPORTED" } }),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono text-xs font-bold">
              HIGH-PRECISION INGESTION
            </span>
            <span className="text-xs text-slate-400 font-semibold font-mono">
              Zero-Silent-Error Policy
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Question Extract
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Ingest full PDF exam papers (ALLEN, RACE, NCERT, NEET PYQs). Automatically preserves equations, tables, images, extracts answer keys &amp; solutions, auto-classifies into 18 NEET types, validates, and sends verified questions to Drafts.
          </p>
        </div>

        <Link
          href="/team/question-extract/upload"
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 active:scale-95 shrink-0 self-start sm:self-center"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload New PDF</span>
        </Link>
      </div>

      {/* 2. Global Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Jobs</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalJobs}</p>
          <span className="text-[10px] text-slate-400 font-medium">Multi-page PDF extraction jobs</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">100% Verified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono">{totalVerified}</p>
          <span className="text-[10px] text-slate-400 font-medium">Ready to move to Drafts</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Review Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 font-mono">{totalReview}</p>
          <span className="text-[10px] text-slate-400 font-medium">Flagged for manual verification</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">In Drafts</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 font-mono">{totalDraft}</p>
          <span className="text-[10px] text-slate-400 font-medium">Converted into Question Bank</span>
        </div>
      </div>

      {/* 3. Extraction Jobs Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-900 dark:text-white">
            Extraction Jobs History ({jobs.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Permanent Source Tracking Enabled
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
              No PDF Extraction Jobs Found
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Start by uploading an exam PDF with its Source Name (e.g. ALLEN, RACE) and expected question range (e.g. 1-180).
            </p>
            <Link
              href="/team/question-extract/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 shadow-sm transition mt-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload First PDF Paper</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <ExtractionJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
