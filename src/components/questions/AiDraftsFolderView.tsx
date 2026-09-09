"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Clock,
  ArrowLeft,
  CheckSquare,
  Square,
  Send,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  FolderSync,
  Layers,
  HelpCircle,
  Check,
  PlusCircle,
} from "lucide-react";
import { EquationLivePreview } from "./EquationLivePreview";

export interface AiDraftItem {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  category: string | null;
  status: string;
  imageUrl: string | null;
  solution: string | null;
  tags: string | null;
  createdAt: string | Date;
  createdById: string | null;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    solution?: string | null;
    options?: any;
    correctOptionIds?: any;
  }>;
  assets?: Array<{
    id: string;
    type: string;
    publicUrl: string;
  }>;
}

interface Props {
  initialDrafts: AiDraftItem[];
  canCreate: boolean;
  canVerify: boolean;
  currentUserId?: string;
}

function getSourceInfo(category?: string | null, tags?: string | null): {
  label: string;
  badgeClass: string;
  icon: string;
  sourceKey: "DIRECT" | "PDF" | "AI_STUDIO" | "ATOMIC_GURU" | "OTHER";
} {
  const cat = (category || "").toUpperCase();
  const t = (tags || "").toUpperCase();

  if (cat.includes("DIRECT") || t.includes("SOURCE_DIRECT")) {
    return {
      label: "Direct OCR / Paste",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      icon: "camera",
      sourceKey: "DIRECT",
    };
  }
  if (cat.includes("PDF") || t.includes("METHOD_PDF")) {
    return {
      label: "PDF Engine",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      icon: "file",
      sourceKey: "PDF",
    };
  }
  if (cat.includes("ATOMIC_GURU") || t.includes("ATOMIC_GURU")) {
    return {
      label: "Atomic Guru Practice",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      icon: "zap",
      sourceKey: "ATOMIC_GURU",
    };
  }
  if (cat.includes("AI_GENERATED:AI") || cat.includes("AI_DRAFT:AI") || t.includes("METHOD_AI")) {
    return {
      label: "AI Syllabus Engine",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      icon: "sparkles",
      sourceKey: "AI_STUDIO",
    };
  }

  return {
    label: "AI Auto-Draft",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
    icon: "sparkles",
    sourceKey: "OTHER",
  };
}

