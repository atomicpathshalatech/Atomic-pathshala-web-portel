"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TeacherChapterHeader } from "./TeacherChapterHeader";
import { UnifiedChapterScheduleTimeline } from "./UnifiedChapterScheduleTimeline";
import { ChapterDetailView, ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { ChapterReviewActions } from "./ChapterReviewActions";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Send,
  Copy,
  Calendar,
  Timer,
  Sparkles,
  Check,
  ArrowRight,
  HelpCircle,
  X,
} from "lucide-react";

import { ChapterReviewHistoryTimeline, ReviewHistoryItem } from "./ChapterReviewHistoryTimeline";

interface ChapterTeamViewWrapperProps {
  chapterId: string;
  chapterCode?: string | null;
  chapterTitle: string;
  chapterMedium: string;
  chapterStatus: string;
  subjectTitle?: string;
  courseTitle?: string;
  teacherName?: string;
  teacherPhoto?: string | null;
  initialLectures: any[];
  initialDpps: any[];
  initialTests: any[];
  canEdit: boolean;
  canReview: boolean;
  reviews?: ReviewHistoryItem[];
  studentPreviewData: ChapterDetailData;
}

const WEEK_DAYS = [
  { dayIndex: 1, short: "Mon", label: "Monday" },
  { dayIndex: 2, short: "Tue", label: "Tuesday" },
  { dayIndex: 3, short: "Wed", label: "Wednesday" },
  { dayIndex: 4, short: "Thu", label: "Thursday" },
  { dayIndex: 5, short: "Fri", label: "Friday" },
  { dayIndex: 6, short: "Sat", label: "Saturday" },
  { dayIndex: 0, short: "Sun", label: "Sunday" },
];

