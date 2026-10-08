"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileQuestion,
  Sparkles,
  Plus,
  Send,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Check,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Brain,
  Edit2,
  CheckSquare,
  Square,
  MessageSquare,
  Flame,
  FileText,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface LiveStats {
  total: number;
  aiAudited: number;
  reviewed: number;
  pendingReview: number;
  published: number;
  revision: number;
  rework: number;
  draft: number;
  review1: number;
  review2: number;
  rejected?: number;
}

interface QuestionAssignmentItem {
  id: string;
  title: string;
  description?: string | null;
  subject: string;
  chapter: string;
  topic?: string | null;
  targetCount: number;
  difficulty?: string | null;
  status: string;
  dueDate?: string | null;
  instructions?: string | null;
  notes?: string | null;
  assignedTo: { id: string; name: string; email: string };
  assignedBy?: { id: string; name: string };
  createdAt: string;
  liveStats: LiveStats;
}

interface FacultyUser {
  id: string;
  name: string;
  email: string;
}

export function MyQuestionBankDashboard({
  initialAssignments,
  isAssignAdmin,
  currentUserId,
  facultyList,
}: {
  initialAssignments: QuestionAssignmentItem[];
  isAssignAdmin: boolean;
  currentUserId: string;
  facultyList: FacultyUser[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<QuestionAssignmentItem[]>(initialAssignments);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [viewAll, setViewAll] = useState(isAssignAdmin);

  // Selected Chapter for Chapter Review Dashboard
  const [selectedChapterAssignment, setSelectedChapterAssignment] = useState<QuestionAssignmentItem | null>(null);
  const [chapterWorkflowStage, setChapterWorkflowStage] = useState<
    "ai_audit" | "review1" | "review2" | "publish" | "live" | "revision" | "rework"
  >("ai_audit");

  // Chapter Questions State
  const [chapterQuestions, setChapterQuestions] = useState<any[]>([]);
  const [chapterQuestionsLoading, setChapterQuestionsLoading] = useState(false);
  const [chapterFilterType, setChapterFilterType] = useState<string>("ALL");
  const [chapterFilterDifficulty, setChapterFilterDifficulty] = useState<string>("ALL");
  const [chapterFilterExamLevel, setChapterFilterExamLevel] = useState<string>("ALL");
  const [chapterFilterTopic, setChapterFilterTopic] = useState<string>("ALL");
  const [onlyLowQuality, setOnlyLowQuality] = useState(false);

  // Chapter AI Audit Running State
  const [auditingChapter, setAuditingChapter] = useState(false);
  const [auditProgressMessage, setAuditProgressMessage] = useState<string | null>(null);

  // Batch Selection in Chapter Dashboard
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Create Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSubject, setAssignSubject] = useState("Biology");
  const [assignChapter, setAssignChapter] = useState("");
  const [assignFacultyId, setAssignFacultyId] = useState(facultyList[0]?.id || currentUserId);
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [availableChapters, setAvailableChapters] = useState<Array<{ id: string; title: string }>>([]);

  // Fetch chapters whenever assignSubject changes
  useEffect(() => {
    if (showAssignModal && assignSubject) {
      fetch(`/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(assignSubject)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.chapters) {
            setAvailableChapters(d.data.chapters);
            if (d.data.chapters.length > 0) {
              setAssignChapter(d.data.chapters[0].title);
            }
          }
        })
        .catch(() => {});
    }
  }, [showAssignModal, assignSubject]);

  // Refresh assignments
  const refreshAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/questions/assignments?viewAll=${viewAll}`);
      const data = await res.json();
      if (data?.data?.assignments) {
        setAssignments(data.data.assignments);
      }
    } catch (err) {
      console.error("Failed to load assignments", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch questions for selected chapter
  const fetchChapterQuestions = async (assignment: QuestionAssignmentItem) => {
    setChapterQuestionsLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("subject", assignment.subject);
      query.set("chapter", assignment.chapter);
      query.set("limit", "200");

      if (chapterWorkflowStage === "review1") {
        query.set("status", "REVIEW_1");
      } else if (chapterWorkflowStage === "review2") {
        query.set("status", "REVIEW_2");
      } else if (chapterWorkflowStage === "publish" || chapterWorkflowStage === "live") {
        query.set("status", "PUBLISHED");
      } else if (chapterWorkflowStage === "revision") {
        query.set("status", "REJECTED");
      } else if (chapterWorkflowStage === "rework") {
        query.set("correctionStatus", "REWORK");
      }

      if (chapterFilterDifficulty !== "ALL") query.set("difficulty", chapterFilterDifficulty);
      if (chapterFilterType !== "ALL") query.set("type", chapterFilterType);
      if (chapterFilterTopic !== "ALL") query.set("topic", chapterFilterTopic);

      const res = await fetch(`/api/team/questions?${query.toString()}`);
      const data = await res.json();
      if (data?.data?.questions) {
        let qs = data.data.questions;
        if (onlyLowQuality) {
          qs = qs.filter((q: any) => (q.aiAuditScore ?? 100) < 70);
        }
        setChapterQuestions(qs);
      } else {
        setChapterQuestions([]);
      }
    } catch (err) {
      console.error("Failed to load chapter questions", err);
    } finally {
      setChapterQuestionsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChapterAssignment) {
      fetchChapterQuestions(selectedChapterAssignment);
    }
  }, [
    selectedChapterAssignment,
    chapterWorkflowStage,
    chapterFilterDifficulty,
    chapterFilterType,
    chapterFilterTopic,
    onlyLowQuality,
  ]);

  // Handle Create Assignment Form Submit
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSubject || !assignChapter || !assignFacultyId) {
      toast.error("Please fill in Subject, Chapter, and Faculty.");
      return;
    }

    setAssigningLoading(true);
    try {
      const res = await fetch("/api/team/questions/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: assignSubject,
          chapter: assignChapter,
          assignedToId: assignFacultyId,
          instructions: assignInstructions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Assigned entire chapter '${assignChapter}' for review!`);
        setShowAssignModal(false);
        setAssignInstructions("");
        await refreshAssignments();
      } else {
        toast.error(data.error?.message || "Failed to assign chapter");
      }
    } catch {
      toast.error("Network error while creating assignment");
    } finally {
      setAssigningLoading(false);
    }
  };

  // Run AI Audit on Entire Chapter
  const handleRunChapterAiAudit = async () => {
    if (!selectedChapterAssignment) return;
    setAuditingChapter(true);
    setAuditProgressMessage(`Auditing ${selectedChapterAssignment.chapter}...`);
    try {
      const res = await fetch("/api/team/questions/audit-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedChapterAssignment.subject,
          chapter: selectedChapterAssignment.chapter,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Chapter AI Audit completed!");
        setAuditProgressMessage(null);
        await fetchChapterQuestions(selectedChapterAssignment);
        await refreshAssignments();
      } else {
        toast.error(data.error?.message || "AI Audit encountered issues");
      }
    } catch {
      toast.error("Network error executing Chapter AI Audit");
    } finally {
      setAuditingChapter(false);
      setAuditProgressMessage(null);
    }
  };

  // Batch Review Decision (Stage 1 / Stage 2)
  const handleBatchReviewDecision = async (stage: "REVIEW_1" | "REVIEW_2", status: "APPROVED" | "REJECTED") => {
    if (selectedQuestionIds.length === 0) {
      toast.error("Please select at least one question");
      return;
    }

    setBatchActionLoading(true);
    try {
      const res = await fetch("/api/team/questions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: selectedQuestionIds,
          stage,
          status,
          notes: `Batch ${status} decision from Chapter Review Dashboard`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Processed ${selectedQuestionIds.length} questions as ${status}`);
        setSelectedQuestionIds([]);
        if (selectedChapterAssignment) await fetchChapterQuestions(selectedChapterAssignment);
        await refreshAssignments();
      } else {
        toast.error(data.error?.message || "Failed to process batch review");
      }
    } catch {
      toast.error("Error during batch review processing");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === chapterQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(chapterQuestions.map((q) => q.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedQuestionIds.includes(id)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((x) => x !== id));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, id]);
    }
  };

  const subjects = ["ALL", "BIOLOGY", "PHYSICS", "CHEMISTRY", "MATHEMATICS"];

  const filteredAssignments = assignments.filter((a) => {
    const matchSearch =
      a.chapter.toLowerCase().includes(search.toLowerCase()) ||
      a.subject.toLowerCase().includes(search.toLowerCase()) ||
      a.assignedTo.name.toLowerCase().includes(search.toLowerCase());
    const matchSubject = selectedSubject === "ALL" || a.subject.toUpperCase() === selectedSubject.toUpperCase();
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP HEADER & ASSIGN ACTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900">
            <FileQuestion className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              My Question Bank
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Assigned Chapters • AI Audit First • 2-Stage Verification Workflow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAssignAdmin && (
            <button
              onClick={() => setViewAll(!viewAll)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                viewAll
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {viewAll ? "All Faculty Tasks" : "My Assigned Tasks"}
            </button>
          )}

          <button
            onClick={() => refreshAssignments()}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {isAssignAdmin && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Chapter for Review</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN VIEW: CHAPTER REVIEW DASHBOARD OR ASSIGNED CHAPTERS LIST */}
      {selectedChapterAssignment ? (
        /* CHAPTER REVIEW DASHBOARD */
        <div className="space-y-6">
          {/* Back button and Chapter Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedChapterAssignment(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Assigned Chapters</span>
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {selectedChapterAssignment.subject}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {selectedChapterAssignment.chapter}
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Assigned to: <b>{selectedChapterAssignment.assignedTo.name}</b> • Total questions:{" "}
                  <b>{selectedChapterAssignment.liveStats?.total || 0}</b>
                </p>
              </div>

              {/* Action: Run AI Audit */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  disabled={auditingChapter}
                  onClick={handleRunChapterAiAudit}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Brain className={`w-4 h-4 ${auditingChapter ? "animate-spin" : ""}`} />
                  <span>{auditingChapter ? "Auditing Chapter..." : "Run AI Audit on Chapter"}</span>
                </button>

                <Link
                  href={`/team/questions/new?subject=${encodeURIComponent(selectedChapterAssignment.subject)}&chapter=${encodeURIComponent(selectedChapterAssignment.chapter)}`}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Author Question</span>
                </Link>
              </div>
            </div>

            {/* TOP REVIEW PROGRESS METRICS */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-3">
                Review Progress
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block">TOTAL</span>
                  <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {selectedChapterAssignment.liveStats?.total || 0}
                  </span>
                </div>

                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50">
                  <span className="text-[10px] font-bold text-purple-600 block">AI VERIFIED</span>
                  <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                    {selectedChapterAssignment.liveStats?.aiAudited || 0}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[10px] font-bold text-indigo-600 block">REVIEWED</span>
                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                    {selectedChapterAssignment.liveStats?.reviewed || 0}
                  </span>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/50">
                  <span className="text-[10px] font-bold text-amber-600 block">PENDING</span>
                  <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                    {selectedChapterAssignment.liveStats?.pendingReview || 0}
                  </span>
                </div>

                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                  <span className="text-[10px] font-bold text-rose-600 block">REVISION</span>
                  <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                    {selectedChapterAssignment.liveStats?.revision || 0}
                  </span>
                </div>

                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                  <span className="text-[10px] font-bold text-rose-600 block">REWORK</span>
                  <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                    {selectedChapterAssignment.liveStats?.rework || 0}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[10px] font-bold text-emerald-600 block">PUBLISHED</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {selectedChapterAssignment.liveStats?.published || 0}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[10px] font-bold text-emerald-600 block">LIVE</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {selectedChapterAssignment.liveStats?.published || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* STAGE TABS: 1. AI Audit -> 2. Review 1 -> 3. Review 2 -> 4. Publish -> 5. Live -> 6. Revision -> 7. Rework */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
              {[
                { id: "ai_audit", label: "1. AI Audit", icon: Brain },
                { id: "review1", label: "2. Review 1 (SME)", icon: UserCheck },
                { id: "review2", label: "3. Review 2 (Quality)", icon: ShieldCheck },
                { id: "publish", label: "4. Publish", icon: CheckCircle2 },
                { id: "live", label: "5. Live", icon: Flame },
                { id: "revision", label: "6. Revision", icon: AlertCircle },
                { id: "rework", label: "7. Rework", icon: AlertTriangle },
              ].map((st) => {
                const Icon = st.icon;
                const active = chapterWorkflowStage === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setChapterWorkflowStage(st.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Filters Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOnlyLowQuality(!onlyLowQuality)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    onlyLowQuality
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Quality (&lt; 70 AI Score)</span>
                </button>

                <select
                  value={chapterFilterDifficulty}
                  onChange={(e) => setChapterFilterDifficulty(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                >
                  <option value="ALL">All Difficulties</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>

                <select
                  value={chapterFilterType}
                  onChange={(e) => setChapterFilterType(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                >
                  <option value="ALL">All Types</option>
                  <option value="SINGLE_CORRECT">Single Correct</option>
                  <option value="MULTIPLE_CORRECT">Multiple Correct</option>
                  <option value="ASSERTION_REASON">Assertion-Reason</option>
                  <option value="MATCH_THE_COLUMN">Match Column</option>
                  <option value="DIAGRAM_BASED">Diagram Based</option>
                </select>
              </div>

              {/* Batch Action Toolbar */}
              {selectedQuestionIds.length > 0 && (
                <div className="flex items-center gap-2">
                  {chapterWorkflowStage === "review1" && (
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_1", "APPROVED")}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Approve to Stage 2 ({selectedQuestionIds.length})
                    </button>
                  )}

                  {chapterWorkflowStage === "review2" && (
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_2", "APPROVED")}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Publish to Live ({selectedQuestionIds.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chapter Questions List */}
          {chapterQuestionsLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-500">Loading questions...</p>
            </div>
          ) : chapterQuestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No questions pending in this stage
              </h3>
              <p className="text-xs text-slate-400 mt-1">All questions in this pipeline have been processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 text-xs text-slate-500 font-semibold">
                <button onClick={toggleSelectAll} className="flex items-center gap-1.5 cursor-pointer">
                  {selectedQuestionIds.length > 0 && selectedQuestionIds.length === chapterQuestions.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select All ({selectedQuestionIds.length}/{chapterQuestions.length})</span>
                </button>
                <span>Showing {chapterQuestions.length} questions</span>
              </div>

              {chapterQuestions.map((q) => {
                const primaryT =
                  q.translations?.find((t: any) => t.language === "ENGLISH") || q.translations?.[0];
                const isSelected = selectedQuestionIds.includes(q.id);
                const canonicalId = q.questionCode || `Q-${q.id.slice(0, 8)}`;

                return (
                  <div
                    key={q.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(q.id)}
                          className="mt-1 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {canonicalId}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {q.type}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {q.difficulty}
                            </span>

                            {/* AI Score Badge */}
                            {q.aiVerified ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                AI: {q.aiAuditScore ?? 85}/100
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                AI Pending
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-900 dark:text-white line-clamp-2">
                            <FormulaText text={primaryT?.statement || "No statement text"} />
                          </div>

                          {q.review1Notes && (
                            <div className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-2 rounded-xl border border-amber-200">
                              <b>Review 1 Note:</b> {q.review1Notes}
                            </div>
                          )}
                        </div>
                      </div>

                        {/* Action: Open FULL REVIEW SCREEN (WITH NEXT/PREV & PREVIEW SUPPORT) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/team/questions/${q.id}/review?subject=${encodeURIComponent(selectedChapterAssignment.subject)}&chapter=${encodeURIComponent(selectedChapterAssignment.chapter)}`}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review &amp; Audit</span>
                          </Link>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ASSIGNED CHAPTERS LIST */
        <div className="space-y-6">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search chapter, subject or faculty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSubject(s)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedSubject === s
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Chapter Cards */}
          {filteredAssignments.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No assigned chapters found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {isAssignAdmin
                  ? "Click 'Assign Chapter for Review' above to assign an entire chapter to faculty."
                  : "No question review tasks are assigned to you currently. Check back later or contact your Academic Head."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssignments.map((a) => {
                const stats = a.liveStats;
                const totalQ = stats?.total || 0;
                const publishedQ = stats?.published || 0;
                const progressPct = totalQ > 0 ? Math.min(100, Math.round((publishedQ / totalQ) * 100)) : 0;

                return (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {a.subject}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {totalQ} Questions
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-3 line-clamp-1">
                        {a.chapter}
                      </h3>

                      {a.instructions && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 italic">
                          "{a.instructions}"
                        </p>
                      )}

                      {/* Live Status Metrics Matrix */}
                      <div className="grid grid-cols-4 gap-1.5 mt-4 text-center">
                        <div className="bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl">
                          <span className="block text-[9px] text-purple-600 font-bold">AI AUDIT</span>
                          <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                            {stats?.aiAudited || 0}
                          </span>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-xl">
                          <span className="block text-[9px] text-indigo-600 font-bold">REVIEWED</span>
                          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                            {stats?.reviewed || 0}
                          </span>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl">
                          <span className="block text-[9px] text-rose-600 font-bold">REVISION</span>
                          <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                            {stats?.revision || 0}
                          </span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl">
                          <span className="block text-[9px] text-emerald-600 font-bold">LIVE</span>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {stats?.published || 0}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                        Reviewer: <b className="text-slate-800 dark:text-slate-200">{a.assignedTo.name}</b>
                      </div>
                    </div>

                    {/* Action Button: Open Chapter Review Dashboard */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChapterAssignment(a);
                        setChapterWorkflowStage("ai_audit");
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Review Dashboard</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. ASSIGN CHAPTER MODAL (SUBJECT -> CHAPTER -> FACULTY -> INSTRUCTIONS) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Assign Chapter Question Review
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign an entire chapter's questions to a faculty reviewer.
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              {/* Field 1: Subject (Dropdown) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <select
                  value={assignSubject}
                  onChange={(e) => setAssignSubject(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Biology">Biology</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
              </div>

              {/* Field 2: Chapter (Dropdown dynamically populated) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chapter *
                </label>
                <select
                  value={assignChapter}
                  onChange={(e) => setAssignChapter(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableChapters.map((ch) => (
                    <option key={ch.id} value={ch.title}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Faculty / Team Member (Dropdown) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty / Team Member *
                </label>
                <select
                  value={assignFacultyId}
                  onChange={(e) => setAssignFacultyId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 4: Instructions (Optional Textarea) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="e.g. Review all questions according to NEET standards and verify NCERT diagrams."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningLoading || !assignChapter}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{assigningLoading ? "Assigning..." : "Assign Entire Chapter"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
