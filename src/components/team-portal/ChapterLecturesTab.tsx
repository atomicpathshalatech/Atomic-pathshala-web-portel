"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export interface LectureItem {
  id: string;
  title: string;
  videoUrl: string;
  educatorVideoUrl?: string | null;
  slidesUrl?: string | null;
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

  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [educatorVideoUrl, setEducatorVideoUrl] = useState("");
  const [slidesUrl, setSlidesUrl] = useState("");
  const [language, setLanguage] = useState(
    chapterMedium === "HINDI" ? "Hindi" : chapterMedium === "HINGLISH" ? "Hinglish" : "English"
  );
  const [order, setOrder] = useState<number>(lectures.length + 1);
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoUrl.trim()) {
      setError("Please enter both lecture title and stream/video URL.");
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
          videoUrl: videoUrl.trim(),
          educatorVideoUrl: educatorVideoUrl.trim() || undefined,
          slidesUrl: slidesUrl.trim() || undefined,
          language,
          order: Number(order),
          status,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to add lecture.");
        return;
      }

      setLectures((prev) => [...prev, json.data.lecture]);
      setShowModal(false);
      setTitle("");
      setVideoUrl("");
      setEducatorVideoUrl("");
      setSlidesUrl("");
      setOrder(lectures.length + 2);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Lectures & YouTube Unlisted Live Classes</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 text-xs font-mono">
            {lectures.length}
          </span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs shadow hover:bg-amber-400 transition"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>+ Add Lecture / Live Class</span>
          </button>
        )}
      </div>

      {lectures.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 border border-dashed border-slate-700">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">smart_display</span>
          </div>
          <h4 className="text-sm font-bold text-white">No Lectures Added Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Schedule live YouTube Unlisted classes, embed recorded lectures, and attach class notes for {chapterTitle}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs shadow hover:bg-amber-400"
            >
              + Add First Lecture
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {lectures.map((l, idx) => (
            <div
              key={l.id}
              className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                    {l.order || idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white line-clamp-1">{l.title}</h4>
                    <p className="text-[11px] text-slate-400">
                      {l.language} · {l.teacher?.user?.name ? `Faculty: ${l.teacher.user.name}` : "Faculty Assigned"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    l.status === "PUBLISHED"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {l.status}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <a
                  href={l.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                >
                  <span className="material-symbols-outlined text-xs text-red-400">play_circle</span>
                  <span>Watch Stream</span>
                </a>

                {l.slidesUrl && (
                  <a
                    href={l.slidesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                  >
                    <span className="material-symbols-outlined text-xs text-amber-400">description</span>
                    <span>Notes PDF</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">video_call</span>
                Add Lecture / YouTube Live
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lecture Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture 01 — Bohr's Atomic Model & Energy States"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Video / YouTube Unlisted Stream URL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://www.youtube.com/watch?v=xxxx or unlisted link"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sequence Order</label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                  >
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Lecture Slides / Notes PDF URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://.../notes.pdf"
                  value={slidesUrl}
                  onChange={(e) => setSlidesUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Publish Status</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="PUBLISHED"
                      checked={status === "PUBLISHED"}
                      onChange={() => setStatus("PUBLISHED")}
                    />
                    <span>Published (Live for students)</span>
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

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400"
                >
                  {submitting ? "Saving..." : "Add Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}