"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

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
  const [showModal, setShowModal] = useState(false);

  // Form State for Scheduling Lecture
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
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

  // Optional Links
  const [showAdvancedLinks, setShowAdvancedLinks] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [slidesUrl, setSlidesUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
          status,
          videoUrl: videoUrl.trim() || undefined,
          slidesUrl: slidesUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to schedule lecture.");
        return;
      }

      setLectures((prev) => [...prev, json.data.lecture]);
      setShowModal(false);
      setTitle("");
      setVideoUrl("");
      setSlidesUrl("");
      setOrder(lectures.length + 2);
      toast.success("Lecture scheduled successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Lectures &amp; Live Classes</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 text-xs font-mono">
            {lectures.length}
          </span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setOrder(lectures.length + 1);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs shadow hover:bg-amber-400 transition"
          >
            <span className="material-symbols-outlined text-base">calendar_add_on</span>
            <span>+ Schedule Lecture</span>
          </button>
        )}
      </div>

      {lectures.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 border border-dashed border-slate-700">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">event_available</span>
          </div>
          <h4 className="text-sm font-bold text-white">No Lectures Scheduled Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Schedule lectures with date, time, and duration for {chapterTitle}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setOrder(1);
                setShowModal(true);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs shadow hover:bg-amber-400"
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
              : null;

            return (
              <div
                key={l.id}
                className="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Sequence Badge + Title & Meta Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 flex flex-col items-center justify-center font-bold shrink-0 shadow-sm">
                    <span className="text-[9px] uppercase tracking-wider text-amber-300 font-medium">Lec</span>
                    <span className="text-sm font-black font-mono leading-none">
                      {String(displayOrder).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate max-w-lg">{l.title}</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          l.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      {formattedDate && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="material-symbols-outlined text-xs text-amber-400">calendar_today</span>
                          <span>{formattedDate}</span>
                        </span>
                      )}

                      {l.startTime && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="material-symbols-outlined text-xs text-amber-400">schedule</span>
                          <span>{l.startTime}</span>
                        </span>
                      )}

                      {l.durationMin && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="material-symbols-outlined text-xs text-amber-400">timer</span>
                          <span>{l.durationMin} mins</span>
                        </span>
                      )}

                      <span className="text-slate-500">•</span>
                      <span>{l.language}</span>

                      {l.teacher?.user?.name && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-amber-200/80">Faculty: {l.teacher.user.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    href={`/whiteboard?scheduleId=${l.id}&chapterId=${chapterId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-300 transition text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-sm">draw</span>
                    <span>Live Studio</span>
                  </Link>

                  {l.videoUrl ? (
                    <a
                      href={l.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-xs text-red-400">play_circle</span>
                      <span>Watch</span>
                    </a>
                  ) : null}

                  {l.slidesUrl && (
                    <a
                      href={l.slidesUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-xs text-amber-400">description</span>
                      <span>Notes</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SCHEDULE LECTURE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-[#141724] border border-[#2d3247] p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">event_available</span>
                Schedule Lecture / Class
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Lecture Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Lecture Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture 01 — Bohr's Atomic Model & Energy States"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2.5 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Date & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Schedule Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2.5 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2.5 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration & Sequence Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Duration (Mins)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={15}
                      step={5}
                      value={durationMin}
                      onChange={(e) => setDurationMin(Number(e.target.value))}
                      className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[45, 60, 90, 120].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationMin(d)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition ${
                          durationMin === d
                            ? "bg-amber-500 text-black"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Sequence Order</label>
                  <input
                    type="number"
                    min={1}
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                    className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2.5 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Language & Publish Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#1c2032] border border-[#2d3247] px-3.5 py-2.5 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Publish Status</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="PUBLISHED"
                        checked={status === "PUBLISHED"}
                        onChange={() => setStatus("PUBLISHED")}
                      />
                      <span>Published</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="DRAFT"
                        checked={status === "DRAFT"}
                        onChange={() => setStatus("DRAFT")}
                      />
                      <span>Draft</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Optional Advanced Links Accordion */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedLinks(!showAdvancedLinks)}
                  className="text-xs text-slate-400 hover:text-amber-400 font-bold flex items-center gap-1 transition"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showAdvancedLinks ? "expand_less" : "expand_more"}
                  </span>
                  <span>Optional External Stream / Notes Links</span>
                </button>

                {showAdvancedLinks && (
                  <div className="space-y-3 pt-2.5 border-t border-slate-800/60 mt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Optional Video / YouTube Stream URL
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://www.youtube.com/watch?v=xxxx (Optional)"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full bg-[#1c2032] border border-[#2d3247] px-3 py-2 rounded-lg text-xs text-white focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Optional Lecture Notes PDF URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://.../notes.pdf (Optional)"
                        value={slidesUrl}
                        onChange={(e) => setSlidesUrl(e.target.value)}
                        className="w-full bg-[#1c2032] border border-[#2d3247] px-3 py-2 rounded-lg text-xs text-white focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-md transition"
                >
                  {submitting ? "Saving..." : "Schedule Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}