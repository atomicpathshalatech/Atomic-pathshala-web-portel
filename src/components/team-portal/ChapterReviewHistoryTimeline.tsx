"use client";

import React from "react";
import { Clock, ShieldCheck, CheckCircle2, RotateCcw, XCircle, User, MessageSquare } from "lucide-react";

export interface ReviewHistoryItem {
  id: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  comment?: string | null;
  previousStatus: string;
  newStatus: string;
  createdAt: Date | string;
  actor: {
    name?: string | null;
    email?: string | null;
    photoUrl?: string | null;
    role?: { name?: string | null } | null;
  };
}

const ACTION_CONFIG = {
  SUBMITTED: {
    label: "Submitted for Review",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved & Verified",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    icon: CheckCircle2,
  },
  CHANGES_REQUESTED: {
    label: "Sent Back to Authoring / Revisions",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    icon: RotateCcw,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    icon: XCircle,
  },
};

export function ChapterReviewHistoryTimeline({
  reviews = [],
}: {
  reviews: ReviewHistoryItem[];
}) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Governance Audit Trail &amp; Traceability Log
            </h4>
            <p className="text-xs text-slate-500">
              Complete chronological record of all submissions, approvals, rejections &amp; feedback.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {reviews.length} Decision{reviews.length === 1 ? "" : "s"} Logged
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {reviews.map((rev) => {
          const config = ACTION_CONFIG[rev.action] || ACTION_CONFIG.SUBMITTED;
          const Icon = config.icon;
          const date = new Date(rev.createdAt);
          const formattedDate = date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={rev.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl border ${config.color} shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {config.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({rev.previousStatus} ➔ {rev.newStatus})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      By: {rev.actor.name || rev.actor.email || "Academic Officer"}
                    </span>
                    {rev.actor.role?.name && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
                        {rev.actor.role.name}
                      </span>
                    )}
                  </div>

                  {rev.comment && (
                    <div className="mt-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-start gap-1.5 font-medium text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span>&quot;{rev.comment}&quot;</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-slate-400 text-[11px] font-mono shrink-0 self-start sm:self-center">
                {formattedDate}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