export function AiDraftsFolderView({
  initialDrafts,
  canCreate,
  canVerify,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AiDraftItem[]>(initialDrafts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    let directCount = 0;
    let pdfCount = 0;
    let aiStudioCount = 0;
    let atomicGuruCount = 0;

    drafts.forEach((d) => {
      const { sourceKey } = getSourceInfo(d.category, d.tags);
      if (sourceKey === "DIRECT") directCount++;
      else if (sourceKey === "PDF") pdfCount++;
      else if (sourceKey === "AI_STUDIO") aiStudioCount++;
      else if (sourceKey === "ATOMIC_GURU") atomicGuruCount++;
    });

    return {
      total: drafts.length,
      directCount,
      pdfCount,
      aiStudioCount,
      atomicGuruCount,
    };
  }, [drafts]);

  // Filtered Drafts
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      // Subject filter
      if (selectedSubject !== "ALL" && d.subject?.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }

      // Source filter
      if (selectedSource !== "ALL") {
        const { sourceKey } = getSourceInfo(d.category, d.tags);
        if (sourceKey !== selectedSource) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = d.questionCode?.toLowerCase().includes(q);
        const chapterMatch = d.chapter?.toLowerCase().includes(q);
        const topicMatch = d.topic?.toLowerCase().includes(q);
        const statementMatch = d.translations?.some((t) =>
          t.statement?.toLowerCase().includes(q)
        );
        if (!codeMatch && !chapterMatch && !topicMatch && !statementMatch) {
          return false;
        }
      }

      return true;
    });
  }, [drafts, selectedSubject, selectedSource, searchQuery]);

  // Handle single question submit to Review 1
  const handleSubmitSingleToReview = async (id: string) => {
    setActiveActionId(id);
    try {
      const res = await fetch(`/api/team/questions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "SUBMIT_TO_REVIEW_1" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to submit for review.");
      }

      toast.success("Question moved from AI Drafts to Stage 1 Review Queue!");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActiveActionId(null);
    }
  };

  // Handle single question delete
  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this AI draft? This cannot be undone.")) {
      return;
    }

    setActiveActionId(id);
    try {
      const res = await fetch(`/api/team/questions/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to delete draft.");
      }

      toast.success("AI Draft deleted successfully!");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete draft.");
    } finally {
      setActiveActionId(null);
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: "SUBMIT_TO_REVIEW_1" | "DELETE" | "PUBLISH") => {
    if (selectedIds.length === 0) {
      toast.info("Please select at least one question.");
      return;
    }

    if (action === "DELETE") {
      if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} drafts?`)) {
        return;
      }
    }

    setIsProcessingBulk(true);
    try {
      const res = await fetch("/api/team/questions/drafts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: selectedIds, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Bulk action failed.");
      }

      toast.success(json.data?.message || "Bulk operation completed successfully!");
      setDrafts((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed.");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredDrafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDrafts.map((d) => d.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 select-none font-sans pb-32">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/team/questions"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Question Bank</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              AI Drafts Repository
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-6 h-6" />
            </span>
            <span>AI Drafts Folder (एआई ड्राफ्ट फोल्डर)</span>
          </h1>

          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            All questions generated or extracted via <strong>Direct OCR Paste</strong>, <strong>PDF Extraction</strong>,{" "}
            <strong>AI Syllabus Engine</strong>, or <strong>Atomic Guru Practice</strong> are automatically saved here instantly.
            Never lose your questions even if the file closes or browser crashes. Review, edit, and approve them at your own pace!
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Link
            href="/team/questions/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Question (OCR / Paste)</span>
          </Link>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setSelectedSource("ALL")}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedSource === "ALL"
              ? "bg-blue-50/80 border-blue-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">All AI Drafts</p>
          <h3 className="text-2xl font-black text-blue-900 mt-1">{stats.total}</h3>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSource("DIRECT")}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedSource === "DIRECT"
              ? "bg-blue-50/80 border-blue-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700">Direct OCR / Paste</p>
            <span className="material-symbols-outlined text-sm text-blue-600">crop_free</span>
          </div>
          <h3 className="text-2xl font-black text-blue-700 mt-1">{stats.directCount}</h3>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSource("PDF")}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedSource === "PDF"
              ? "bg-blue-50/80 border-blue-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700">PDF Generator</p>
            <span className="material-symbols-outlined text-sm text-blue-600">picture_as_pdf</span>
          </div>
          <h3 className="text-2xl font-black text-blue-700 mt-1">{stats.pdfCount}</h3>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSource("AI_STUDIO")}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedSource === "AI_STUDIO"
              ? "bg-blue-50/80 border-blue-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-700">AI Syllabus Engine</p>
            <span className="material-symbols-outlined text-sm text-blue-600">auto_stories</span>
          </div>
          <h3 className="text-2xl font-black text-blue-700 mt-1">{stats.aiStudioCount}</h3>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSource("ATOMIC_GURU")}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedSource === "ATOMIC_GURU"
              ? "bg-amber-50/80 border-amber-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700">Atomic Guru Practice</p>
            <span className="material-symbols-outlined text-sm text-amber-600">psychology</span>
          </div>
          <h3 className="text-2xl font-black text-amber-700 mt-1">{stats.atomicGuruCount}</h3>
        </button>
      </div>

      {/* 3. SEARCH & FILTERS BAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search statement, topic, chapter, question code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-bold outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="ALL">All Subjects</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Mathematics">Mathematics</option>
          </select>

          <span className="text-xs font-mono font-bold text-slate-400 px-2">
            Showing {filteredDrafts.length} drafts
          </span>
        </div>
      </div>

      {/* 4. BULK ACTIONS TOOLBAR */}
      {filteredDrafts.length > 0 && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-900 cursor-pointer"
            >
              {selectedIds.length === filteredDrafts.length ? (
                <CheckSquare className="w-4 h-4 text-blue-700" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedIds.length === filteredDrafts.length
                  ? "Deselect All"
                  : `Select All (${filteredDrafts.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-xs font-black text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
                {selectedIds.length} Selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkAction("SUBMIT_TO_REVIEW_1")}
                disabled={isProcessingBulk}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Selected to Stage 1 Review</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction("DELETE")}
                disabled={isProcessingBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black border border-rose-200 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. DRAFTS LIST */}
      {filteredDrafts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-800">No AI Drafts Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedSource !== "ALL" || selectedSubject !== "ALL"
              ? "No drafts match your current search and filters. Try clearing filters."
              : "No auto-saved AI questions currently in draft. Questions extracted or generated will instantly appear here!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrafts.map((item) => {
            const { label: sourceLabel, badgeClass: sourceBadgeClass } = getSourceInfo(
              item.category,
              item.tags
            );
            const isSelected = selectedIds.includes(item.id);
            const enTrans = item.translations?.find((t) => t.language === "ENGLISH");
            const hiTrans = item.translations?.find((t) => t.language === "HINDI");
            const displayStatement = enTrans?.statement || hiTrans?.statement || "No statement text";
            const isWorking = activeActionId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-sm transition space-y-4 ${
                  isSelected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectOne(item.id)}
                      className="text-slate-400 hover:text-blue-600 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">
                      #{item.questionCode || item.id.slice(-8)}
                    </span>

                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${sourceBadgeClass}`}>
                      {sourceLabel}
                    </span>

                    <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {item.subject}
                    </span>
                    {item.chapter && (
                      <span className="text-xs text-slate-500 font-medium hidden md:inline">
                        • {item.chapter}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      Auto-Saved Draft
                    </span>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Card Body: Bilingual Snippet & Diagram */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className={`${item.imageUrl ? "lg:col-span-9" : "lg:col-span-12"} space-y-2`}>
                    {/* English Statement */}
                    {enTrans?.statement && (
                      <div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">English:</span>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed mt-0.5 line-clamp-3">
                          {enTrans.statement}
                        </p>
                      </div>
                    )}

                    {/* Hindi Statement */}
                    {hiTrans?.statement && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">हिंदी:</span>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed mt-0.5 line-clamp-3">
                          {hiTrans.statement}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Diagram thumbnail if available */}
                  {item.imageUrl && (
                    <div className="lg:col-span-3 flex items-center justify-center p-2 bg-slate-50 rounded-2xl border border-slate-200/80 max-h-28 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt="Question Diagram"
                        className="max-h-24 object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                      {item.difficulty}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                      {item.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/team/questions/${item.id}/edit`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Review &amp; Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleSubmitSingleToReview(item.id)}
                      disabled={isWorking}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isWorking ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Submit to Review 1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(item.id)}
                      disabled={isWorking}
                      className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