export function ChapterTeamViewWrapper({
  chapterId,
  chapterCode,
  chapterTitle,
  chapterMedium,
  chapterStatus: initialStatus,
  subjectTitle,
  courseTitle,
  teacherName,
  teacherPhoto,
  initialLectures,
  initialDpps,
  initialTests,
  canEdit,
  canReview,
  reviews = [],
  studentPreviewData,
}: ChapterTeamViewWrapperProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"manager" | "preview">("manager");
  const [status, setStatus] = useState<string>(initialStatus);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Batch Auto-Scheduling & Submission Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Tomorrow as default start date
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0] || "";
  }, []);

  const [startDate, setStartDate] = useState(tomorrowStr);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(90);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri default

  const isUnderReview = status === "UNDER_REVIEW";
  const isApproved = status === "APPROVED" || status === "PUBLISHED";

  // Calculate stats for Header
  const totalQuestions = useMemo(() => {
    let count = 0;
    initialDpps.forEach((d) => {
      count += d._count?.questions || 0;
    });
    initialTests.forEach((t) => {
      count += t._count?.sections || 0;
    });
    return count;
  }, [initialDpps, initialTests]);

  const totalDurationMin = useMemo(() => {
    let mins = 0;
    initialLectures.forEach((l) => {
      mins += l.durationMin || 60;
    });
    return mins;
  }, [initialLectures]);

  const dateRangeStr = useMemo(() => {
    let start: Date | undefined;
    let end: Date | undefined;
    initialLectures.forEach((l) => {
      if (l.scheduledDate) {
        const d = new Date(l.scheduledDate);
        if (!start || d < start) start = d;
        if (!end || d > end) end = d;
      }
    });
    if (start instanceof Date && end instanceof Date) {
      const s = start.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const e = end.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      return `${s} - ${e}`;
    }
    return undefined;
  }, [initialLectures]);

  // Toggle Weekday Selection
  const toggleWeekday = (dayIdx: number) => {
    setSelectedWeekdays((prev) => {
      if (prev.includes(dayIdx)) {
        if (prev.length === 1) {
          toast.error("Please select at least one weekday for classes.");
          return prev;
        }
        return prev.filter((d) => d !== dayIdx);
      } else {
        return [...prev, dayIdx].sort((a, b) => a - b);
      }
    });
  };

  // Calculate live schedule dates for all lectures based on selected weekdays
  const calculatedLectureSchedule = useMemo(() => {
    if (!startDate || selectedWeekdays.length === 0 || initialLectures.length === 0) {
      return [];
    }

    const [y, m, d] = startDate.split("-").map(Number);
    if (!y || !m || !d) return [];

    const current = new Date(y, m - 1, d);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return initialLectures.map((lec, idx) => {
      // Advance to next valid weekday
      while (!selectedWeekdays.includes(current.getDay())) {
        current.setDate(current.getDate() + 1);
      }

      const scheduledDate = new Date(current);
      const dayName = dayNames[scheduledDate.getDay()];
      const formattedDate = scheduledDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Move current date to next day for the subsequent lecture
      current.setDate(current.getDate() + 1);

      return {
        lectureId: lec.id,
        title: lec.title,
        order: lec.order || idx + 1,
        date: scheduledDate,
        dateFormatted: `${dayName}, ${formattedDate}`,
        time: startTime,
        duration: durationMin,
      };
    });
  }, [startDate, selectedWeekdays, startTime, durationMin, initialLectures]);

  // Submit Chapter with Batch Auto-Schedule
  const handlePublishForReview = async () => {
    if (initialLectures.length === 0) {
      toast.error("Please add at least one lecture before submitting.");
      return;
    }
    if (selectedWeekdays.length === 0) {
      toast.error("Please select at least one weekday.");
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          startTime,
          durationMin: Number(durationMin) || 90,
          weekdays: selectedWeekdays,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to submit chapter.");
        return;
      }

      setStatus("UNDER_REVIEW");
      setShowScheduleModal(false);
      toast.success(
        `All ${initialLectures.length} classes scheduled on selected weekdays! Chapter is now Under Review.`
      );
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
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isApproved
                ? "bg-emerald-500"
                : isUnderReview
                ? "bg-amber-500 animate-pulse"
                : "bg-blue-600"
            }`}
          />
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
          {/* Teacher Chapter Overview Header */}
          <TeacherChapterHeader
            chapterId={chapterId}
            chapterCode={chapterCode}
            chapterTitle={chapterTitle}
            subjectTitle={subjectTitle || studentPreviewData.subjectName}
            courseTitle={courseTitle || studentPreviewData.courseTitle}
            medium={chapterMedium}
            status={status}
            teacherName={teacherName || studentPreviewData.teacher.name}
            teacherPhoto={teacherPhoto || studentPreviewData.teacher.photo}
            totalLectures={initialLectures.length}
            totalDpps={initialDpps.length}
            totalTests={initialTests.length}
            totalQuestions={totalQuestions}
            totalDurationMin={totalDurationMin}
            dateRangeStr={dateRangeStr}
            canEdit={canEdit}
            onDeleteClick={() => setShowDeleteModal(true)}
          />

          {/* Admin Verification Desk (Approve, Send Back / Revision, Reject) */}
          {/* Automatically hidden once Chapter is APPROVED or PUBLISHED */}
          {canReview && !isApproved && (isUnderReview || status !== "DRAFT") && (
            <div className="p-1 rounded-2xl">
              <ChapterReviewActions chapterId={chapterId} currentStatus={status} />
            </div>
          )}

          {/* Unified Chapter Content & Schedule Timeline */}
          <UnifiedChapterScheduleTimeline
            chapterId={chapterId}
            chapterTitle={chapterTitle}
            chapterMedium={chapterMedium}
            chapterStatus={status}
            initialLectures={initialLectures}
            initialDpps={initialDpps}
            initialTests={initialTests}
            canEdit={canEdit || canReview}
          />

          {/* Governance Audit Trail & Review Decision History Timeline (Fully Traceable) */}
          {reviews && reviews.length > 0 && (
            <ChapterReviewHistoryTimeline reviews={reviews} />
          )}

          {/* Secure Delete Resource Modal */}
          <SecureDeleteResourceModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            resourceId={chapterId}
            resourceTitle={chapterTitle}
            resourceType="CHAPTER"
            onDeleted={() => {
              setShowDeleteModal(false);
              router.push("/team/chapters");
            }}
          />

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
                  ? "Your chapter lectures and tests are being reviewed. Once approved, Admin will import this chapter into live student batches."
                  : "Submit this chapter for Academic Lead review. In the next step, select your preferred weekdays (e.g. Mon, Wed, Fri) and class duration to auto-schedule all lectures."}
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
                  <span className="text-[11px] text-blue-100">
                    Click to copy ID for Batch Timetable Import
                  </span>
                </div>
              )}
            </div>

            {/* Action Button: Opens Batch Scheduling & Weekday Multi-Select Modal */}
            {!isApproved && !isUnderReview && canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (initialLectures.length === 0) {
                    toast.error("Please add at least one lecture before submitting.");
                    return;
                  }
                  setShowScheduleModal(true);
                }}
                className="px-6 py-3.5 rounded-2xl bg-white text-blue-700 font-bold text-sm shadow-xl hover:bg-blue-50 active:scale-95 transition flex items-center gap-2 shrink-0"
              >
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Schedule Weekdays &amp; Submit</span>
              </button>
            )}

            {isUnderReview && (
              <div className="px-5 py-2.5 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold flex items-center gap-2 shrink-0">
                <Clock className="w-4 h-4" />
                <span>Under Review for Admin</span>
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

      {/* AUTO-SCHEDULE BATCH CLASSES & WEEKDAYS SUBMIT MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 rounded-3xl max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Auto-Schedule Classes &amp; Submit Chapter
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select batch weekdays &amp; class duration to schedule all {initialLectures.length} lectures automatically.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Select Weekdays */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Select Batch Weekdays (Weekly Schedule) *</span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  {selectedWeekdays.length} Days Selected
                </span>
              </label>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => {
                  const isSelected = selectedWeekdays.includes(day.dayIndex);
                  return (
                    <button
                      key={day.dayIndex}
                      type="button"
                      onClick={() => toggleWeekday(day.dayIndex)}
                      className={`py-2.5 px-2 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-mono">{day.short}</span>
                      <div className="flex items-center justify-center">
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-400/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Start Date, Time & Default Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Batch Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Class Time *
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Class Duration *</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{durationMin} mins</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {[45, 60, 90, 120].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMin(d)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                        durationMin === d
                          ? "bg-blue-600 text-white shadow"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Live Calculation Timetable Preview */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Live Auto-Scheduled Timetable Preview:
                </span>
                <span className="text-slate-500 text-[11px]">
                  Applied to all {calculatedLectureSchedule.length} Lectures
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50 dark:bg-slate-950/60">
                {calculatedLectureSchedule.map((item, idx) => (
                  <div
                    key={item.lectureId || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px]">
                        Lec {String(item.order).padStart(2, "0")}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-slate-500 dark:text-slate-400 text-[11px]">
                      <span className="font-bold text-blue-600 dark:text-blue-300">{item.dateFormatted}</span>
                      <span>{item.time}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                        {item.duration}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePublishForReview}
                disabled={submittingReview}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submittingReview ? "Publishing & Scheduling..." : "Publish Chapter for Review"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}