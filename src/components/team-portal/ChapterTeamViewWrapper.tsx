"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChapterContentManager } from "./ChapterContentManager";
import { ChapterDetailView, ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { ChapterReviewActions } from "./ChapterReviewActions";
import { toast } from "sonner";
import { CheckCircle2, Clock, Send, Copy, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

interface ChapterTeamViewWrapperProps {
  chapterId: string;
  chapterTitle: string;
  chapterMedium: string;
  chapterStatus: string;
  initialLectures: any[];
  initialDpps: any[];
  initialTests: any[];
  canEdit: boolean;
  canReview: boolean;
  studentPreviewData: ChapterDetailData;
}

export function ChapterTeamViewWrapper({
  chapterId,
  chapterTitle,
  chapterMedium,
  chapterStatus: initialStatus,
  initialLectures,
  initialDpps,
  initialTests,
  canEdit,
  canReview,
  studentPreviewData,
}: ChapterTeamViewWrapperProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"manager" | "preview">("manager");
  const [status, setStatus] = useState<string>(initialStatus);
  const [submittingReview, setSubmittingReview] = useState(false);

  const isUnderReview = status === "UNDER_REVIEW";
  const isApproved = status === "APPROVED" || status === "PUBLISHED";

  // Submit Chapter for Review Handler
  const handleSubmitForReview = async () => {
    if (initialLectures.length === 0) {
      toast.error("Please add at least one lecture before submitting.");
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to submit chapter.");
        return;
      }

      setStatus("UNDER_REVIEW");
      toast.success("Chapter submitted for Review! Status is now Under Review.");
      router.refresh();
    } catch {
      toast.error("Network error while submitting chapter.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const copyChapterId = () => {
    navigator.clipboard.writeText(chapterId);
    toast.success(`Chapter ID copied: ${chapterId}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Experience View Switcher */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 pl-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isApproved ? "bg-emerald-500" : isUnderReview ? "bg-amber-500 animate-pulse" : "bg-blue-600"}`} />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Chapter Experience View:
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode("manager")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === "manager"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            <span>Content Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === "preview"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">phone_iphone</span>
            <span>Student UI Reference</span>
          </button>
        </div>
      </div>

      {viewMode === "manager" ? (
        <div className="space-y-6">
          {/* Review Actions if Under Review */}
          {canReview && isUnderReview && (
            <div className="p-1 rounded-2xl">
              <ChapterReviewActions chapterId={chapterId} />
            </div>
          )}

          {/* Interactive Content Manager: Lectures, DPPs, and Chapter Tests */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <ChapterContentManager
              chapterId={chapterId}
              chapterTitle={chapterTitle}
              chapterMedium={chapterMedium}
              initialLectures={initialLectures}
              initialDpps={initialDpps}
              initialTests={initialTests}
              canEdit={canEdit && !isUnderReview}
            />
          </div>

          {/* BLUE SUBMISSION / STATUS & BATCH IMPORT BOX (BOTTOM) */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-black tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                  Chapter Governance
                </span>
                <span className="text-xs font-bold bg-black/25 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  {isApproved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Status: Approved &amp; Verified</span>
                    </>
                  ) : isUnderReview ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                      <span className="text-amber-200">Status: Under Review</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-300" />
                      <span>Status: In Authoring</span>
                    </>
                  )}
                </span>
              </div>

              <h3 className="text-lg font-bold">
                {isApproved
                  ? "Chapter is Approved & Ready for Batch Timetables"
                  : isUnderReview
                  ? "Chapter Submitted — Awaiting Academic Lead Verification"
                  : "Finished adding lectures & content for this chapter?"}
              </h3>

              <p className="text-xs text-blue-100/90 leading-relaxed">
                {isApproved
                  ? "This chapter's roadmap is verified. Use the Chapter ID to import all lectures and tests into other batch schedules with one click."
                  : isUnderReview
                  ? "Your chapter lectures and tests are being reviewed. Once approved, the chapter ID will be unlocked for multi-batch imports."
                  : "Submit this chapter for Academic Lead verification. Once verified, this chapter's syllabus will be approved and ready for batch schedules."}
              </p>

              {isApproved && (
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyChapterId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-mono font-bold transition"
                  >
                    <span>ID: {chapterId.slice(0, 10)}...</span>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-blue-100">Click to copy ID for Batch Timetable Import</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            {!isApproved && !isUnderReview && canEdit && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={submittingReview}
                className="px-6 py-3 rounded-2xl bg-white text-blue-700 font-bold text-sm shadow-lg hover:bg-blue-50 active:scale-95 transition flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submittingReview ? "Submitting..." : "Submit Chapter"}</span>
              </button>
            )}

            {isUnderReview && (
              <div className="px-5 py-2.5 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold flex items-center gap-2 shrink-0">
                <Clock className="w-4 h-4" />
                <span>Under Review</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090b14] overflow-hidden shadow-2xl">
          <ChapterDetailView
            data={studentPreviewData}
            backHref="/team/chapters"
            isTeacherView={true}
          />
        </div>
      )}
    </div>
  );
}