"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreVertical, Edit2, FileText, Trash2, Video, Calendar, Clock, Timer, Check, Sparkles } from "lucide-react";

export interface LectureItem {
  id: string;
  title: string;
  videoUrl: string;
  educatorVideoUrl?: string | null;
  slidesUrl?: string | null;
  scheduledDate?: string | Date | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMin?: number | null;
  language: string;
  order: number;
  status: string;
  createdAt: string | Date;
  teacher?: {
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

export function ChapterLecturesTab({
  chapterId,
  chapterTitle,
  chapterMedium,
  lectures: initialLectures,
  canEdit,
}: {
  chapterId: string;
  chapterTitle: string;
  chapterMedium: string;
  lectures: LectureItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureItem[]>(initialLectures);

  useEffect(() => {
    setLectures(initialLectures);
  }, [initialLectures]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState<LectureItem | null>(null);
  const [notesModalLecture, setNotesModalLecture] = useState<LectureItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form State for Adding / Editing
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split("T")[0] || ""
  );
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [order, setOrder] = useState<number>(lectures.length + 1);
  const [language, setLanguage] = useState(
    chapterMedium === "HINDI" ? "Hindi" : chapterMedium === "HINGLISH" ? "Hinglish" : "English"
  );
  const [notesUrl, setNotesUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Open Add Modal
  function handleOpenAdd() {
    setTitle("");
    setScheduledDate(new Date().toISOString().split("T")[0] || "");
    setStartTime("10:00");
    setDurationMin(60);
    setOrder(lectures.length + 1);
    setLanguage(chapterMedium === "HINDI" ? "Hindi" : chapterMedium === "HINGLISH" ? "Hinglish" : "English");
    setError("");
    setShowAddModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(lec: LectureItem) {
    setActiveMenuId(null);
    setEditingLecture(lec);
    setTitle(lec.title);
    setScheduledDate(
      lec.scheduledDate
        ? new Date(lec.scheduledDate).toISOString().split("T")[0] || ""
        : new Date().toISOString().split("T")[0] || ""
    );
    setStartTime(lec.startTime || "10:00");
    setDurationMin(lec.durationMin || 60);
    setLanguage(lec.language || "Hindi");
    setError("");
  }

  // Open Notes Modal
  function handleOpenNotes(lec: LectureItem) {
    setActiveMenuId(null);
    setNotesModalLecture(lec);
    setNotesUrl(lec.slidesUrl || "");
    setError("");
  }

  // Add Lecture Submit
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter lecture title.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          startTime: startTime || null,
          durationMin: Number(durationMin) || 60,
          language,
          order: Number(order) || lectures.length + 1,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to schedule lecture.");
        return;
      }

      setLectures((prev) => [...prev, json.data.lecture]);
      setShowAddModal(false);
      toast.success("Lecture scheduled successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Lecture Submit
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture || !title.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${editingLecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          startTime: startTime || null,
          durationMin: Number(durationMin) || 60,
          language,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to update lecture.");
        return;
      }

      setLectures((prev) =>
        prev.map((l) => (l.id === editingLecture.id ? json.data.lecture : l))
      );
      setEditingLecture(null);
      toast.success("Lecture updated successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Notes Submit
  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesModalLecture) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${notesModalLecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slidesUrl: notesUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to save notes.");
        return;
      }

      setLectures((prev) =>
        prev.map((l) => (l.id === notesModalLecture.id ? json.data.lecture : l))
      );
      setNotesModalLecture(null);
      toast.success("Class notes attached successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Lecture
  const handleDelete = async (lecId: string) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this lecture?")) return;

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${lecId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to delete lecture.");
        return;
      }

      setLectures((prev) => prev.filter((l) => l.id !== lecId));
      toast.success("Lecture deleted.");
      router.refresh();
    } catch {
      toast.error("Network error while deleting lecture.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Chapter Lectures</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold">
              {lectures.length} Total
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Schedule lecture roadmap with live studio access &amp; attached class notes.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Schedule Lecture</span>
          </button>
        )}
      </div>

      {lectures.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-10 text-center space-y-3 border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">event_available</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Lectures Scheduled Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Schedule lectures with date, start time, duration, and faculty for {chapterTitle}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-500 transition"
            >
              + Schedule First Lecture
            </button>
          )}
        </div>
      ) : (
        /* Vertical List Form */
        <div className="space-y-3">
          {lectures.map((l, idx) => {
            const displayOrder = l.order || idx + 1;
            const formattedDate = l.scheduledDate
              ? new Date(l.scheduledDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Date Not Set";

            return (
              <div
                key={l.id}
                className="bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative"
              >
                {/* Left: Sequence Badge + Title & Scheduling Details */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex flex-col items-center justify-center font-bold shrink-0 shadow-sm">
                    <span className="text-[9px] uppercase tracking-wider text-blue-500 font-bold">LEC</span>
                    <span className="text-sm font-black font-mono leading-none">
                      {String(displayOrder).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                        {l.title}
                      </h4>
                      {l.slidesUrl && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <FileText className="w-3 h-3" />
                          <span>Notes Attached</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{formattedDate}</span>
                      </span>

                      {l.startTime && (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>{l.startTime}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Timer className="w-3.5 h-3.5 text-blue-500" />
                        <span>{l.durationMin || 60} mins</span>
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{l.language}</span>

                      {l.teacher?.user?.name && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-blue-600 dark:text-blue-300 font-medium">Faculty: {l.teacher.user.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Single "Start Class" Button + 3-Dot Options Menu */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Single Primary Action: Start Class */}
                  <Link
                    href={`/team/live-class/${l.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition text-xs font-bold shadow-md shadow-blue-500/20"
                    title="Enter live classroom"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Start Class</span>
                  </Link>

                  {/* 3-Dot Menu Dropdown */}
                  {canEdit && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === l.id ? null : l.id)}
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === l.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5 animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(l)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit Lecture</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenNotes(l)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-500" />
                            <span>Add / Edit Notes</span>
                          </button>

                          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                          <button
                            type="button"
                            onClick={() => handleDelete(l.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Lecture</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. SCHEDULE / ADD LECTURE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Schedule Lecture
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture 01 — Bohr's Atomic Model & Energy States"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sequence Order #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>
              </div>

              {/* Informational Box about Batch Scheduling */}
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
                <Sparkles className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Auto-Scheduled on Chapter Submission</p>
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                    Date, time aur duration authoring ke time enter karne ki zaroorat nahi hai. Jab aap chapter complete karke <strong>Submit / Publish for Review</strong> karenge, tab aap Weekdays (e.g. Mon, Wed, Fri) aur Duration (e.g. 90m) select karke sabhi classes automatically future dates me schedule kar sakenge.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1">
                  <p className="text-xs font-semibold text-red-500">{error}</p>
                  {error.includes("DPP") && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      💡 <strong>System Rule:</strong> Har 2 Lectures ke baad DPP create karke questions submit karna compulsory hai. Pehle <strong>DPPs Tab</strong> me jakar required DPP submit karein, fir agla lecture schedule ho jayega.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-md transition"
                >
                  {submitting ? "Scheduling..." : "Schedule Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT LECTURE MODAL */}
      {editingLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Edit Lecture Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingLecture(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Duration (Mins)
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLecture(null)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-md transition"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT NOTES MODAL */}
      {notesModalLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Class Notes &amp; PDF for {notesModalLecture.title}
              </h3>
              <button
                type="button"
                onClick={() => setNotesModalLecture(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lecture Notes PDF URL / Cloud Link
                </label>
                <input
                  type="text"
                  placeholder="https://.../lecture-notes.pdf"
                  value={notesUrl}
                  onChange={(e) => setNotesUrl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Students will be able to view and download these handwritten notes in their app.
                </p>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNotesModalLecture(null)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-md transition"
                >
                  {submitting ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}