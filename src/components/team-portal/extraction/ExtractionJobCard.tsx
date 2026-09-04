"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Send,
  Eye,
  Trash2,
  Layers,
  Database,
} from "lucide-react";

export interface ExtractionJobItem {
  id: string;
  sourceName: string;
  fileName: string;
  fileSize: number;
  startNumber: number;
  endNumber: number;
  expectedCount: number;
  extractedCount: number;
  verifiedCount: number;
  reviewCount: number;
  errorCount: number;
  missingCount: number;
  duplicateCount: number;
  status: string;
  progress: number;
  currentStep?: string | null;
  examName?: string | null;
  year?: string | null;
  subject?: string | null;
  createdAt: string | Date;
  createdBy?: { name: string | null; email: string | null } | null;
}

export function ExtractionJobCard({
  job,
  onDelete,
}: {
  job: ExtractionJobItem;
  onDelete?: (id: string) => void;
}) {
  const isVerified = job.status === "VERIFIED";
  const isReviewRequired = job.status === "REVIEW_REQUIRED";
  const isProcessing = job.status === "PROCESSING" || job.status === "PENDING";
  const isImported = job.status === "IMPORTED_TO_DRAFT";
  const isError = job.status === "FAILED" || job.errorCount > 0 || job.missingCount > 0;

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4 group">
      {/* 1. Header & Source Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-extrabold text-xs tracking-wide font-mono uppercase shadow-sm">
              {job.sourceName}
            </span>
            {job.examName && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                {job.examName} {job.year ? `(${job.year})` : ""}
              </span>
            )}
            {job.subject && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold border border-indigo-200 dark:border-indigo-800">
                {job.subject}
              </span>
            )}
          </div>
          <h3 className="font-black text-slate-900 dark:text-white text-base tracking-tight flex items-center gap-2 mt-1">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="truncate max-w-sm">{job.fileName}</span>
          </h3>
        </div>

        {/* Status Pill */}
        <div>
          {isImported ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              In Drafts ({job.extractedCount})
            </span>
          ) : isVerified ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              100% Verified ({job.verifiedCount}/{job.expectedCount})
            </span>
          ) : isReviewRequired ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Review Needed ({job.reviewCount})
            </span>
          ) : isProcessing ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 text-xs font-bold animate-pulse">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              {job.currentStep || "Processing..."}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Validation Error ({job.errorCount + job.missingCount})
            </span>
          )}
        </div>
      </div>

      {/* 2. Key Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Range</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            Q.{job.startNumber} – Q.{job.endNumber} ({job.expectedCount})
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Extracted Count</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            {job.extractedCount} / {job.expectedCount}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {job.verifiedCount}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Review Flagged</span>
          <span
            className={`font-mono font-bold ${
              job.reviewCount > 0 ? "text-amber-600 dark:text-amber-400 font-black" : "text-slate-500"
            }`}
          >
            {job.reviewCount}
          </span>
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="text-[11px] text-slate-400">
          Created: {new Date(job.createdAt).toLocaleDateString("en-IN")} by{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {job.createdBy?.name || "Admin"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {job.reviewCount > 0 && (
            <Link
              href={`/team/question-extract/${job.id}/review`}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition flex items-center gap-1 active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Fix {job.reviewCount} Flagged</span>
            </Link>
          )}

          <Link
            href={`/team/question-extract/${job.id}/questions`}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition flex items-center gap-1 active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Open All Questions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(job.id)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"
              title="Delete Job"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
