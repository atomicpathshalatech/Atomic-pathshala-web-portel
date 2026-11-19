"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { ManualQuestionDialog } from "./ManualQuestionDialog";
import { PyqAssignmentDialog } from "./PyqAssignmentDialog";
import { PyqQuestionReviewModal } from "./PyqQuestionReviewModal";

type Exam = { id: string; name: string; canonicalType: string; slug: string };
type ChapterSummary = {
  id: string;
  title: string;
  displayTitle: string;
  chapterNumber: number;
  classNumber: number;
  count: number;
};

type Metrics = {
  totalQuestions: number;
  unverifiedCount: number;
  verifiedCount: number;
  assignedCount: number;
  unassignedCount: number;
  inReviewCount: number;
  needsCorrectionCount: number;
};

type ChapterDetail = {
  subject: string;
  chapter: string;
  examId: string | null;
  examName: string | null;
  tab: "unverified" | "verified";
  statusFilter: string;
  metrics: Metrics;
  yearDistribution: { year: number; count: number }[];
  topicDistribution: { topic: string; count: number }[];
  questions: any[];
  isSuperAdmin?: boolean;
  currentUserId?: string;
};

export function PyqChapterWiseView({
  exams,
  canImport,
}: {
  exams: Exam[];
  canImport: boolean;
}) {
  const [selectedExam, setSelectedExam] = useState<Exam>(
    exams.find((e) => e.canonicalType === "NEET_UG") || exams[0] || { id: "", name: "NEET UG", canonicalType: "NEET_UG", slug: "neet-ug" }
  );

  // Available subjects depending on exam
  const subjects =
    selectedExam.canonicalType === "NEET_UG"
      ? ["Physics", "Chemistry", "Biology", "Botany", "Zoology"]
      : ["Physics", "Chemistry", "Mathematics"];

  const [selectedSubject, setSelectedSubject] = useState<string>("Biology");
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Active Verification Tab inside Chapter
  const [verificationTab, setVerificationTab] = useState<"unverified" | "verified">("unverified");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selection for batch assignment
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState<{
    open: boolean;
    mode: "CHAPTER" | "SELECTED_QUESTIONS" | "SELF";
  }>({ open: false, mode: "CHAPTER" });
  const [reviewModalQuestionId, setReviewModalQuestionId] = useState<string | null>(null);

  // Switch subject when exam changes if current subject is not valid for exam
  useEffect(() => {
    if (!subjects.includes(selectedSubject)) {
      setSelectedSubject(subjects[0] || "Physics");
    }
  }, [selectedExam]);

  // Fetch chapters for the selected exam + subject
  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/team/pyq/chapter-view?exam=${selectedExam.id}&subject=${encodeURIComponent(
        selectedSubject
      )}`
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.chapters) {
          setChapters(j.data.chapters);
          // auto-select first chapter with questions or first chapter
          if (!selectedChapter && j.data.chapters.length > 0) {
            const firstWithQs = j.data.chapters.find((c: ChapterSummary) => c.count > 0) || j.data.chapters[0];
            setSelectedChapter(firstWithQs.title);
          }
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [selectedExam.id, selectedSubject]);

  // Fetch details for selected chapter
  const fetchChapterDetails = () => {
    if (!selectedChapter) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    const params = new URLSearchParams();
    params.set("exam", selectedExam.id);
    params.set("subject", selectedSubject);
    params.set("chapter", selectedChapter);
    params.set("tab", verificationTab);
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    fetch(`/api/team/pyq/chapter-view?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setDetail(j.data);
          // Clear stale selection
          setSelectedQuestionIds(new Set());
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    fetchChapterDetails();
  }, [selectedExam.id, selectedSubject, selectedChapter, verificationTab, statusFilter]);

  function toggleQuestionSelection(id: string) {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!detail?.questions) return;
    if (selectedQuestionIds.size === detail.questions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(detail.questions.map((q) => q.id)));
    }
  }

  return (
    <div className="space-y-4">
      {/* Exam & Subject Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
        {/* Exam Pills */}
        <div className="flex flex-wrap gap-1">
          {exams
            .filter((e) => ["NEET_UG", "JEE_MAIN", "JEE_ADVANCED"].includes(e.canonicalType))
            .map((ex) => {
              const active = selectedExam.id === ex.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setSelectedExam(ex);
                    setSelectedChapter(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {ex.name}
                </button>
              );
            })}
        </div>

        {/* Subject Pills */}
        <div className="flex flex-wrap gap-1">
          {subjects.map((sub) => {
            const active = selectedSubject === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => {
                  setSelectedSubject(sub);
                  setSelectedChapter(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Master NCERT Chapter List */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col h-[78vh]">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {selectedSubject} Syllabus
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {chapters.reduce((sum, c) => sum + c.count, 0)} questions
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {chapters.map((ch) => {
                const active = selectedChapter === ch.title;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChapter(ch.title)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition ${
                      active
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {ch.classNumber ? `C${ch.classNumber}` : ""}
                      </span>
                      <span className="truncate">{ch.title}</span>
                    </div>
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md shrink-0 ${
                        ch.count > 0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 font-bold"
                          : "text-slate-400"
                      }`}
                    >
                      {ch.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chapter Detail, Verification Tabs, Metrics & Question List */}
        <div className="lg:col-span-8 space-y-4">
          {detailLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-64 flex items-center justify-center">
              <p className="text-xs text-slate-400 animate-pulse">Loading chapter previous year questions...</p>
            </div>
          ) : !detail ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              Select a chapter from the syllabus tree to inspect previous year questions
            </div>
          ) : (
            <>
              {/* Chapter Header Banner */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {selectedExam.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {detail.subject}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {detail.chapter}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {detail.metrics.totalQuestions} total recorded question(s) •{" "}
                      <span className="text-emerald-600 font-bold">{detail.metrics.verifiedCount} Verified</span> •{" "}
                      <span className="text-blue-600 font-bold">{detail.metrics.unverifiedCount} Unverified</span>
                    </p>
                  </div>

                  {/* Top Chapter Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.isSuperAdmin !== false && (
                      <button
                        type="button"
                        onClick={() => setAssignmentModal({ open: true, mode: "CHAPTER" })}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                        <span>Assign Chapter</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAssignmentModal({ open: true, mode: "SELF" })}
                      className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      <span>Self Assign</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowManualModal(true)}
                      className="pyq-btn bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add_circle</span>
                      <span>Add Question</span>
                    </button>

                    {canImport && (
                      <Link
                        href={`/team/pyq-library/import?exam=${selectedExam.id}&subject=${encodeURIComponent(
                          detail.subject
                        )}&chapter=${encodeURIComponent(detail.chapter)}`}
                        className="pyq-btn-primary"
                      >
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        <span>Import PDF</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Distributions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Year Distribution */}
                  <div>
                    <span className="font-bold text-slate-500 block mb-1 text-[11px] uppercase tracking-wider">
                      Year-Wise Distribution
                    </span>
                    {detail.yearDistribution.length === 0 ? (
                      <span className="text-slate-400 text-[11px]">No questions recorded yet</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {detail.yearDistribution.map((y) => (
                          <span
                            key={y.year}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px]"
                          >
                            <span className="font-bold text-slate-700 dark:text-slate-300">{y.year}:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black">{y.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Topic Distribution */}
                  <div>
                    <span className="font-bold text-slate-500 block mb-1 text-[11px] uppercase tracking-wider">
                      Topic Breakdown
                    </span>
                    {detail.topicDistribution.length === 0 ? (
                      <span className="text-slate-400 text-[11px]">No topic tags assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {detail.topicDistribution.map((t) => (
                          <span
                            key={t.topic}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]"
                          >
                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{t.topic}</span>
                            <span className="font-mono text-slate-400 font-bold">({t.count})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TWO PRIMARY TABS: Unverified Questions vs Verified Questions */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationTab("unverified");
                      setStatusFilter("ALL");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      verificationTab === "unverified"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                    <span>Unverified Questions ({detail.metrics.unverifiedCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerificationTab("verified");
                      setStatusFilter("ALL");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      verificationTab === "verified"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Verified Questions ({detail.metrics.verifiedCount})</span>
                  </button>
                </div>

                {/* Batch Actions when Checkboxes are checked */}
                {selectedQuestionIds.size > 0 && detail.isSuperAdmin !== false && (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {selectedQuestionIds.size} selected
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAssignmentModal({
                          open: true,
                          mode: "SELECTED_QUESTIONS",
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                      <span>Assign Selected ({selectedQuestionIds.size})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* KPI Metrics Bar for Unverified Questions */}
              {verificationTab === "unverified" && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      statusFilter === "ALL"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Unverified</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                      {detail.metrics.unverifiedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("ASSIGNED")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      statusFilter === "ASSIGNED"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] text-blue-500 uppercase font-bold block">Assigned</span>
                    <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                      {detail.metrics.assignedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("UNASSIGNED")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      statusFilter === "UNASSIGNED"
                        ? "bg-slate-100 dark:bg-slate-800 border-slate-400 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Unassigned</span>
                    <span className="font-mono font-black text-slate-700 dark:text-slate-300 text-sm">
                      {detail.metrics.unassignedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("IN_REVIEW")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      statusFilter === "IN_REVIEW"
                        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] text-amber-500 uppercase font-bold block">In Review</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      {detail.metrics.inReviewCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("NEEDS_CORRECTION")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      statusFilter === "NEEDS_CORRECTION"
                        ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] text-rose-500 uppercase font-bold block">Needs Correction</span>
                    <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                      {detail.metrics.needsCorrectionCount}
                    </span>
                  </button>

                  <div className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col justify-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {selectedQuestionIds.size === detail.questions.length && detail.questions.length > 0
                        ? "Deselect All"
                        : "Select All Page"}
                    </button>
                  </div>
                </div>
              )}

              {/* KPI Metrics Bar for Verified Questions */}
              {verificationTab === "verified" && (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-emerald-900 dark:text-emerald-200 text-sm block">
                      Total Verified Questions: {detail.metrics.verifiedCount}
                    </span>
                    <span className="text-emerald-700/80 dark:text-emerald-400 text-[11px]">
                      Passed 100% human verification, checklist verified, official key verified.
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                    All verified questions are published &amp; active in Practice, Tests &amp; DPPs.
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-3">
                {detail.questions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                      {verificationTab === "verified" ? "verified" : "pending_actions"}
                    </span>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No {verificationTab === "verified" ? "Verified" : "Unverified"} Questions Found
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {verificationTab === "verified"
                        ? "No questions have been approved yet in this chapter. Start review in the Unverified tab to approve questions."
                        : "All questions in this chapter are either verified or no questions match the selected filter."}
                    </p>
                  </div>
                ) : (
                  detail.questions.map((q, idx) => {
                    const enTrans = q.translations?.find((t: any) => t.language?.toUpperCase() === "ENGLISH");
                    const hiTrans = q.translations?.find((t: any) => t.language?.toUpperCase() === "HINDI");
                    const currentTrans = enTrans || q.translations?.[0];
                    const options = (currentTrans?.options || {}) as Record<string, string>;
                    const answers = (currentTrans?.correctOptionIds || []) as string[];
                    const occ = q.pyqOccurrences?.[0];
                    const isSelected = selectedQuestionIds.has(q.id);
                    const isVerified = q.pyqVerificationStatus === "VERIFIED";

                    return (
                      <div
                        key={q.id}
                        className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-700 ${
                          isSelected
                            ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/20"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {/* Header Badges & Actions */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Checkbox for batch select */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleQuestionSelection(q.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />

                            <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                              Q.{idx + 1}
                            </span>

                            {occ ? (
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {occ.exam?.name} {occ.year} {occ.session ? `(${occ.session})` : ""}{" "}
                                {occ.shift ? `[${occ.shift}]` : ""}
                              </span>
                            ) : q.pyqYear ? (
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {q.pyqExam} {q.pyqYear}
                              </span>
                            ) : null}

                            {/* Translation Pills */}
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              EN ✓
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                hiTrans?.statement
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {hiTrans?.statement ? "HI ✓" : "HI Missing ✕"}
                            </span>

                            {/* Diagram Pill */}
                            {q.imageUrl && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">image</span>
                                Diagram
                              </span>
                            )}

                            {q.topic && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                                {q.topic}
                              </span>
                            )}
                          </div>

                          {/* Verification Status & Review Button */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                isVerified
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : q.pyqVerificationStatus === "NEEDS_CORRECTION"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : q.pyqVerificationStatus === "IN_REVIEW"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : q.pyqVerificationStatus === "ASSIGNED"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {q.pyqVerificationStatus || "UNVERIFIED"}
                            </span>

                            {/* Launch Review Modal */}
                            <button
                              type="button"
                              onClick={() => setReviewModalQuestionId(q.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                isVerified
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isVerified ? "visibility" : "rate_review"}
                              </span>
                              <span>{isVerified ? "Inspect / Reopen" : "Review Question"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Assignee / Verification info chip */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-2">
                          {isVerified && q.pyqVerifiedBy?.name ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Verified by {q.pyqVerifiedBy.name} on{" "}
                              {new Date(q.pyqVerifiedAt || "").toLocaleDateString()}
                            </span>
                          ) : q.assignedTo?.name ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">person</span>
                              Assigned to {q.assignedTo.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </div>

                        {/* Question Statement */}
                        <div className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-relaxed my-2">
                          <FormulaText text={currentTrans?.statement || "(No statement)"} />
                        </div>

                        {/* Question Image */}
                        {q.imageUrl && (
                          <div className="my-2 max-w-sm rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={q.imageUrl} alt="Question figure" className="w-full object-contain" />
                          </div>
                        )}

                        {/* Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          {["A", "B", "C", "D"].map((key) => {
                            const optText = options[key];
                            if (!optText) return null;
                            const isCorrect = answers.includes(key);
                            return (
                              <div
                                key={key}
                                className={`flex items-start gap-1.5 p-2 rounded-lg border text-xs ${
                                  isCorrect
                                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 font-semibold"
                                    : "bg-slate-50/50 border-slate-100 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                                }`}
                              >
                                <span className={`font-bold shrink-0 ${isCorrect ? "text-emerald-600" : "text-slate-400"}`}>
                                  ({key})
                                </span>
                                <span className="flex-1">
                                  <FormulaText text={optText} />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Manual Question Dialog */}
      <ManualQuestionDialog
        open={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={fetchChapterDetails}
        defaultExamId={selectedExam.id}
        defaultSubject={selectedSubject}
        defaultChapter={selectedChapter || ""}
        exams={exams}
      />

      {/* Assignment Modal */}
      {assignmentModal.open && (
        <PyqAssignmentDialog
          open={assignmentModal.open}
          onClose={() => setAssignmentModal({ open: false, mode: "CHAPTER" })}
          onSuccess={fetchChapterDetails}
          subject={selectedSubject}
          chapter={selectedChapter || ""}
          examId={selectedExam.id}
          mode={assignmentModal.mode}
          selectedQuestionIds={Array.from(selectedQuestionIds)}
          totalQuestionsCount={detail?.metrics.unverifiedCount || 0}
        />
      )}

      {/* Question Review Modal */}
      {reviewModalQuestionId && (
        <PyqQuestionReviewModal
          questionId={reviewModalQuestionId}
          open={Boolean(reviewModalQuestionId)}
          onClose={() => setReviewModalQuestionId(null)}
          onRefresh={fetchChapterDetails}
        />
      )}
    </div>
  );
}
