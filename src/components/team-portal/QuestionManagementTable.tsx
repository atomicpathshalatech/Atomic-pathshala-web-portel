"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Edit2,
  History,
  Trash2,
  Send,
  Eye,
  Check,
  X,
  AlertCircle,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  BookOpen,
  Flag,
  Image as ImageIcon,
  Compass,
  Hash,
  UserPlus,
  CheckSquare,
  Square,
  Users,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";
import { CamDrawRenderer } from "@/components/camdraw/CamDrawRenderer";
import {
  getMasterNcertChapters,
  getAllMasterNcertChapters,
} from "@/lib/academic/master-ncert-catalog";
import { QuestionReviewWorkspaceModal } from "./QuestionReviewWorkspaceModal";
import { ChapterAuditModal } from "./ChapterAuditModal";
import { CanonicalIdMigratorModal } from "./CanonicalIdMigratorModal";

export interface QuestionRow {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  category?: string | null;
  pyqExam?: string | null;
  pyqYear?: number | null;
  pyqMonth?: string | null;
  pyqQuestionNumber?: string | null;
  pyqSource?: string | null;
  imageUrl?: string | null;
  solution?: string | null;
  tags?: string | null;
  status: string; // DRAFT | REVIEW_1 | REVIEW_2 | PUBLISHED | REJECTED
  version: number;
  isPublished: boolean;
  publishedAt: string | Date | null;
  publishedById: string | null;
  createdById: string | null;
  createdAt: string | Date;
  editedById: string | null;
  editedAt: string | Date | null;
  review1Status: string | null;
  review1ById: string | null;
  review1At: string | Date | null;
  review1Notes: string | null;
  review2Status: string | null;
  review2ById: string | null;
  review2At: string | Date | null;
  review2Notes: string | null;
  assignedToId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | Date | null;
  correctionStatus?: string | null;
  correctionNotes?: string | null;
  correctionSubmittedAt?: string | Date | null;
  correctionSubmittedById?: string | null;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  editedBy?: { id: string; name: string | null; email: string | null } | null;
  review1By?: { id: string; name: string | null; email: string | null } | null;
  review2By?: { id: string; name: string | null; email: string | null } | null;
  publishedBy?: { id: string; name: string | null; email: string | null } | null;
  assignedTo?: { id: string; name: string | null; email: string | null } | null;
  assignedBy?: { id: string; name: string | null; email: string | null } | null;
  correctionSubmittedBy?: { id: string; name: string | null; email: string | null } | null;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    solution?: string | null;
    options?: any;
    correctOptionIds?: any;
  }>;
  isBilingual?: boolean;
  _count?: {
    reports?: number;
  };
}

interface Props {
  questions: QuestionRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  counts: {
    total: number;
    published: number;
    review1: number;
    review2: number;
    draft: number;
    aiDraft?: number;
    pendingAssignment?: number;
    inCorrection?: number;
    submittedForReview?: number;
    rework?: number;
  };
  usersList: Array<{ id: string; name: string | null; email: string }>;
  teamMembersList?: Array<{ id: string; name: string | null; email: string }>;
  canCreate: boolean;
  canVerify: boolean;
  currentUserId?: string;
}

