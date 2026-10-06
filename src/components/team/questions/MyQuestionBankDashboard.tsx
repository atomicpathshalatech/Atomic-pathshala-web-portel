"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { ChapterAuditModal } from "@/components/team-portal/ChapterAuditModal";
import { QuestionReviewWorkspaceModal, QuestionReviewData } from "@/components/team-portal/QuestionReviewWorkspaceModal";

interface LiveStats {
  total: number;
  draft: number;
  review1: number;
  review2: number;
  published: number;
  rejected: number;
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
  const [activeTab, setActiveTab] = useState<"assignments" | "review1" | "review2" | "revision" | "audit">("assignments");
  const [assignments, setAssignments] = useState<QuestionAssignmentItem[]>(initialAssignments);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [viewAll, setViewAll] = useState(isAssignAdmin);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Review Queue State
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<QuestionReviewData | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Audit Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTarget, setAuditTarget] = useState<{ subject: string; chapter: string }>({
    subject: "Biology",
    chapter: initialAssignments[0]?.chapter || "Cell Cycle and Cell Division",
  });

  // Assignment Create Form State
  const [formData, setFormData] = useState({
    title: "",
    subject: "Biology",
    chapter: "",
    topic: "",
    targetCount: 50,
    difficulty: "MEDIUM",
    assignedToId: facultyList[0]?.id || currentUserId,
    dueDate: "",
    notes: "",
  });

  // Fetch updated assignments
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

  // Fetch Review Queue Questions based on active tab
  const fetchReviewQueue = async () => {
    setReviewLoading(true);
    try {
      const statusParam =
        activeTab === "review1"
          ? "REVIEW_1"
          : activeTab === "review2"
          ? "REVIEW_2"
          : activeTab === "revision"
          ? "REJECTED"
          : "";

      if (!statusParam) {
        setReviewLoading(false);
        return;
      }

      const query = new URLSearchParams();
      query.set("status", statusParam);
      if (selectedSubject !== "ALL") query.set("subject", selectedSubject);
      if (search) query.set("search", search);
      query.set("limit", "50");

      const res = await fetch(`/api/team/questions?${query.toString()}`);
      const data = await res.json();
      if (data?.data?.questions) {
        setReviewQuestions(data.data.questions);
      } else {
        setReviewQuestions([]);
      }
    } catch (err) {
      console.error("Failed to load review queue", err);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    refreshAssignments();
  }, [viewAll]);

  useEffect(() => {
    if (activeTab === "review1" || activeTab === "review2" || activeTab === "revision") {
      fetchReviewQueue();
    }
  }, [activeTab, selectedSubject, search]);

  // Aggregate global stats across all displayed assignments
  const totalAssignedQuestions = assignments.reduce((acc, a) => acc + (a.targetCount || 0), 0);
  const totalCreatedQuestions = assignments.reduce((acc, a) => acc + (a.liveStats?.total || 0), 0);
  const totalReview1Pending = assignments.reduce((acc, a) => acc + (a.liveStats?.review1 || 0), 0);
  const totalReview2Pending = assignments.reduce((acc, a) => acc + (a.liveStats?.review2 || 0), 0);
  const totalPublished = assignments.reduce((acc, a) => acc + (a.liveStats?.published || 0), 0);
  const totalRejected = assignments.reduce((acc, a) => acc + (a.liveStats?.rejected || 0), 0);

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.chapter.toLowerCase().includes(search.toLowerCase()) ||
      a.subject.toLowerCase().includes(search.toLowerCase()) ||
      (a.topic && a.topic.toLowerCase().includes(search.toLowerCase()));

    const matchSubject = selectedSubject === "ALL" || a.subject.toUpperCase() === selectedSubject.toUpperCase();
    return matchSearch && matchSubject;
  });

  const subjects = ["ALL", "BIOLOGY", "PHYSICS", "CHEMISTRY", "MATHEMATICS"];

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/team/questions/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          title: "",
          subject: "Biology",
          chapter: "",
          topic: "",
          targetCount: 50,
          difficulty: "MEDIUM",
          assignedToId: facultyList[0]?.id || currentUserId,
          dueDate: "",
          notes: "",
        });
        await refreshAssignments();
      } else {
        alert(data.error?.message || "Failed to create assignment");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentStatusChange = async (assignmentId: string, newStatus: string) => {
    try {
      await fetch(`/api/team/questions/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await refreshAssignments();
    } catch (err) {
      console.error(err);
    }
  };

  // Batch Review Action
  const handleBatchReviewDecision = async (stage: "REVIEW_1" | "REVIEW_2", status: "APPROVED" | "REJECTED") => {
    if (selectedQuestionIds.length === 0) {
      alert("Please select at least one question from the table");
      return;
    }

    if (!confirm(`Are you sure you want to mark ${selectedQuestionIds.length} question(s) as ${status}?`)) {
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
          notes: `Batch ${status} via My Question Bank Studio`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedQuestionIds([]);
        await fetchReviewQueue();
        await refreshAssignments();
      } else {
        alert(data.error?.message || "Failed to process batch review");
      }
    } catch (err: any) {
      alert(err.message || "Batch review error");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === reviewQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(reviewQuestions.map((q) => q.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedQuestionIds.includes(id)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((x) => x !== id));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileQuestion className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Question Bank</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Authoring worksets, chapter assignments, and 2-stage verification pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAssignAdmin && (
            <button
              onClick={() => setViewAll(!viewAll)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                viewAll
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {viewAll ? "Viewing All Faculty Tasks" : "Viewing My Tasks Only"}
            </button>
          )}

          <button
            onClick={() => {
              refreshAssignments();
              if (activeTab !== "assignments") fetchReviewQueue();
            }}
            disabled={loading || reviewLoading}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading || reviewLoading ? "animate-spin" : ""}`} />
          </button>

          {isAssignAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Chapter Task
            </button>
          )}

          <Link
            href="/team/questions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI Question Author
          </Link>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("assignments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === "assignments"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Assigned Worksets ({assignments.length})
        </button>

        <button
          onClick={() => setActiveTab("review1")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === "review1"
              ? "bg-amber-600 text-white"
              : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          }`}
        >
          <Clock className="w-4 h-4" />
          Stage 1 Academic Review ({totalReview1Pending})
        </button>

        <button
          onClick={() => setActiveTab("review2")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === "review2"
              ? "bg-indigo-600 text-white"
              : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Layers className="w-4 h-4" />
          Stage 2 Quality Review ({totalReview2Pending})
        </button>

        <button
          onClick={() => setActiveTab("revision")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === "revision"
              ? "bg-rose-600 text-white"
              : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Needs Revision ({totalRejected})
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === "audit"
              ? "bg-purple-600 text-white"
              : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          }`}
        >
          <Brain className="w-4 h-4" />
          AI Chapter Audit Engine
        </button>
      </div>

      {/* Metric Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Target</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalAssignedQuestions}</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
              Assigned
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{totalCreatedQuestions} authored</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Review 1 Pending</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalReview1Pending}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stage 1 Academic</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Review 2 Pending</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalReview2Pending}</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stage 2 Quality</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Published & Live</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalPublished}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ready for exams</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Needs Revision</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{totalRejected}</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Rejected/Changes</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completion Rate</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalAssignedQuestions > 0 ? Math.round((totalPublished / totalAssignedQuestions) * 100) : 0}%
            </span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Published vs Target</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search chapter, topic or question code..."
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedSubject === s
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: ASSIGNED WORKSETS */}
      {activeTab === "assignments" && (
        <div>
          {filteredAssignments.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No question assignments found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {isAssignAdmin
                  ? "You haven't assigned any chapter tasks yet. Click 'Assign Chapter Task' above to assign a topic to faculty."
                  : "No question tasks are assigned to you currently. Check back later or contact your Academic Head."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssignments.map((a) => {
                const authored = a.liveStats?.total || 0;
                const progressPct = a.targetCount > 0 ? Math.min(100, Math.round((authored / a.targetCount) * 100)) : 0;

                return (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {a.subject}
                        </span>
                        <select
                          value={a.status}
                          onChange={(e) => handleAssignmentStatusChange(a.id, e.target.value)}
                          className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <option value="ASSIGNED">ASSIGNED</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="SUBMITTED">SUBMITTED</option>
                          <option value="UNDER_REVIEW">UNDER REVIEW</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 line-clamp-1">{a.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Chapter: <span className="font-semibold text-slate-700 dark:text-slate-300">{a.chapter}</span>
                        {a.topic ? ` • ${a.topic}` : ""}
                      </p>

                      {/* Progress Bars */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-600 dark:text-slate-400">Authoring Progress</span>
                          <span className="text-slate-900 dark:text-white">
                            {authored} / {a.targetCount} ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-blue-500 h-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Live Status Pill Matrix */}
                      <div className="grid grid-cols-4 gap-1.5 mt-4 text-center">
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg">
                          <span className="block text-[10px] text-slate-400 font-medium">DRAFT</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{a.liveStats?.draft}</span>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg">
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">REV 1</span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{a.liveStats?.review1}</span>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-1.5 rounded-lg">
                          <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">REV 2</span>
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{a.liveStats?.review2}</span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-lg">
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">LIVE</span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {a.liveStats?.published}
                          </span>
                        </div>
                      </div>

                      {/* Faculty & Due Date footer */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>Educator: <b className="text-slate-700 dark:text-slate-300">{a.assignedTo.name}</b></span>
                        {a.dueDate && <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAuditTarget({ subject: a.subject, chapter: a.chapter });
                          setShowAuditModal(true);
                        }}
                        className="py-2 px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1"
                        title="Run AI Quality Audit on this Chapter"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        AI Audit
                      </button>

                      <Link
                        href={`/team/questions?subject=${encodeURIComponent(a.subject)}&chapter=${encodeURIComponent(a.chapter)}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Browse ({authored})
                      </Link>

                      <Link
                        href={`/team/questions/new?subject=${encodeURIComponent(a.subject)}&chapter=${encodeURIComponent(a.chapter)}&topic=${encodeURIComponent(a.topic || "")}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Author
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2, 3, 4: REVIEW QUEUES */}
      {(activeTab === "review1" || activeTab === "review2" || activeTab === "revision") && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {selectedQuestionIds.length > 0 && selectedQuestionIds.length === reviewQuestions.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                Select All ({selectedQuestionIds.length}/{reviewQuestions.length})
              </button>

              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-500 font-medium">
                {activeTab === "review1"
                  ? "Stage 1: Academic & Subject Matter Verification"
                  : activeTab === "review2"
                  ? "Stage 2: Quality & Exam Value Verification"
                  : "Needs Revision (Action Required by Author)"}
              </span>
            </div>

            {selectedQuestionIds.length > 0 && (
              <div className="flex items-center gap-2">
                {activeTab === "review1" && (
                  <>
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_1", "APPROVED")}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
                    >
                      Approve to Stage 2 ({selectedQuestionIds.length})
                    </button>
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_1", "REJECTED")}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition"
                    >
                      Request Changes ({selectedQuestionIds.length})
                    </button>
                  </>
                )}

                {activeTab === "review2" && (
                  <>
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_2", "APPROVED")}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
                    >
                      Publish to Live ({selectedQuestionIds.length})
                    </button>
                    <button
                      disabled={batchActionLoading}
                      onClick={() => handleBatchReviewDecision("REVIEW_2", "REJECTED")}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition"
                    >
                      Return to Stage 1 ({selectedQuestionIds.length})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Question Review Cards */}
          {reviewQuestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {activeTab === "review1"
                  ? "No questions pending Stage 1 Academic Review!"
                  : activeTab === "review2"
                  ? "No questions pending Stage 2 Quality Review!"
                  : "No questions currently needing revision!"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">All questions in this pipeline have been processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewQuestions.map((q) => {
                const primaryT = q.translations?.find((t: any) => t.language === "ENGLISH") || q.translations?.[0];
                const isSelected = selectedQuestionIds.includes(q.id);

                return (
                  <div
                    key={q.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleSelectOne(q.id)} className="mt-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {q.questionCode || `Q-${q.id.slice(0, 8)}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {q.subject}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {q.category || q.chapter}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {q.difficulty}
                            </span>
                            <span className="text-xs text-slate-400">
                              By: {q.createdBy?.name || "Author"} • {new Date(q.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-slate-900 dark:text-white line-clamp-2">
                            <FormulaText text={primaryT?.statement || "No statement text"} />
                          </div>

                          {q.review1Notes && (
                            <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-2 rounded-lg">
                              <b>Review 1 Note:</b> {q.review1Notes}
                            </div>
                          )}

                          {q.review2Notes && (
                            <div className="mt-2 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 p-2 rounded-lg">
                              <b>Review 2 Note:</b> {q.review2Notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setSelectedQuestionForModal({
                              id: q.id,
                              questionCode: q.questionCode,
                              subject: q.subject,
                              chapter: q.category || q.chapter,
                              topic: q.topic,
                              type: q.type || "SINGLE_CORRECT",
                              difficulty: q.difficulty,
                              status: q.status,
                              version: q.version || 1,
                              translations: q.translations || [],
                            })
                          }
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review & Inspect
                        </button>

                        <Link
                          href={`/team/questions/${q.id}/edit`}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI CHAPTER AUDIT ENGINE */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Unbounded Chapter-Level AI Question Audit Engine
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Execute a single command to thoroughly audit 100% of questions in any chapter for LaTeX accuracy, option validity, solution depth, and NEET relevance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {a.subject}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2">{a.chapter}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {a.liveStats?.total || 0} Questions Authored ({a.liveStats?.published || 0} Live)
                  </p>
                </div>

                <button
                  onClick={() => {
                    setAuditTarget({ subject: a.subject, chapter: a.chapter });
                    setShowAuditModal(true);
                  }}
                  className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition inline-flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Run Full Chapter Audit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Chapter Assignment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assign Chapter Question Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biological Classification L1-L3 Practice Set"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Biology">Biology</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Count *</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={formData.targetCount}
                    onChange={(e) => setFormData({ ...formData, targetCount: parseInt(e.target.value, 10) || 50 })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chapter *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cell Cycle and Cell Division"
                    value={formData.chapter}
                    onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Topic / Sub-topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Mitosis Phases"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to Educator / Faculty *
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Instructions / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Include 40% NCERT line-by-line questions and 30% diagram-based items."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  {loading ? "Assigning..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Interactive Question Review Workspace */}
      {selectedQuestionForModal && (
        <QuestionReviewWorkspaceModal
          question={selectedQuestionForModal}
          onClose={() => setSelectedQuestionForModal(null)}
          onSuccess={() => {
            setSelectedQuestionForModal(null);
            fetchReviewQueue();
            refreshAssignments();
          }}
        />
      )}

      {/* Modal: Unbounded AI Chapter Audit */}
      {showAuditModal && (
        <ChapterAuditModal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          initialSubject={auditTarget.subject}
          initialChapter={auditTarget.chapter}
        />
      )}
    </div>
  );
}
