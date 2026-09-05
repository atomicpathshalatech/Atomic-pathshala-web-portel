"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Bell,
  Pin,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Megaphone,
  BookOpen,
  FileCheck,
  Check,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";

export interface ChapterNoticeItem {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  category: "ANNOUNCEMENT" | "IMPORTANT" | "EXAM" | "HOMEWORK" | "GENERAL" | string;
  isPinned: boolean;
  authorName: string;
  authorRole: string;
  createdById?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; badgeBg: string; textColor: string; borderColor: string }> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    icon: Megaphone,
    badgeBg: "bg-blue-50 dark:bg-blue-950/60",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  IMPORTANT: {
    label: "Important Alert",
    icon: AlertCircle,
    badgeBg: "bg-rose-50 dark:bg-rose-950/60",
    textColor: "text-rose-700 dark:text-rose-300",
    borderColor: "border-rose-200 dark:border-rose-800",
  },
  EXAM: {
    label: "Test / Exam Update",
    icon: FileCheck,
    badgeBg: "bg-purple-50 dark:bg-purple-950/60",
    textColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  HOMEWORK: {
    label: "Homework & DPP",
    icon: BookOpen,
    badgeBg: "bg-amber-50 dark:bg-amber-950/60",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  GENERAL: {
    label: "General Notice",
    icon: Bell,
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
  },
};

const DEFAULT_CATEGORY = {
  label: "General Notice",
  icon: Bell,
  badgeBg: "bg-slate-100 dark:bg-slate-800",
  textColor: "text-slate-700 dark:text-slate-300",
  borderColor: "border-slate-200 dark:border-slate-700",
};

interface TeacherChapterNoticeBoardProps {
  chapterId: string;
  chapterTitle: string;
  isOpen: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onNoticeCountChange?: (count: number) => void;
}

export function TeacherChapterNoticeBoard({
  chapterId,
  chapterTitle,
  isOpen,
  onClose,
  canEdit = true,
  onNoticeCountChange,
}: TeacherChapterNoticeBoardProps) {
  const [notices, setNotices] = useState<ChapterNoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<string>("ANNOUNCEMENT");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch notices
  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/chapters/${chapterId}/notices`);
      const data = await res.json();
      if (data.success && Array.isArray(data.notices)) {
        setNotices(data.notices);
        onNoticeCountChange?.(data.notices.length);
      }
    } catch (err) {
      console.error("Failed to load notices:", err);
      toast.error("Failed to load notices");
    } finally {
      setLoading(false);
    }
  }, [chapterId, onNoticeCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchNotices();
    }
  }, [isOpen, fetchNotices]);

  // Reset form
  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("ANNOUNCEMENT");
    setFormIsPinned(false);
    setShowCreateForm(false);
    setEditingNoticeId(null);
  };

  // Populate form for editing
  const startEditing = (notice: ChapterNoticeItem) => {
    setEditingNoticeId(notice.id);
    setFormTitle(notice.title);
    setFormContent(notice.content);
    setFormCategory(notice.category || "ANNOUNCEMENT");
    setFormIsPinned(notice.isPinned);
    setShowCreateForm(true);
  };

  // Submit create or edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Please provide both title and notice content");
      return;
    }

    try {
      setSubmitting(true);
      if (editingNoticeId) {
        // PATCH
        const res = await fetch(`/api/chapters/${chapterId}/notices/${editingNoticeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            isPinned: formIsPinned,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Notice updated successfully");
          resetForm();
          fetchNotices();
        } else {
          toast.error(data.error || "Failed to update notice");
        }
      } else {
        // POST
        const res = await fetch(`/api/chapters/${chapterId}/notices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            isPinned: formIsPinned,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Notice posted to Chapter Notice Board!");
          resetForm();
          fetchNotices();
        } else {
          toast.error(data.error || "Failed to post notice");
        }
      }
    } catch (err) {
      console.error("Failed to save notice:", err);
      toast.error("Network error saving notice");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle pin
  const handleTogglePin = async (notice: ChapterNoticeItem) => {
    try {
      const newPinned = !notice.isPinned;
      const res = await fetch(`/api/chapters/${chapterId}/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: newPinned }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(newPinned ? "Notice pinned to top 📌" : "Notice unpinned");
        fetchNotices();
      }
    } catch (err) {
      toast.error("Failed to update pin status");
    }
  };

  // Delete notice
  const handleDelete = async (noticeId: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      const res = await fetch(`/api/chapters/${chapterId}/notices/${noticeId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Notice deleted");
        fetchNotices();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (err) {
      toast.error("Failed to delete notice");
    }
  };

  // Filtered notices
  const filteredNotices = notices.filter((n) => {
    const matchesCategory =
      activeCategoryFilter === "ALL" || n.category === activeCategoryFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const pinnedCount = notices.filter((n) => n.isPinned).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 relative flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-extrabold uppercase tracking-wider">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Chapter Notice Board</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {notices.length} Notice{notices.length === 1 ? "" : "s"}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
              {chapterTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && !showCreateForm && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Post Notice</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Create / Edit Notice Form Drawer */}
          {showCreateForm && (
            <form
              onSubmit={handleSubmit}
              className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-slate-50 dark:from-slate-800/80 dark:to-slate-800/40 border-2 border-indigo-200 dark:border-indigo-800/80 space-y-4 shadow-sm animate-in slide-in-from-top duration-200"
            >
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {editingNoticeId ? "Edit Notice" : "Post New Chapter Notice"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
                >
                  Cancel
                </button>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notice Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const isSelected = formCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormCategory(key)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                          isSelected
                            ? `${cfg.badgeBg} ${cfg.textColor} ${cfg.borderColor} ring-2 ring-indigo-500`
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cfg.label.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notice Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Live Doubt Session Today at 6 PM / DPP 03 Solutions Live"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Notice Content */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notice Content & Instructions *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write complete notice details, guidelines, or schedule updates for students..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Pin to Top Checkbox & Submit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Pin to Top of Chapter Board</span>
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingNoticeId ? "Update Notice" : "Publish Notice"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                  activeCategoryFilter === "ALL"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All ({notices.length})
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                const count = notices.filter((n) => n.category === key).length;
                if (count === 0 && notices.length > 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveCategoryFilter(key)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                      activeCategoryFilter === key
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {cfg.label.split(" ")[0]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notices Feed List */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading chapter notices...</span>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="py-14 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                No Notices on the Board Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Post chapter-specific alerts, extra class schedules, test syllabus notes, or homework announcements here for your students.
              </p>
              {canEdit && !showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post First Notice</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredNotices.map((notice) => {
                const cfg = CATEGORY_CONFIG[notice.category] || DEFAULT_CATEGORY;
                const Icon = cfg.icon;
                const formattedDate = new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(notice.createdAt));

                return (
                  <div
                    key={notice.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      notice.isPinned
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-400/30"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs"
                    }`}
                  >
                    {/* Notice Card Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Pinned Badge */}
                        {notice.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wide shadow-xs">
                            <Pin className="w-3 h-3 fill-slate-950" />
                            <span>PINNED NOTICE</span>
                          </span>
                        )}

                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${cfg.badgeBg} ${cfg.textColor} ${cfg.borderColor}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{cfg.label}</span>
                        </span>

                        <span className="text-[11px] text-slate-400 font-medium">
                          &bull; {formattedDate}
                        </span>
                      </div>

                      {/* Action Menu (Pin / Edit / Delete) */}
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(notice)}
                            title={notice.isPinned ? "Unpin Notice" : "Pin to Top"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                              notice.isPinned
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            <Pin className={`w-3.5 h-3.5 ${notice.isPinned ? "fill-current" : ""}`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditing(notice)}
                            title="Edit Notice"
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(notice.id)}
                            title="Delete Notice"
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notice Title */}
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-2.5 mb-1.5 leading-snug">
                      {notice.title}
                    </h3>

                    {/* Notice Content with multi-line preserve */}
                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {notice.content}
                    </div>

                    {/* Author Signature Line */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span>Posted by:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {notice.authorName}
                        </strong>
                        <span className="text-[10px] text-slate-400 uppercase">
                          ({notice.authorRole})
                        </span>
                      </span>

                      <span className="text-[10px] text-slate-400">
                        Official Academic Board
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Visible to all enrolled students in this chapter</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