export function QuestionManagementTable({
  questions,
  totalCount,
  currentPage,
  pageSize,
  counts,
  usersList,
  teamMembersList,
  canCreate,
  canVerify,
  currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters State
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [subject, setSubject] = useState(searchParams?.get("subject") || "");
  const [chapter, setChapter] = useState(searchParams?.get("chapter") || "");
  const [topic, setTopic] = useState(searchParams?.get("topic") || "");
  const [subTopic, setSubTopic] = useState(searchParams?.get("subTopic") || "");
  const [difficulty, setDifficulty] = useState(searchParams?.get("difficulty") || "");
  const [type, setType] = useState(searchParams?.get("type") || "");
  const [status, setStatus] = useState(searchParams?.get("status") || "");
  const [createdById, setCreatedById] = useState(searchParams?.get("createdById") || "");
  const [reviewedById, setReviewedById] = useState(searchParams?.get("reviewedById") || "");
  const [editedById, setEditedById] = useState(searchParams?.get("editedById") || "");
  const [source, setSource] = useState(searchParams?.get("source") || "");
  const [pyqCategory, setPyqCategory] = useState(searchParams?.get("pyqCategory") || "");

  // CBT Question View / Preview Modal State
  const [viewQuestionIndex, setViewQuestionIndex] = useState<number | null>(null);
  const [viewQuestionLang, setViewQuestionLang] = useState<"ENGLISH" | "HINDI">("ENGLISH");
  const [showSolution, setShowSolution] = useState(false);
  const [showReferenceSource, setShowReferenceSource] = useState(false);

  // Modals
  const [reviewModalQuestion, setReviewModalQuestion] = useState<{
    question: QuestionRow;
    stage: "REVIEW_1" | "REVIEW_2";
  } | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | "REQUEST_CHANGES">("APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Revision History Modal
  const [historyModalQuestion, setHistoryModalQuestion] = useState<QuestionRow | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Secure Delete Modal
  const [deleteModalResource, setDeleteModalResource] = useState<{
    id: string;
    resourceId: string;
    title: string;
  } | null>(null);

  // Chapter AI Audit Modal & Canonical ID Migrator Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [canonicalMigratorOpen, setCanonicalMigratorOpen] = useState(false);
  const [standaloneReviewQuestion, setStandaloneReviewQuestion] = useState<QuestionRow | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Multi-Selection State for Bulk Assignment & Sign-off
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetIds, setAssignTargetIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState(usersList[0]?.id || "");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Rework Modal State
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [reworkTargetId, setReworkTargetId] = useState<string | null>(null);
  const [reworkNotes, setReworkNotes] = useState("");
  const [submittingRework, setSubmittingRework] = useState(false);

  // Direct Assign Action Handler
  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId || assignTargetIds.length === 0) {
      toast.error("Please select a faculty and questions to assign.");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/team/questions/assign-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: assignTargetIds,
          assignedToId: assigneeId,
          notes: assignNotes,
          dueDate: assignDueDate || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to assign questions.");
        return;
      }
      toast.success(json.data?.message || `Successfully assigned ${assignTargetIds.length} question(s)!`);
      setAssignModalOpen(false);
      setSelectedIds([]);
      setAssignNotes("");
      router.refresh();
    } catch {
      toast.error("Network error assigning questions.");
    } finally {
      setAssigning(false);
    }
  };

  // Admin Direct Sign-Off Handler (1-Click Approval)
  const handleAdminSignOff = async (qId: string) => {
    try {
      const res = await fetch("/api/team/questions/admin-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: qId,
          action: "APPROVE",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Sign-off approval failed.");
        return;
      }
      toast.success("Question approved & signed-off! Now live & published.");
      router.refresh();
    } catch {
      toast.error("Network error during sign-off.");
    }
  };

  // Admin Send Back for Rework Handler
  const handleAdminReworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reworkTargetId) return;
    setSubmittingRework(true);
    try {
      const res = await fetch("/api/team/questions/admin-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: reworkTargetId,
          action: "REWORK",
          notes: reworkNotes,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to send back for rework.");
        return;
      }
      toast.info("Sent back for rework with feedback comments.");
      setReworkModalOpen(false);
      setReworkNotes("");
      setReworkTargetId(null);
      router.refresh();
    } catch {
      toast.error("Network error submitting rework feedback.");
    } finally {
      setSubmittingRework(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyQuestionCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied Question ID: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (subject) params.set("subject", subject);
    if (chapter.trim()) params.set("chapter", chapter.trim());
    if (topic.trim()) params.set("topic", topic.trim());
    if (subTopic.trim()) params.set("subTopic", subTopic.trim());
    if (difficulty) params.set("difficulty", difficulty);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    if (pyqCategory) params.set("pyqCategory", pyqCategory);
    if (createdById) params.set("createdById", createdById);
    if (reviewedById) params.set("reviewedById", reviewedById);
    if (editedById) params.set("editedById", editedById);
    params.set("page", "1");
    router.push(`/team/questions?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearch("");
    setSubject("");
    setChapter("");
    setTopic("");
    setSubTopic("");
    setDifficulty("");
    setType("");
    setStatus("");
    setSource("");
    setPyqCategory("");
    setCreatedById("");
    setReviewedById("");
    setEditedById("");
    router.push("/team/questions");
  };

  const handleQuickStatusTab = (statusTab: string) => {
    setStatus(statusTab);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (statusTab) {
      params.set("status", statusTab);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    router.push(`/team/questions?${params.toString()}`);
  };

  // Submit Draft to Review 1
  const handleSubmitToReview1 = async (qId: string) => {
    try {
      const res = await fetch(`/api/team/questions/${qId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "SUBMIT_TO_REVIEW_1" }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to submit for Review 1");
        return;
      }
      toast.success("Question submitted to Review 1 queue!");
      router.refresh();
    } catch {
      toast.error("Network error.");
    }
  };

  // Submit Review 1 or Review 2 Decision
  const handleReviewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalQuestion) return;

    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/team/questions/${reviewModalQuestion.question.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: reviewModalQuestion.stage,
          action: reviewAction,
          notes: reviewNotes,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Review action failed");
        return;
      }

      if (reviewModalQuestion.stage === "REVIEW_2" && reviewAction === "APPROVE") {
        toast.success("Question approved and PUBLISHED successfully! Ready for Tests and DPPs.");
      } else if (reviewAction === "APPROVE") {
        toast.success("Review 1 approved! Moved to Review 2 queue.");
      } else {
        toast.info("Changes requested. Question returned to author.");
      }

      setReviewModalQuestion(null);
      setReviewNotes("");
      router.refresh();
    } catch {
      toast.error("Network error submitting review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Open Revision History Modal
  const handleOpenHistory = async (q: QuestionRow) => {
    setHistoryModalQuestion(q);
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/team/questions/${q.id}/versions`);
      const json = await res.json();
      if (json.success && json.data.versions) {
        setVersions(json.data.versions);
      } else {
        setVersions([]);
      }
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Delete Question
  const handleDelete = async (qId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await fetch(`/api/team/questions/${qId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to delete question.");
        return;
      }
      toast.success("Question deleted.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP WORKFLOW STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => handleQuickStatusTab("")}
          className={`p-3.5 rounded-2xl border text-left transition ${
            !status ? "bg-blue-50/80 border-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">All Questions</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{counts.total}</h3>
        </button>

        <button
          type="button"
          onClick={() => handleQuickStatusTab("PUBLISHED")}
          className={`p-3.5 rounded-2xl border text-left transition ${
            status === "PUBLISHED"
              ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700">Approved / Live</p>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{counts.published}</h3>
        </button>

        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams?.toString() || "");
            params.set("status", "SUBMITTED");
            params.set("page", "1");
            router.push(`/team/questions?${params.toString()}`);
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            searchParams?.get("status") === "SUBMITTED"
              ? "bg-amber-100/80 border-amber-600 shadow-sm"
              : "bg-amber-50/50 border-amber-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-900">Sign-Off Pending</p>
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-amber-900 mt-1">{counts.submittedForReview ?? 0}</h3>
        </button>

        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams?.toString() || "");
            params.set("status", "ASSIGNED");
            params.set("page", "1");
            router.push(`/team/questions?${params.toString()}`);
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            searchParams?.get("status") === "ASSIGNED"
              ? "bg-blue-100/80 border-blue-600 shadow-sm"
              : "bg-blue-50/50 border-blue-200 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-900">In Correction</p>
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <h3 className="text-2xl font-black text-blue-900 mt-1">{counts.inCorrection ?? 0}</h3>
        </button>

        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams?.toString() || "");
            params.set("status", "PENDING_ASSIGN");
            params.set("page", "1");
            router.push(`/team/questions?${params.toString()}`);
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            searchParams?.get("status") === "PENDING_ASSIGN"
              ? "bg-indigo-100/80 border-indigo-600 shadow-sm"
              : "bg-indigo-50/50 border-indigo-200 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-900">Needs Assignment</p>
            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-black text-indigo-900 mt-1">{counts.pendingAssignment ?? counts.draft}</h3>
        </button>

        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams?.toString() || "");
            params.set("status", "REWORK");
            params.set("page", "1");
            router.push(`/team/questions?${params.toString()}`);
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            searchParams?.get("status") === "REWORK"
              ? "bg-rose-100/80 border-rose-600 shadow-sm"
              : "bg-rose-50/50 border-rose-200 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-rose-900">Rework Required</p>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <h3 className="text-2xl font-black text-rose-900 mt-1">{counts.rework ?? 0}</h3>
        </button>

        <Link
          href="/team/questions/drafts"
          className="p-4 rounded-2xl border bg-blue-50/50 border-blue-200 hover:border-blue-400 text-left transition group shadow-xs cursor-pointer flex flex-col justify-between"
          title="Open Dedicated AI Drafts Folder"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-blue-900 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              AI Drafts
            </p>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 group-hover:bg-blue-200 px-2 py-0.5 rounded-full transition">
              Open ➔
            </span>
          </div>
          <h3 className="text-2xl font-black text-blue-900 mt-1">
            {counts.aiDraft ?? counts.draft}
          </h3>
        </Link>
      </div>

      {/* 2. AI QUESTION INTELLIGENCE & CANONICAL ID ACTION BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold text-white border border-white/20 shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm tracking-tight">AI Chapter Question Intelligence &amp; Verification</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                100% Unbounded
              </span>
            </div>
            <p className="text-xs text-blue-100 opacity-90 mt-0.5">
              Audit all questions in any chapter for scientific accuracy, answer keys, solutions, and cognitive depth with 1-click review.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setCanonicalMigratorOpen(true)}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Scan repository and assign official 10-character canonical IDs (P26, C25, B24, M23, S22)"
          >
            <Hash className="w-3.5 h-3.5 text-blue-200" />
            <span>Standardize 10-Digit IDs</span>
          </button>

          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            className="px-5 py-2 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-xs font-black shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>⚡ Run AI Chapter Audit</span>
          </button>
        </div>
      </div>

      {/* 2.1 CONTEXTUAL ACTIVE CHAPTER BANNER */}
      {chapter && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Filtered Chapter: <span className="text-blue-700 dark:text-blue-400 font-extrabold">{chapter}</span>
                {subject ? ` (${subject})` : ""}
              </p>
              <p className="text-[11px] text-slate-500">
                {totalCount} total questions in this chapter repository.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Audit All Questions in {chapter}</span>
          </button>
        </div>
      )}

      {/* 3. STRUCTURED FILTER BAR (Comprehensive yet clean) */}
      <form onSubmit={applyFilters} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
        {/* Row 1: Search, Subject, Topic, Sub-Topic, Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search statement text, Question ID, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={subject}
              onChange={(e) => {
                const newSubject = e.target.value;
                setSubject(newSubject);
                if (newSubject) {
                  const chaptersForSub = getMasterNcertChapters(newSubject);
                  const exists = chaptersForSub.some((c) => c.title === chapter);
                  if (!exists) setChapter("");
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 font-medium"
            >
              <option value="">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Science">Science</option>
            </select>
          </div>

          {/* Chapter Dropdown (Dynamic per Subject) */}
          <div>
            <select
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 font-medium"
            >
              <option value="">All Chapters</option>
              {subject ? (
                getMasterNcertChapters(subject).map((ch) => (
                  <option key={ch.id} value={ch.title}>
                    {ch.displayTitle}
                  </option>
                ))
              ) : (
                getAllMasterNcertChapters().map((group) => (
                  <optgroup key={group.subject} label={`— ${group.subject} —`}>
                    {group.chapters.map((ch) => (
                      <option key={ch.id} value={ch.title}>
                        {ch.displayTitle}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>

          <div>
            <input
              type="text"
              placeholder="Topic / Sub-topic..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Row 2: Difficulty, Question Type, Workflow Status, Generation Source, PYQ Category, Created By, Reviewed By */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">All Difficulty</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">All Question Types</option>
              <option value="SINGLE_CORRECT">Single Correct (MCQ)</option>
              <option value="MULTIPLE_CORRECT">Multiple Correct</option>
              <option value="NUMERICAL">Numerical</option>
              <option value="ASSERTION_REASON">Assertion - Reason</option>
              <option value="MATCH_COLUMN">Match Column</option>
              <option value="STATEMENT_BASED">Statement Based</option>
            </select>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW_1">Review 1 Pending</option>
              <option value="REVIEW_2">Review 2 Pending</option>
              <option value="PUBLISHED">Published (Verified)</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-2.5 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold outline-none focus:border-blue-500"
            >
              <option value="">Source: All</option>
              <option value="AI_ALL">✨ AI Generated (All)</option>
              <option value="NCERT_HUB">📖 NCERT Practice Hub</option>
              <option value="ATOMIC_GURU">🧠 Atomic Guru Generated</option>
              <option value="AI_ONLY">🤖 AI Mode</option>
              <option value="PDF_ONLY">📄 PDF Mode</option>
              <option value="MANUAL">✍️ Manual Authored</option>
            </select>
          </div>

          {/* PYQ Category Filter */}
          <div>
            <select
              value={pyqCategory}
              onChange={(e) => setPyqCategory(e.target.value)}
              className="w-full px-2.5 py-2 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 font-bold outline-none focus:border-indigo-500"
            >
              <option value="">PYQ: All</option>
              <option value="NEET_PYQ">🎯 NEET PYQs</option>
              <option value="JEE_MAINS_PYQ">⚡ JEE Mains PYQs</option>
              <option value="JEE_ADVANCED_PYQ">🚀 JEE Advanced PYQs</option>
              <option value="ALL_PYQ">📚 All PYQs</option>
            </select>
          </div>

          <div>
            <select
              value={createdById}
              onChange={(e) => setCreatedById(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">Created By (All)</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={reviewedById}
              onChange={(e) => setReviewedById(e.target.value)}
              className="w-full px-2.5 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs text-amber-950 font-semibold outline-none focus:border-amber-500"
              title="Filter by verified Team Members only"
            >
              <option value="">Reviewed By: Team Member</option>
              {(teamMembersList || usersList).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* 3. QUESTION TABLE WITH STRICT WORKFLOW & REVISION TRACKING */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-4 w-10 text-center">
                  <button type="button" onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                    {selectedIds.length === questions.length && questions.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-5 py-4">Question Preview &amp; ID</th>
                <th className="px-4 py-4">Subject / Topic</th>
                <th className="px-3 py-4">Difficulty &amp; Type</th>
                <th className="px-4 py-4">Workflow &amp; Assignee</th>
                <th className="px-4 py-4">Auditing</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {questions.map((q) => {
                const statementEn = q.translations.find((t) => t.language === "ENGLISH")?.statement;
                const statementHi = q.translations.find((t) => t.language === "HINDI")?.statement;
                const primaryStatement = statementEn || statementHi || q.translations[0]?.statement || "—";
                const displayCode = q.questionCode || `Q-${q.id.slice(0, 6).toUpperCase()}`;
                const isSelected = selectedIds.includes(q.id);

                return (
                  <tr key={q.id} className={`hover:bg-slate-50/60 transition group ${isSelected ? "bg-blue-50/30" : ""}`}>
                    {/* 0. Row Checkbox */}
                    <td className="px-3 py-4 w-10 text-center">
                      <button type="button" onClick={() => toggleSelectOne(q.id)} className="text-slate-400 hover:text-slate-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* 1. Question Preview & ID */}
                    <td className="px-5 py-4 max-w-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyQuestionCode(displayCode)}
                            className="font-mono font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md text-[11px] border border-blue-200 transition flex items-center gap-1 cursor-pointer group/id"
                            title={`Click to copy Canonical ID: ${displayCode}`}
                          >
                            <span>{displayCode}</span>
                            <span className="material-symbols-outlined text-[11px] text-blue-400 group-hover/id:text-blue-700">
                              {copiedCode === displayCode ? "check" : "content_copy"}
                            </span>
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            v{q.version || 1}
                          </span>
                          {q.translations.length > 1 && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              Bilingual
                            </span>
                          )}
                          {q.category?.startsWith("AI_GENERATED") && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                              <span>{q.category.includes("PDF") ? "PDF Generated" : "AI Generated"}</span>
                            </span>
                          )}
                          {(q.category === "ATOMIC_GURU" || q.category?.includes("ATOMIC_GURU")) && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              <span>Atomic Guru Draft</span>
                            </span>
                          )}
                          {(q.category === "NCERT_HUB" || q.category?.includes("NCERT") || q.tags?.includes("NCERT")) && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <BookOpen className="w-2.5 h-2.5 text-emerald-600" />
                              <span>NCERT Practice Hub</span>
                            </span>
                          )}
                          {(q.pyqExam || q.pyqSource) && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-flex items-center gap-1 font-mono">
                              <span>{q.pyqSource || `${q.pyqExam} ${q.pyqYear || ""}`}</span>
                            </span>
                          )}
                          {(q as any).camDrawData && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-mono">
                              <Compass className="w-2.5 h-2.5 text-indigo-600" />
                              <span>CamDraw Vector</span>
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-slate-900 font-medium text-xs leading-relaxed">
                          {primaryStatement}
                        </p>
                      </div>
                    </td>

                    {/* 2. Subject / Topic / Sub-topic */}
                    <td className="px-4 py-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-blue-700 block">{q.subject || "General"}</span>
                        {q.chapter && <span className="text-slate-600 block truncate max-w-[160px]">{q.chapter}</span>}
                        {q.subTopic && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                            ↳ {q.subTopic}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Difficulty & Type */}
                    <td className="px-3 py-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.difficulty === "EASY"
                              ? "bg-emerald-50 text-emerald-700"
                              : q.difficulty === "HARD"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {q.type.replace("_", " ")}
                        </span>
                      </div>
                    </td>

                    {/* 4. Workflow Status & Assignee */}
                    <td className="px-4 py-4">
                      <div className="space-y-1.5">
                        {q.correctionStatus === "SUBMITTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Sign-Off Pending
                          </span>
                        ) : q.correctionStatus === "ASSIGNED" || q.correctionStatus === "IN_CORRECTION" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                            <Edit2 className="w-2.5 h-2.5 text-blue-700" />
                            In Correction
                          </span>
                        ) : q.correctionStatus === "REWORK" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                            Rework Required
                          </span>
                        ) : q.status === "PUBLISHED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Live Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            Draft
                          </span>
                        )}

                        {q.assignedTo ? (
                          <span className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1 truncate max-w-[150px]">
                            <Users className="w-3 h-3 shrink-0" />
                            {q.assignedTo.name || q.assignedTo.email}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">
                            Unassigned
                          </span>
                        )}

                        {q._count?.reports && q._count.reports > 0 ? (
                          <Link
                            href={`/team/questions/reports?search=${encodeURIComponent(q.questionCode || q.id)}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition"
                            title={`${q._count.reports} student report(s) filed. Click to review.`}
                          >
                            <Flag className="w-2.5 h-2.5 text-amber-700" />
                            <span>⚠️ {q._count.reports} {q._count.reports === 1 ? "Report" : "Reports"}</span>
                          </Link>
                        ) : null}
                      </div>
                    </td>

                    {/* 5. Review Details & Auditing */}
                    <td className="px-4 py-4">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="font-bold text-[10px]">R1:</span>
                          {q.review1Status === "APPROVED" ? (
                            <span className="text-emerald-600 font-bold">✓ ({q.review1By?.name || "Lead"})</span>
                          ) : q.status === "REVIEW_1" ? (
                            <span className="text-amber-600 font-medium">Pending...</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="font-bold text-[10px]">R2:</span>
                          {q.review2Status === "APPROVED" ? (
                            <span className="text-emerald-600 font-bold">✓ ({q.review2By?.name || "Admin"})</span>
                          ) : q.status === "REVIEW_2" ? (
                            <span className="text-blue-600 font-medium">Pending...</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>

                        {q.editedBy && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            Edited: {q.editedBy.name || q.editedBy.email}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 6. Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Admin Sign-Off Action (if submitted for correction) */}
                        {q.correctionStatus === "SUBMITTED" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAdminSignOff(q.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1 cursor-pointer"
                              title="Sign-off & Approve this question (Publish live)"
                            >
                              <Check className="w-3 h-3" />
                              <span>Sign-off</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReworkTargetId(q.id);
                                setReworkModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1 cursor-pointer"
                              title="Send back for Rework with comments"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Rework</span>
                            </button>
                          </>
                        )}

                        {/* Assign to Faculty */}
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTargetIds([q.id]);
                            setAssignModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                          title="Assign Question to Reviewer / Faculty"
                        >
                          <UserPlus className="w-3 h-3 text-indigo-600" />
                          <span>{q.assignedToId ? "Re-assign" : "Assign"}</span>
                        </button>

                        {/* Draft -> Submit to Review 1 */}
                        {q.status === "DRAFT" && !q.correctionStatus && (
                          <button
                            type="button"
                            onClick={() => handleSubmitToReview1(q.id)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                            title="Submit for Review 1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Submit R1</span>
                          </button>
                        )}

                        {/* Review 1 Action */}
                        {canVerify && q.status === "REVIEW_1" && (
                          <Link
                            href={`/team/questions/${q.id}/review`}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Review 1</span>
                          </Link>
                        )}

                        {/* Review 2 Action */}
                        {canVerify && q.status === "REVIEW_2" && (
                          <Link
                            href={`/team/questions/${q.id}/review`}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Review 2</span>
                          </Link>
                        )}

                        {/* Full Review & AI Quality Workspace */}
                        <Link
                          href={`/team/questions/${q.id}/review`}
                          className="px-2 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold transition flex items-center gap-1 shadow-2xs"
                          title="Open Full AI Review & Audit Workspace"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-[11px] font-bold">Review</span>
                        </Link>

                        {/* View Question in Student CBT Interface */}
                        <button
                          type="button"
                          onClick={() => {
                            const idx = questions.findIndex((item) => item.id === q.id);
                            setViewQuestionIndex(idx >= 0 ? idx : 0);
                            setShowSolution(false);
                          }}
                          className="px-2 py-1 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 hover:text-blue-800 font-bold transition flex items-center gap-1 shadow-2xs"
                          title="View CBT Interface"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                        </button>

                        {/* Edit Question */}
                        <Link
                          href={`/team/questions/${q.id}/edit`}
                          className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition"
                          title="Edit Question"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Revision History */}
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(q)}
                          className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition"
                          title="View Revision History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteModalResource({
                              id: q.id,
                              resourceId: q.questionCode || `QST-${q.id.slice(0, 6).toUpperCase()}`,
                              title: q.translations[0]?.statement.slice(0, 50) || "Question Entry",
                            })
                          }
                          className="p-1 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Secure Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {questions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No questions match the current filters.</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try resetting filters or adding new questions.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <p>
            Showing {questions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
            {(currentPage - 1) * pageSize + questions.length} of {totalCount} questions
          </p>

          <div className="flex gap-2">
            {currentPage > 1 && (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(searchParams?.toString() || "");
                  params.set("page", String(currentPage - 1));
                  router.push(`/team/questions?${params.toString()}`);
                }}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 font-bold transition"
              >
                Prev
              </button>
            )}

            {currentPage * pageSize < totalCount && (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(searchParams?.toString() || "");
                  params.set("page", String(currentPage + 1));
                  router.push(`/team/questions?${params.toString()}`);
                }}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 font-bold transition"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. COMPREHENSIVE QUESTION REVIEW WORKSPACE MODAL */}
      {reviewModalQuestion && (
        <QuestionReviewWorkspaceModal
          question={reviewModalQuestion.question as any}
          onClose={() => setReviewModalQuestion(null)}
          onSuccess={() => {
            setReviewModalQuestion(null);
            router.refresh();
          }}
        />
      )}

      {/* 4.1 STANDALONE QUESTION AI VERIFY & REVIEW MODAL */}
      {standaloneReviewQuestion && (
        <QuestionReviewWorkspaceModal
          question={standaloneReviewQuestion as any}
          onClose={() => setStandaloneReviewQuestion(null)}
          onSuccess={() => {
            setStandaloneReviewQuestion(null);
            router.refresh();
          }}
        />
      )}

      {/* 4.2 FULL 100% CHAPTER AI QUESTION AUDIT MODAL */}
      <ChapterAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        initialSubject={subject || "Physics"}
        initialChapter={chapter || ""}
      />

      {/* 4.3 CANONICAL 10-DIGIT ID MIGRATOR MODAL */}
      <CanonicalIdMigratorModal
        isOpen={canonicalMigratorOpen}
        onClose={() => setCanonicalMigratorOpen(false)}
        onSuccess={() => {
          setCanonicalMigratorOpen(false);
          router.refresh();
        }}
      />

      {/* 5. REVISION HISTORY MODAL */}
      {historyModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  <span>Revision History</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Question ID: {historyModalQuestion.questionCode || historyModalQuestion.id.slice(0, 8)} · Current Version: v{historyModalQuestion.version || 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingVersions ? (
                <div className="text-center py-8 text-xs text-slate-500">Loading version snapshots...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  This question is currently at its initial version (v1). Edits will create archived snapshot history.
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        Version {v.versionNumber}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(v.editedAt).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">
                      <span className="font-bold">Edited by: </span>
                      {v.editedBy?.name || v.editedBy?.email || "Team"}
                    </p>

                    {v.reason && (
                      <p className="text-xs text-slate-600 italic">
                        &quot;{v.reason}&quot;
                      </p>
                    )}

                    {v.snapshot?.translations?.[0]?.statement && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700">
                        <span className="font-bold text-slate-400 text-[10px] block uppercase">Snapshot Statement:</span>
                        <p className="line-clamp-2">{v.snapshot.translations[0].statement}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryModalQuestion(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SECURE DELETE MODAL */}
      {deleteModalResource && (
        <SecureDeleteResourceModal
          isOpen={Boolean(deleteModalResource)}
          onClose={() => setDeleteModalResource(null)}
          resourceId={deleteModalResource.resourceId}
          resourceTitle={deleteModalResource.title}
          resourceType="QUESTION"
          onDeleted={() => {
            setDeleteModalResource(null);
            router.refresh();
          }}
        />
      )}

      {/* 7. CBT STUDENT TEST INTERFACE PREVIEW MODAL WITH SEQUENTIAL QUESTION NAVIGATION */}
      {viewQuestionIndex !== null && questions[viewQuestionIndex] && (() => {
        const viewingQuestion = questions[viewQuestionIndex];
        const translationEn = viewingQuestion.translations.find((t) => t.language === "ENGLISH");
        const translationHi = viewingQuestion.translations.find((t) => t.language === "HINDI");
        const activeTranslation =
          viewQuestionLang === "HINDI" && translationHi ? translationHi : (translationEn || viewingQuestion.translations[0]);

        const statement = activeTranslation?.statement || "";
        const optionsObj: Record<string, string> =
          typeof activeTranslation?.options === "object" && activeTranslation?.options !== null
            ? (activeTranslation.options as Record<string, string>)
            : {};

        const correctOptionIds: string[] = Array.isArray(activeTranslation?.correctOptionIds)
          ? activeTranslation.correctOptionIds
          : [];

        const hasHindi = Boolean(translationHi);
        const OPTION_KEYS = ["A", "B", "C", "D"] as const;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
              {/* Modal Header: CBT Title Bar */}
              <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs shadow-xs">
                    Question {viewQuestionIndex + 1} of {questions.length}
                  </span>

                  <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {viewingQuestion.questionCode || `Q-${viewingQuestion.id.slice(0, 6).toUpperCase()}`}
                  </span>

                  {viewingQuestion.pyqSource && (
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg font-mono">
                      {viewingQuestion.pyqSource}
                    </span>
                  )}

                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {viewingQuestion.subject} {viewingQuestion.chapter ? `• ${viewingQuestion.chapter}` : ""}
                  </span>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {viewingQuestion.difficulty}
                  </span>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {viewingQuestion.type.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasHindi && (
                    <button
                      type="button"
                      onClick={() => setViewQuestionLang((prev) => (prev === "ENGLISH" ? "HINDI" : "ENGLISH"))}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
                    >
                      {viewQuestionLang === "HINDI" ? "🌐 Switch to English" : "🌐 हिंदी में देखें"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setViewQuestionIndex(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Test-Taking Interface Card */}
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-slate-900">
                {/* Question Statement in Student Test Format */}
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Question Statement ({viewQuestionLang})
                    </span>
                    {viewingQuestion.topic && <span>Topic: {viewingQuestion.topic}</span>}
                  </div>

                  <FormulaText
                    text={statement || "No statement text available."}
                    className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed block"
                  />

                  {/* Genuine Question Diagram (if present) */}
                  {viewingQuestion.imageUrl && (
                    <div className="pt-2">
                      <img
                        src={viewingQuestion.imageUrl}
                        alt="Question Diagram"
                        className="max-h-72 max-w-full rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-sm bg-white"
                      />
                    </div>
                  )}

                  {/* Optional Source/Reference Image (Editor-only on demand) */}
                  {(viewingQuestion as any).referenceImageUrl && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReferenceSource((prev) => !prev)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{showReferenceSource ? "Hide Source Screenshot" : "View Source Screenshot (Editor Only)"}</span>
                      </button>
                      {showReferenceSource && (
                        <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                          <img
                            src={(viewingQuestion as any).referenceImageUrl}
                            alt="Source Screenshot"
                            className="max-h-60 max-w-full rounded-lg object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Options List in Student Test CBT format */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block px-1">
                    Options (Student CBT Display)
                  </span>

                  <div className="grid grid-cols-1 gap-2.5">
                    {OPTION_KEYS.map((key) => {
                      const optVal = optionsObj[key] ?? optionsObj[key.toLowerCase()];
                      if (!optVal && optVal !== "") return null;

                      const isCorrect =
                        correctOptionIds.includes(key) ||
                        correctOptionIds.includes(key.toLowerCase()) ||
                        (viewingQuestion as any).correctAnswer === key;

                      return (
                        <div
                          key={key}
                          className={`p-4 rounded-2xl border text-left transition flex items-center gap-3.5 ${
                            isCorrect
                              ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs text-emerald-950 dark:text-emerald-100"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                              isCorrect
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {key}
                          </span>

                          <div className="flex-1 min-w-0">
                            <FormulaText
                              text={optVal || ""}
                              className="text-xs sm:text-sm font-medium leading-relaxed block"
                            />
                          </div>

                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                              <Check className="w-3.5 h-3.5" />
                              <span>Correct Key</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation / Solution Toggle */}
                {(activeTranslation?.solution || viewingQuestion.solution) && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSolution((prev) => !prev)}
                      className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs transition flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{showSolution ? "Hide Solution / Explanation" : "View Solution / Explanation"}</span>
                    </button>

                    {showSolution && (
                      <div className="mt-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Step-by-Step Solution
                        </span>
                        <FormulaText
                          text={activeTranslation?.solution || viewingQuestion.solution || ""}
                          className="text-xs sm:text-sm font-normal text-slate-800 dark:text-slate-200 leading-relaxed block whitespace-pre-wrap"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer: Navigation Controls (Prev, Next, Edit, Review Actions) */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                {/* Left: Previous & Next Question Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={viewQuestionIndex <= 0}
                    onClick={() => {
                      setViewQuestionIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0));
                      setShowSolution(false);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    disabled={viewQuestionIndex >= questions.length - 1}
                    onClick={() => {
                      setViewQuestionIndex((prev) => (prev !== null ? Math.min(questions.length - 1, prev + 1) : 0));
                      setShowSolution(false);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: Separate Edit Action & Review Controls */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  {canVerify && viewingQuestion.status === "REVIEW_1" && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewModalQuestion({ question: viewingQuestion, stage: "REVIEW_1" });
                        setReviewAction("APPROVE");
                        setReviewNotes("");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Review 1</span>
                    </button>
                  )}

                  {canVerify && viewingQuestion.status === "REVIEW_2" && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewModalQuestion({ question: viewingQuestion, stage: "REVIEW_2" });
                        setReviewAction("APPROVE");
                        setReviewNotes("");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Review 2</span>
                    </button>
                  )}

                  <Link
                    href={`/team/questions/${viewingQuestion.id}/edit`}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    title="Transition to Edit Mode"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Question</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setViewQuestionIndex(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. BULK SELECTION FLOATING BAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-bold text-slate-200">
            {selectedIds.length} question(s) selected
          </span>

          <button
            type="button"
            onClick={() => {
              setAssignTargetIds(selectedIds);
              setAssignModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Assign to Faculty</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (confirm(`Approve and Sign-off all ${selectedIds.length} selected questions?`)) {
                try {
                  const res = await fetch("/api/team/questions/admin-review", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      questionIds: selectedIds,
                      action: "APPROVE",
                    }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    toast.success(`Successfully approved ${selectedIds.length} questions!`);
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    toast.error(json.error || "Batch approval failed.");
                  }
                } catch {
                  toast.error("Network error during batch approval.");
                }
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Batch Sign-Off</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs text-slate-400 hover:text-white px-2 cursor-pointer"
          >
            Deselect All
          </button>
        </div>
      )}

      {/* 9. ASSIGN QUESTIONS MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Assign {assignTargetIds.length} Question(s)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct assignment to SME / Teacher / Question Reviewer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign To Faculty / Reviewer
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="">Select Faculty...</option>
                  {(teamMembersList && teamMembersList.length > 0 ? teamMembersList : usersList).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Correction Instructions / Review Notes
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Verify Option B and NCERT reference; correct formula formatting."
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !assigneeId}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {assigning ? (
                    <span>Assigning...</span>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Confirm Assignment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. REWORK FEEDBACK MODAL */}
      {reworkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Back for Rework
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReworkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminReworkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Feedback for Faculty / Reviewer
                </label>
                <textarea
                  value={reworkNotes}
                  onChange={(e) => setReworkNotes(e.target.value)}
                  required
                  placeholder="Explain what needs correction (e.g. Option C has a typographical error, please provide detailed step-by-step solution)."
                  rows={4}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReworkModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRework || !reworkNotes.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {submittingRework ? "Sending..." : "Send Back for Rework"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
