"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface QuestionTranslationData {
  id?: string;
  language: string;
  statement: string;
  options: Record<string, string>;
  correctOptionIds: string[];
  solution?: string | null;
}

interface QuestionReviewData {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  imageUrl: string | null;
  solution: string | null;
  pyqExam: string | null;
  pyqYear: number | null;
  pyqMonth: string | null;
  pyqQuestionNumber: string | null;
  pyqVerificationStatus: string;
  pyqVerifiedAt: string | null;
  pyqVerifiedBy?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  translations: QuestionTranslationData[];
  pyqOccurrences: any[];
  pyqReviews: any[];
  pyqReviewHistories: any[];
}

interface ChecklistState {
  englishStatement: boolean;
  hindiTranslation: boolean;
  allOptions: boolean;
  correctAnswer: boolean;
  explanation: boolean;
  imagesDiagrams: boolean;
  chapterMapping: boolean;
  topic: boolean;
  subtopic: boolean;
  examNameYear: boolean;
}

const DEFAULT_CHECKLIST: ChecklistState = {
  englishStatement: false,
  hindiTranslation: false,
  allOptions: false,
  correctAnswer: false,
  explanation: false,
  imagesDiagrams: false,
  chapterMapping: false,
  topic: false,
  subtopic: false,
  examNameYear: false,
};

interface PyqQuestionReviewModalProps {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  currentUserId?: string;
}

