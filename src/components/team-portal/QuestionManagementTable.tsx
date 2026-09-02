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
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export interface QuestionRow {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
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
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  editedBy?: { id: string; name: string | null; email: string | null } | null;
  review1By?: { id: string; name: string | null; email: string | null } | null;
  review2By?: { id: string; name: string | null; email: string | null } | null;
  publishedBy?: { id: string; name: string | null; email: string | null } | null;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    solution?: string | null;
    options?: any;
  }>;
  isBilingual?: boolean;
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
  };
  usersList: Array<{ id: string; name: string | null; email: string }>;
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
  canCreate,
  canVerify,
  currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters State
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [subject, setSubject] = useState(searchParams.get("subject") || "");
  const [topic, setTopic] = useState(searchParams.get("topic") || "");
  const [subTopic, setSubTopic] = useState(searchParams.get("subTopic") || "");
  const [difficulty, setDifficulty] = useState(searchParams.get("difficulty") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [createdById, setCreatedById] = useState(searchParams.get("createdById") || "");
  const [reviewedById, setReviewedById] = useState(searchParams.get("reviewedById") || "");
  const [editedById, setEditedById] = useState(searchParams.get("editedById") || "");

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

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (subject) params.set("subject", subject);
    if (topic.trim()) params.set("topic", topic.trim());
    if (subTopic.trim()) params.set("subTopic", subTopic.trim());
    if (difficulty) params.set("difficulty", difficulty);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (createdById) params.set("createdById", createdById);
    if (reviewedById) params.set("reviewedById", reviewedById);
    if (editedById) params.set("editedById", editedById);
    params.set("page", "1");
    router.push(`/team/questions?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearch("");
    setSubject("");
    setTopic("");
    setSubTopic("");
    setDifficulty("");
    setType("");
    setStatus("");
    setCreatedById("");
    setReviewedById("");
    setEditedById("");
    router.push("/team/questions");
  };

  const handleQuickStatusTab = (statusTab: string) => {
    setStatus(statusTab);
    const params = new URLSearchParams(searchParams.toString());
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
      {/* 1. TOP SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => handleQuickStatusTab("")}
          className={`p-4 rounded-2xl border text-left transition ${
            !status ? "bg-blue-50/80 border-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">All Questions</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{counts.total}</h3>
        </button>

        <button
          type="button"
          onClick={() => handleQuickStatusTab("PUBLISHED")}
          className={`p-4 rounded-2xl border text-left transition ${
            status === "PUBLISHED"
              ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700">Published (Live)</p>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{counts.published}</h3>
        </button>

        <button
          type="button"
          onClick={() => handleQuickStatusTab("REVIEW_2")}
          className={`p-4 rounded-2xl border text-left transition ${
            status === "REVIEW_2"
              ? "bg-purple-50/80 border-purple-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">In Review 2</p>
            <Clock className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <h3 className="text-2xl font-black text-purple-700 mt-1">{counts.review2}</h3>
        </button>

        <button
          type="button"
          onClick={() => handleQuickStatusTab("REVIEW_1")}
          className={`p-4 rounded-2xl border text-left transition ${
            status === "REVIEW_1"
              ? "bg-amber-50/80 border-amber-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700">In Review 1</p>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <h3 className="text-2xl font-black text-amber-700 mt-1">{counts.review1}</h3>
        </button>

        <button
          type="button"
          onClick={() => handleQuickStatusTab("DRAFT")}
          className={`p-4 rounded-2xl border text-left transition ${
            status === "DRAFT"
              ? "bg-slate-100 border-slate-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">Drafts / Changes</p>
          <h3 className="text-2xl font-black text-slate-700 mt-1">{counts.draft}</h3>
        </button>
      </div>

      {/* 2. STRUCTURED FILTER BAR (Comprehensive yet clean) */}
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
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Mathematics">Mathematics</option>
            </select>
          </div>

          <div>
            <input
              type="text"
              placeholder="Topic / Chapter..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Sub-topic..."
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Row 2: Difficulty, Question Type, Workflow Status, Created By, Reviewed By */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1 border-t border-slate-100">
          <div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">All Workflow Status</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW_1">Review 1 Pending</option>
              <option value="REVIEW_2">Review 2 Pending</option>
              <option value="PUBLISHED">Published (Verified)</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <select
              value={createdById}
              onChange={(e) => setCreatedById(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">Reviewed By (All)</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
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
                <th className="px-6 py-4">Question Preview &amp; ID</th>
                <th className="px-5 py-4">Subject / Topic / Sub-topic</th>
                <th className="px-4 py-4">Difficulty &amp; Type</th>
                <th className="px-5 py-4">Workflow Status</th>
                <th className="px-5 py-4">Reviews &amp; Auditing</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {questions.map((q) => {
                const statementEn = q.translations.find((t) => t.language === "ENGLISH")?.statement;
                const statementHi = q.translations.find((t) => t.language === "HINDI")?.statement;
                const primaryStatement = statementEn || statementHi || q.translations[0]?.statement || "—";
                const displayCode = q.questionCode || `Q-${q.id.slice(0, 6).toUpperCase()}`;

                return (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition group">
                    {/* 1. Question Preview & ID */}
                    <td className="px-6 py-4 max-w-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200">
                            {displayCode}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            v{q.version || 1}
                          </span>
                          {q.translations.length > 1 && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                              Bilingual
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-slate-900 font-medium text-xs leading-relaxed">
                          {primaryStatement}
                        </p>
                      </div>
                    </td>

                    {/* 2. Subject / Topic / Sub-topic */}
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-blue-700 block">{q.subject || "General"}</span>
                        {q.chapter && <span className="text-slate-600 block truncate max-w-[180px]">{q.chapter}</span>}
                        {q.subTopic && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                            ↳ {q.subTopic}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Difficulty & Type */}
                    <td className="px-4 py-4">
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

                    {/* 4. Workflow Status */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {q.status === "PUBLISHED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Published
                          </span>
                        ) : q.status === "REVIEW_2" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 animate-pulse">
                            <Clock className="w-3 h-3 text-purple-600" />
                            Review 2 Pending
                          </span>
                        ) : q.status === "REVIEW_1" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Review 1 Pending
                          </span>
                        ) : q.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            Draft
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 block">
                          By: {q.createdBy?.name || q.createdBy?.email || "Team"}
                        </span>
                      </div>
                    </td>

                    {/* 5. Review Details & Auditing */}
                    <td className="px-5 py-4">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="font-bold text-[10px]">R1:</span>
                          {q.review1Status === "APPROVED" ? (
                            <span className="text-emerald-600 font-bold">✓ Approved ({q.review1By?.name || "Lead"})</span>
                          ) : q.review1Status === "CHANGES_REQUESTED" ? (
                            <span className="text-amber-600">Changes Req.</span>
                          ) : q.status === "REVIEW_1" ? (
                            <span className="text-amber-600 font-medium">Pending...</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-slate-600">
                          <span className="font-bold text-[10px]">R2:</span>
                          {q.review2Status === "APPROVED" ? (
                            <span className="text-emerald-600 font-bold">✓ Approved ({q.review2By?.name || "Admin"})</span>
                          ) : q.status === "REVIEW_2" ? (
                            <span className="text-purple-600 font-medium">Pending...</span>
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Draft -> Submit to Review 1 */}
                        {q.status === "DRAFT" && (
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
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalQuestion({ question: q, stage: "REVIEW_1" });
                              setReviewAction("APPROVE");
                              setReviewNotes("");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Review 1</span>
                          </button>
                        )}

                        {/* Review 2 Action */}
                        {canVerify && q.status === "REVIEW_2" && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalQuestion({ question: q, stage: "REVIEW_2" });
                              setReviewAction("APPROVE");
                              setReviewNotes("");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Review 2</span>
                          </button>
                        )}

                        {/* Edit Question */}
                        <Link
                          href={
                            q.isBilingual || q.translations.length > 1
                              ? `/team/questions/bilingual/${q.id}/edit`
                              : `/team/questions/${q.id}/edit`
                          }
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition"
                          title="Edit Question"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Revision History */}
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(q)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-purple-600 transition"
                          title="View Revision History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(q.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Question"
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
                  const params = new URLSearchParams(searchParams.toString());
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
                  const params = new URLSearchParams(searchParams.toString());
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

      {/* 4. REVIEW ACTION MODAL (Strict Review 1 & Review 2 Workflow) */}
      {reviewModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  {reviewModalQuestion.stage === "REVIEW_1" ? (
                    <>
                      <UserCheck className="w-5 h-5 text-amber-600" />
                      <span>Stage 1: Subject Expert Review</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-purple-600" />
                      <span>Stage 2: Academic Lead Final Approval &amp; Publishing</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Question ID: {reviewModalQuestion.question.questionCode || reviewModalQuestion.question.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Question Brief */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Statement:</span>
              <p className="text-slate-900 line-clamp-3">
                {reviewModalQuestion.question.translations[0]?.statement || "—"}
              </p>
            </div>

            <form onSubmit={handleReviewDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Review Decision *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction("APPROVE")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      reviewAction === "APPROVE"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{reviewModalQuestion.stage === "REVIEW_2" ? "Publish" : "Approve"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction("REQUEST_CHANGES")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      reviewAction === "REQUEST_CHANGES"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Need Fix</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction("REJECT")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      reviewAction === "REJECT"
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Reviewer Notes / Feedback</label>
                <textarea
                  rows={3}
                  placeholder="Add feedback for author or approval remarks..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModalQuestion(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition disabled:opacity-50"
                >
                  {submittingReview ? "Processing..." : "Confirm Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. REVISION HISTORY MODAL */}
      {historyModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" />
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
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
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
    </div>
  );
}
