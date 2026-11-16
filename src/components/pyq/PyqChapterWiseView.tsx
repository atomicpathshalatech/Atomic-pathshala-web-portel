"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { ManualQuestionDialog } from "./ManualQuestionDialog";

type Exam = { id: string; name: string; canonicalType: string; slug: string };
type ChapterSummary = {
  id: string;
  title: string;
  displayTitle: string;
  chapterNumber: number;
  classNumber: number;
  count: number;
};
type ChapterDetail = {
  subject: string;
  chapter: string;
  examId: string | null;
  examName: string | null;
  totalQuestions: number;
  yearDistribution: { year: number; count: number }[];
  topicDistribution: { topic: string; count: number }[];
  questions: any[];
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

  const [selectedSubject, setSelectedSubject] = useState<string>("Physics");
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Switch subject when exam changes if current subject is not valid for exam
  useEffect(() => {
    if (!subjects.includes(selectedSubject)) {
      setSelectedSubject("Physics");
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
  useEffect(() => {
    if (!selectedChapter) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(
      `/api/team/pyq/chapter-view?exam=${selectedExam.id}&subject=${encodeURIComponent(
        selectedSubject
      )}&chapter=${encodeURIComponent(selectedChapter)}`
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setDetail(j.data);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setDetailLoading(false));
  }, [selectedExam.id, selectedSubject, selectedChapter]);

  function refreshCurrent() {
    if (selectedChapter) {
      fetch(
        `/api/team/pyq/chapter-view?exam=${selectedExam.id}&subject=${encodeURIComponent(
          selectedSubject
        )}&chapter=${encodeURIComponent(selectedChapter)}`
      )
        .then((r) => r.json())
        .then((j) => j.success && setDetail(j.data));
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
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col h-[75vh]">
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

        {/* Right: Chapter Detail, Metrics & Question List */}
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
                      {detail.totalQuestions} verified previous year question(s) recorded in database
                    </p>
                  </div>

                  {/* Chapter Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualModal(true)}
                      className="pyq-btn bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <span className="material-symbols-outlined text-sm">add_circle</span>
                      Add Question
                    </button>
                    {canImport && (
                      <Link
                        href={`/team/pyq-library/import?exam=${selectedExam.id}&subject=${encodeURIComponent(
                          detail.subject
                        )}&chapter=${encodeURIComponent(detail.chapter)}`}
                        className="pyq-btn-primary"
                      >
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Upload Chapter PDF
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

              {/* Questions List */}
              <div className="space-y-3">
                {detail.questions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">history_edu</span>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No Questions in {detail.chapter}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Add the first question manually or upload an entire chapter PDF to automatically extract and verify questions.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowManualModal(true)}
                        className="pyq-btn"
                      >
                        + Add Question Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  detail.questions.map((q, idx) => {
                    const translation = q.translations?.[0];
                    const options = (translation?.options || {}) as Record<string, string>;
                    const answers = (translation?.correctOptionIds || []) as string[];
                    const occ = q.pyqOccurrences?.[0];

                    return (
                      <div
                        key={q.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                      >
                        {/* Header Badges */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
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
                            {q.topic && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                                {q.topic}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                q.isPublished
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {q.isPublished ? "Published" : "Draft"}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {q.questionCode || q.id.slice(-6)}
                            </span>
                          </div>
                        </div>

                        {/* Question Statement */}
                        <div className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-relaxed my-2">
                          <FormulaText text={translation?.statement || "(No statement)"} />
                        </div>

                        {/* Question Image */}
                        {q.imageUrl && (
                          <div className="my-2 max-w-sm rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
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
        onSuccess={refreshCurrent}
        defaultExamId={selectedExam.id}
        defaultSubject={selectedSubject}
        defaultChapter={selectedChapter || ""}
        exams={exams}
      />
    </div>
  );
}