export function PyqQuestionReviewModal({
  questionId,
  open,
  onClose,
  onRefresh,
  currentUserId,
}: PyqQuestionReviewModalProps) {
  const [data, setData] = useState<QuestionReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(questionId);

  // Navigation
  const [nav, setNav] = useState<{
    currentIndex: number;
    totalInChapter: number;
    previousQuestionId: string | null;
    nextQuestionId: string | null;
  }>({
    currentIndex: 1,
    totalInChapter: 1,
    previousQuestionId: null,
    nextQuestionId: null,
  });

  // Edit Mode toggle & form fields
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editSubTopic, setEditSubTopic] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("MEDIUM");
  const [editImageUrl, setEditImageUrl] = useState("");

  // English Edit Fields
  const [enStatement, setEnStatement] = useState("");
  const [enOptions, setEnOptions] = useState<Record<string, string>>({ A: "", B: "", C: "", D: "" });
  const [correctKey, setCorrectKey] = useState("A");
  const [enSolution, setEnSolution] = useState("");

  // Hindi Edit Fields
  const [hiStatement, setHiStatement] = useState("");
  const [hiOptions, setHiOptions] = useState<Record<string, string>>({ A: "", B: "", C: "", D: "" });
  const [hiSolution, setHiSolution] = useState("");

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistState>(DEFAULT_CHECKLIST);

  // Flag & Comment Drawer
  const [showFlagDrawer, setShowFlagDrawer] = useState(false);
  const [flaggedIssue, setFlaggedIssue] = useState("ANSWER_KEY_WRONG");
  const [reviewComments, setReviewComments] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setActiveQuestionId(questionId);
  }, [questionId]);

  useEffect(() => {
    if (!open || !activeQuestionId) return;

    setLoading(true);
    fetch(`/api/team/pyq/questions/${activeQuestionId}/review`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const q = json.data.question as QuestionReviewData;
          setData(q);
          setNav(json.data.navigation || { currentIndex: 1, totalInChapter: 1, previousQuestionId: null, nextQuestionId: null });

          // Initialize form state
          setEditSubject(q.subject || "");
          setEditChapter(q.chapter || "");
          setEditTopic(q.topic || "");
          setEditSubTopic(q.subTopic || "");
          setEditDifficulty(q.difficulty || "MEDIUM");
          setEditImageUrl(q.imageUrl || "");

          const en = q.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
          const hi = q.translations.find((t) => t.language.toUpperCase() === "HINDI");

          setEnStatement(en?.statement || "");
          setEnOptions(
            en?.options && typeof en.options === "object"
              ? (en.options as Record<string, string>)
              : { A: "", B: "", C: "", D: "" }
          );
          setCorrectKey(en?.correctOptionIds?.[0] || "A");
          setEnSolution(en?.solution || q.solution || "");

          setHiStatement(hi?.statement || "");
          setHiOptions(
            hi?.options && typeof hi.options === "object"
              ? (hi.options as Record<string, string>)
              : { A: "", B: "", C: "", D: "" }
          );
          setHiSolution(hi?.solution || "");

          // Load previous checklist if available or reset
          const savedChecklist = q.pyqReviews?.[0]?.checklistData as ChecklistState | undefined;
          if (savedChecklist && typeof savedChecklist === "object") {
            setChecklist(savedChecklist);
          } else if (q.pyqVerificationStatus === "VERIFIED") {
            // Already verified: all checked
            setChecklist({
              englishStatement: true,
              hindiTranslation: true,
              allOptions: true,
              correctAnswer: true,
              explanation: true,
              imagesDiagrams: true,
              chapterMapping: true,
              topic: true,
              subtopic: true,
              examNameYear: true,
            });
          } else {
            setChecklist(DEFAULT_CHECKLIST);
          }

          setIsEditing(false);
          setShowFlagDrawer(false);
          setReviewComments("");
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, activeQuestionId]);

  if (!open) return null;

  const allChecksPassed = Object.values(checklist).every(Boolean);
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  function toggleCheck(key: keyof ChecklistState) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function markAllChecks() {
    setChecklist({
      englishStatement: true,
      hindiTranslation: true,
      allOptions: true,
      correctAnswer: true,
      explanation: true,
      imagesDiagrams: true,
      chapterMapping: true,
      topic: true,
      subtopic: true,
      examNameYear: true,
    });
  }

  async function handleDecision(action: "VERIFY" | "NEEDS_CORRECTION" | "SAVE_LATER") {
    if (!activeQuestionId) return;

    if (action === "VERIFY" && !allChecksPassed) {
      toast.error("All 10 verification checklist items must be verified before approving.");
      return;
    }

    if (action === "NEEDS_CORRECTION" && !reviewComments.trim()) {
      toast.error("Please provide comments explaining what needs correction.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        action,
        checklistData: checklist,
        reviewComments: reviewComments || undefined,
        flaggedIssue: action === "NEEDS_CORRECTION" ? flaggedIssue : undefined,
        correctionsNeeded: action === "NEEDS_CORRECTION" ? reviewComments : undefined,
      };

      // If edits were made, include edited question payload
      if (isEditing) {
        payload.editedQuestion = {
          subject: editSubject,
          chapter: editChapter,
          topic: editTopic,
          subTopic: editSubTopic,
          difficulty: editDifficulty,
          imageUrl: editImageUrl || null,
          solution: enSolution,
          english: {
            statement: enStatement,
            options: enOptions,
            correctOptionIds: [correctKey],
            solution: enSolution,
          },
          hindi: {
            statement: hiStatement,
            options: hiOptions,
            correctOptionIds: [correctKey],
            solution: hiSolution,
          },
        };
      }

      const res = await fetch(`/api/team/pyq/questions/${activeQuestionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Action failed");
      }

      toast.success(json.data?.message || "Review decision recorded!");
      onRefresh();

      // If there is a next question, automatically advance!
      if (action === "VERIFY" && nav.nextQuestionId) {
        setActiveQuestionId(nav.nextQuestionId);
      } else {
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to record review decision");
    } finally {
      setSubmitting(false);
    }
  }

  const occ = data?.pyqOccurrences?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-6xl w-full h-[94vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-black bg-blue-600 text-white px-2.5 py-1 rounded-xl">
              Q.{nav.currentIndex} of {nav.totalInChapter}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {occ ? `${occ.exam?.name} ${occ.year}` : data?.pyqExam ? `${data.pyqExam} ${data.pyqYear}` : "PYQ Review"}
                </h3>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {data?.questionCode || data?.id.slice(-6)}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    data?.pyqVerificationStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : data?.pyqVerificationStatus === "NEEDS_CORRECTION"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : data?.pyqVerificationStatus === "IN_REVIEW"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  {data?.pyqVerificationStatus || "UNVERIFIED"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {data?.subject} • {data?.chapter} {data?.topic ? `• ${data.topic}` : ""}
              </p>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-2">
            {/* Sibling Navigation */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => nav.previousQuestionId && setActiveQuestionId(nav.previousQuestionId)}
                disabled={!nav.previousQuestionId || loading || submitting}
                className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition flex items-center gap-1 text-xs font-bold"
                title="Previous Question"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => nav.nextQuestionId && setActiveQuestionId(nav.nextQuestionId)}
                disabled={!nav.nextQuestionId || loading || submitting}
                className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition flex items-center gap-1 text-xs font-bold"
                title="Next Question"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            {/* Toggle Edit Mode */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isEditing
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isEditing ? "visibility" : "edit"}
              </span>
              <span>{isEditing ? "Preview Mode" : "Edit Question"}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Workspace */}
        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-blue-600 animate-spin">refresh</span>
              <p className="text-xs font-bold text-slate-400">Loading full question data and translations…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Quick Metadata Bar (Topic / Subtopic / Difficulty / Exam) */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Topic:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      placeholder="e.g. Taxonomic Categories"
                      className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold w-48"
                    />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200">{data.topic || "—"}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Subtopic:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editSubTopic}
                      onChange={(e) => setEditSubTopic(e.target.value)}
                      placeholder="e.g. Binomial Nomenclature"
                      className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold w-48"
                    />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200">{data.subTopic || "—"}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Difficulty:</span>
                  {isEditing ? (
                    <select
                      value={editDifficulty}
                      onChange={(e) => setEditDifficulty(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200">{data.difficulty}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Correct Key:</span>
                  {isEditing ? (
                    <select
                      value={correctKey}
                      onChange={(e) => setCorrectKey(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-950 font-mono font-bold text-emerald-800 dark:text-emerald-200 text-xs"
                    >
                      {["A", "B", "C", "D"].map((opt) => (
                        <option key={opt} value={opt}>Option ({opt})</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
                      ({correctKey})
                    </span>
                  )}
                </div>
              </div>

              {/* Reviewer / Assignee badge */}
              <div className="text-[11px] text-slate-500">
                {data.assignedTo?.name ? (
                  <span>Assigned to <strong className="text-slate-700 dark:text-slate-300">{data.assignedTo.name}</strong></span>
                ) : (
                  <span className="text-amber-600 font-semibold">Unassigned</span>
                )}
              </div>
            </div>

            {/* Bilingual Side-by-Side Question Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: English Version */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      English Statement &amp; Options
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Primary Language</span>
                </div>

                {/* Statement */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Question Statement
                  </label>
                  {isEditing ? (
                    <textarea
                      value={enStatement}
                      onChange={(e) => setEnStatement(e.target.value)}
                      rows={4}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  ) : (
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <FormulaText text={enStatement || "(No statement)"} />
                    </div>
                  )}
                </div>

                {/* Question Image (if any) */}
                {(data.imageUrl || isEditing) && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Figure / Diagram Image
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        placeholder="Image URL (e.g. /uploads/plant_kingdom_q19.png)"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                      />
                    ) : null}
                    {(editImageUrl || data.imageUrl) && (
                      <div className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editImageUrl || data.imageUrl || ""}
                          alt="Question figure"
                          className="w-full max-h-48 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* English Options */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Options (A, B, C, D)
                  </label>
                  {["A", "B", "C", "D"].map((opt) => {
                    const isAns = correctKey === opt;
                    return (
                      <div
                        key={opt}
                        className={`p-2.5 rounded-xl border text-xs transition ${
                          isAns
                            ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                            : "bg-slate-50/40 border-slate-200/80 dark:bg-slate-950/40 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => isEditing && setCorrectKey(opt)}
                            className={`w-6 h-6 rounded-lg font-mono font-bold text-[11px] shrink-0 flex items-center justify-center transition ${
                              isAns
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                            }`}
                            title={isEditing ? `Click to mark (${opt}) as correct answer` : undefined}
                          >
                            ({opt})
                          </button>
                          <div className="flex-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={enOptions[opt] || ""}
                                onChange={(e) =>
                                  setEnOptions({ ...enOptions, [opt]: e.target.value })
                                }
                                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                              />
                            ) : (
                              <div className="text-slate-800 dark:text-slate-200 font-medium">
                                <FormulaText text={enOptions[opt] || "—"} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* English Solution */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Explanation / Solution (English)
                  </label>
                  {isEditing ? (
                    <textarea
                      value={enSolution}
                      onChange={(e) => setEnSolution(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  ) : (
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <FormulaText text={enSolution || "(No solution provided)"} />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Hindi Version */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Hindi Statement &amp; Options (हिंदी अनुवाद)
                    </h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hiStatement ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                    {hiStatement ? "Hindi Available ✓" : "Hindi Missing ✕"}
                  </span>
                </div>

                {/* Statement Hindi */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    प्रश्न कथन (Hindi Statement)
                  </label>
                  {isEditing ? (
                    <textarea
                      value={hiStatement}
                      onChange={(e) => setHiStatement(e.target.value)}
                      placeholder="हिंदी प्रश्न कथन दर्ज करें..."
                      rows={4}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-emerald-500 resize-y"
                    />
                  ) : (
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <FormulaText text={hiStatement || "(हिंदी अनुवाद उपलब्ध नहीं है)"} />
                    </div>
                  )}
                </div>

                {/* Hindi Options */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    विकल्प (Options A, B, C, D)
                  </label>
                  {["A", "B", "C", "D"].map((opt) => {
                    const isAns = correctKey === opt;
                    return (
                      <div
                        key={opt}
                        className={`p-2.5 rounded-xl border text-xs transition ${
                          isAns
                            ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                            : "bg-slate-50/40 border-slate-200/80 dark:bg-slate-950/40 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono font-bold text-[11px] shrink-0 flex items-center justify-center ${
                              isAns
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            ({opt})
                          </span>
                          <div className="flex-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={hiOptions[opt] || ""}
                                onChange={(e) =>
                                  setHiOptions({ ...hiOptions, [opt]: e.target.value })
                                }
                                placeholder={`विकल्प (${opt}) हिंदी में...`}
                                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                              />
                            ) : (
                              <div className="text-slate-800 dark:text-slate-200 font-medium">
                                <FormulaText text={hiOptions[opt] || "—"} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hindi Solution */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    व्याख्या / हल (Hindi Solution)
                  </label>
                  {isEditing ? (
                    <textarea
                      value={hiSolution}
                      onChange={(e) => setHiSolution(e.target.value)}
                      placeholder="हिंदी व्याख्या दर्ज करें..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-emerald-500 resize-y"
                    />
                  ) : (
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <FormulaText text={hiSolution || "(हिंदी व्याख्या उपलब्ध नहीं है)"} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mandatory 10-Point Verification Checklist */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">checklist</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      Mandatory Verification Checklist
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${allChecksPassed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                        {checkedCount} / 10 Verified
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      All 10 checks must be explicitly confirmed by reviewer before final approval.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={markAllChecks}
                  className="self-start sm:self-auto px-3 py-1 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 transition"
                >
                  Mark All 10 Checked
                </button>
              </div>

              {/* Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                {[
                  { key: "englishStatement" as const, label: "1. English Statement Verified", desc: "Scientific phrasing & symbols" },
                  { key: "hindiTranslation" as const, label: "2. Hindi Translation Verified", desc: "Grammar & Hindi terminology" },
                  { key: "allOptions" as const, label: "3. All Options Verified", desc: "A, B, C, D complete & matched" },
                  { key: "correctAnswer" as const, label: "4. Correct Answer Key Verified", desc: "Official key match" },
                  { key: "explanation" as const, label: "5. Explanation Verified", desc: "Step-by-step logic correct" },
                  { key: "imagesDiagrams" as const, label: "6. Images & Diagrams Verified", desc: "Clarity, cropping & labels" },
                  { key: "chapterMapping" as const, label: "7. Chapter Mapping Verified", desc: "Class 11/12 NCERT mapping" },
                  { key: "topic" as const, label: "8. Topic Verified", desc: "Topic tag accurately classified" },
                  { key: "subtopic" as const, label: "9. Subtopic Verified", desc: "Micro-concept correctly assigned" },
                  { key: "examNameYear" as const, label: "10. Exam Name & Year Verified", desc: "Year, shift & paper verified" },
                ].map((item) => {
                  const isChecked = checklist[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleCheck(item.key)}
                      className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                        isChecked
                          ? "bg-emerald-50/80 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200"
                          : "bg-slate-50/40 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-400 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isChecked && <span className="material-symbols-outlined text-[12px]">check</span>}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-[11px] block truncate">{item.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flag / Correction Comments (when toggled or if flagged previously) */}
            {(showFlagDrawer || data.pyqVerificationStatus === "NEEDS_CORRECTION") && (
              <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">flag</span>
                    Flag Issue / Correction Notes
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowFlagDrawer(false)}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Hide
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      Issue Category
                    </label>
                    <select
                      value={flaggedIssue}
                      onChange={(e) => setFlaggedIssue(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="ANSWER_KEY_WRONG">Incorrect Answer Key</option>
                      <option value="TRANSLATION_INCORRECT">Hindi Translation Error</option>
                      <option value="DIAGRAM_MISSING">Diagram / Figure Missing or Blurry</option>
                      <option value="EXPLANATION_WRONG">Explanation / Solution Error</option>
                      <option value="TOPIC_MISMATCH">Incorrect Chapter / Topic Tag</option>
                      <option value="QUESTION_AMBIGUOUS">Typo / Ambiguous Question</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      Detailed Correction Instructions
                    </label>
                    <textarea
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder="Explain what needs to be fixed..."
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Audit History Drawer Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-slate-500 font-bold hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>{showHistory ? "Hide Audit History" : "View Complete Verification & Change History"}</span>
              </button>

              {showHistory && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                  <h5 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-2">
                    Verification Audit Trail ({data.pyqReviewHistories.length} entries)
                  </h5>
                  {data.pyqReviewHistories.length === 0 ? (
                    <p className="text-slate-400 text-xs">No prior review history recorded.</p>
                  ) : (
                    data.pyqReviewHistories.map((h: any) => (
                      <div
                        key={h.id}
                        className="flex items-start justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-none"
                      >
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">[{h.action}]</span>
                          <span className="text-slate-700 dark:text-slate-300">{h.comments || "Status update"}</span>
                          {h.reviewer?.name && (
                            <span className="text-slate-400 ml-2">by {h.reviewer.name}</span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Action Bar (Sticky Footer) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFlagDrawer(!showFlagDrawer)}
              className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 dark:text-rose-400 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">flag</span>
              <span>Needs Correction</span>
            </button>

            <button
              type="button"
              onClick={() => handleDecision("SAVE_LATER")}
              disabled={submitting}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">bookmark</span>
              <span>Save &amp; Continue Later</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 transition"
            >
              Close
            </button>

            {showFlagDrawer ? (
              <button
                type="button"
                onClick={() => handleDecision("NEEDS_CORRECTION")}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
              >
                {submitting && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
                <span>Submit Flag / Correction</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDecision("VERIFY")}
                disabled={submitting || !allChecksPassed}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition shadow-sm flex items-center gap-2 ${
                  allChecksPassed
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
                title={allChecksPassed ? "Confirm all 10 checks and mark verified" : "All 10 checks must be marked to approve"}
              >
                {submitting ? (
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                )}
                <span>Approve &amp; Verify Question</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
