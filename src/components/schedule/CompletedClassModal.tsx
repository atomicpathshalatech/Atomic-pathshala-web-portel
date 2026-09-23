"use client";

import React, { useEffect, useState } from "react";
import { LectureVideoPlayer } from "@/components/video-player/LectureVideoPlayer";

export interface CompletedClassAssets {
  scheduleId: string;
  sessionId: string | null;
  title: string;
  subject: string | null;
  batchId: string;
  batchName: string;
  thumbnailUrl?: string | null;
  teacherName: string;
  teacherImage?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  recording: {
    status: "READY" | "PROCESSING" | "FAILED" | "NONE";
    url: string | null;
    durationSeconds: number | null;
    type: "VIDEO" | "YOUTUBE";
  };
  notes: {
    status: "READY" | "PROCESSING" | "UNAVAILABLE";
    downloadUrl: string | null;
    filename: string | null;
    hasOriginalSlides: boolean;
    originalDownloadUrl: string | null;
    originalFilename: string | null;
  };
}

function formatISTTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getSubjectBadge(subject?: string | null) {
  const s = (subject || "").toLowerCase();
  if (s.includes("phys")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (s.includes("chem")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo"))
    return "bg-green-500/15 text-green-400 border-green-500/30";
  if (s.includes("math")) return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
  return "bg-orange-500/15 text-orange-400 border-orange-500/30";
}

export function CompletedClassModal({
  scheduleId,
  classTitle,
  subject,
  batchName,
  teacherName,
  startsAt,
  endsAt,
  onClose,
}: {
  scheduleId: string;
  classTitle: string;
  subject?: string | null;
  batchName?: string;
  teacherName?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<CompletedClassAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesType, setNotesType] = useState<"annotated" | "original">("annotated");
  const [activeTab, setActiveTab] = useState<"notes" | "overview">("notes");
  const [isNotesFullscreen, setIsNotesFullscreen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch authoritative assets
  useEffect(() => {
    let active = true;

    async function fetchAssets() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/schedule/${scheduleId}/assets`);
        const json = await res.json();

        if (!active) return;

        if (!res.ok || !json.success) {
          setError(json.error || "Could not load class assets.");
          return;
        }

        setAssets(json.data);
      } catch (err: any) {
        if (active) setError(err?.message || "Failed to load class assets.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAssets();

    return () => {
      active = false;
    };
  }, [scheduleId]);

  const activeNotesUrl =
    notesType === "original" && assets?.notes.originalDownloadUrl
      ? assets.notes.originalDownloadUrl
      : assets?.notes.downloadUrl;

  const subjectBadgeClass = getSubjectBadge(subject);
  const startTimeStr = formatISTTime(startsAt);
  const endTimeStr = formatISTTime(endsAt);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4 bg-slate-950 sm:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 select-none overflow-hidden"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative bg-slate-950 rounded-none sm:rounded-3xl border-0 sm:border sm:border-white/10 shadow-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Floating Close Button (always visible when video isn't ready or on error) */}
        {(loading || error || assets?.recording.status !== "READY") && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-40 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition border border-white/20 cursor-pointer shadow-lg"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}

        {/* 1. CLASS VIDEO PLAYER: Pinned at top on mobile (YouTube mobile style), 16:9 ratio */}
        <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden shrink-0 sticky top-0 z-30 shadow-lg">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
              <span className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span>Loading class...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-rose-400 text-xs flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl">error</span>
              <p>{error}</p>
            </div>
          ) : assets?.recording.status === "READY" && assets.recording.url ? (
            <LectureVideoPlayer
              mode="recorded"
              lectureId={scheduleId}
              title={classTitle}
              subjectTitle={subject || undefined}
              educatorName={teacherName || undefined}
              posterUrl={assets.thumbnailUrl || undefined}
              videoUrl={assets.recording.url}
              onClose={onClose}
            />
          ) : assets?.recording.status === "PROCESSING" ? (
            <div className="flex flex-col items-center justify-center text-center p-6 text-amber-400 gap-2">
              <span className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-400 rounded-full animate-spin mb-1" />
              <p className="text-sm font-bold text-white">Recording is processing</p>
              <p className="text-xs text-slate-400 max-w-sm">
                The recording is being processed and will be ready shortly.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400 gap-2">
              <span className="material-symbols-outlined text-4xl text-slate-600">videocam_off</span>
              <p className="text-sm font-bold text-slate-300">Recording is currently unavailable</p>
            </div>
          )}
        </div>

        {/* 2. LOWER SECTION: Below the Video Player (Title, Details, Notes Option & Viewer) */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-slate-950 text-white divide-y divide-white/10">
          {/* Header row: Class title, badges, timing */}
          <div className="p-3.5 sm:p-4.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {subject && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${subjectBadgeClass}`}
                  >
                    {subject}
                  </span>
                )}
                {batchName && (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-white/5">
                    {batchName}
                  </span>
                )}
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                  <span>{startTimeStr} - {endTimeStr}</span>
                </span>
              </div>

              {/* Close Button on Desktop/Mobile Header */}
              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white items-center justify-center transition border border-white/10 cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug">
              {classTitle}
            </h3>

            {teacherName && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="material-symbols-outlined text-base text-blue-400">school</span>
                <span className="font-semibold text-slate-300">{teacherName}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Faculty</span>
              </div>
            )}

            {/* Navigation Tabs: Notes (नोट्स PDF) & Overview (विवरण) */}
            <div className="flex items-center gap-2 mt-1 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "notes"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-base">description</span>
                <span>Notes (नोट्स PDF)</span>
                {assets?.notes?.status === "READY" && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/30">
                    PDF
                  </span>
                )}
                {assets?.notes?.status === "PROCESSING" && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/30 animate-pulse">
                    Processing
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-base">info</span>
                <span>Overview (विवरण)</span>
              </button>
            </div>
          </div>

          {/* Tab Content 1: Notes (नोट्स PDF) */}
          {activeTab === "notes" && (
            <div className="p-3.5 sm:p-4.5 flex flex-col gap-3 flex-1 min-h-0">
              {/* Notes Action Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {assets?.notes?.hasOriginalSlides && assets.notes.originalDownloadUrl && (
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => setNotesType("annotated")}
                        className={`py-1 px-2.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                          notesType === "annotated"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Annotated Board
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotesType("original")}
                        className={`py-1 px-2.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                          notesType === "original"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Original Slides
                      </button>
                    </div>
                  )}
                </div>

                {assets?.notes?.status === "READY" && activeNotesUrl && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setIsNotesFullscreen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition shadow-xs cursor-pointer"
                      title="Open full screen in app"
                    >
                      <span className="material-symbols-outlined text-sm">fullscreen</span>
                      <span>Open Full</span>
                    </button>

                    <a
                      href={activeNotesUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      <span>Download PDF</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Embedded In-App PDF Viewer (Rendered directly in the lower section) */}
              {assets?.notes?.status === "READY" && activeNotesUrl ? (
                <div className="w-full flex-1 min-h-[350px] sm:min-h-[460px] rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-xl flex flex-col">
                  <iframe
                    src={`${activeNotesUrl}#toolbar=0&navpanes=0`}
                    title="Class Notes PDF Viewer"
                    className="w-full flex-1 border-0 min-h-[350px] sm:min-h-[460px] bg-slate-800"
                  />
                </div>
              ) : assets?.notes?.status === "PROCESSING" ? (
                <div className="flex-1 min-h-[220px] rounded-2xl border border-white/10 bg-slate-900/60 flex flex-col items-center justify-center p-6 text-center text-amber-400 gap-2">
                  <span className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-400 rounded-full animate-spin mb-1" />
                  <p className="text-sm font-bold text-white">Generating Notes PDF...</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Board notes and presentation slides are being rendered into a PDF document. It will be available shortly.
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-h-[180px] rounded-2xl border border-white/10 bg-slate-900/40 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-4xl text-slate-600">description</span>
                  <p className="text-sm font-bold text-slate-300">Notes currently unavailable</p>
                  <p className="text-xs text-slate-500">
                    No board notes or presentation slides were recorded for this class session.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab Content 2: Overview (विवरण) */}
          {activeTab === "overview" && (
            <div className="p-3.5 sm:p-4.5 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Educator</span>
                  <span className="text-sm font-bold text-white">{teacherName || "Atomic Faculty"}</span>
                  <span className="text-[11px] text-slate-400">Subject Specialist &amp; Mentor</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Batch</span>
                  <span className="text-sm font-bold text-white">{batchName || "Enrolled Batch"}</span>
                  <span className="text-[11px] text-slate-400">Target Preparation Course</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-blue-400 text-lg shrink-0 mt-0.5">
                  info
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white">Full-Screen Mode Tip</span>
                  <p className="text-[11px] text-blue-300 leading-relaxed">
                    Tap the full-screen button on the video player above to watch in complete distraction-free video mode. Exit full-screen anytime to view the synchronized class notes below.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-App Fullscreen PDF Notes Viewer */}
      {isNotesFullscreen && activeNotesUrl && (
        <div className="fixed inset-0 z-60 bg-slate-950/95 flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-3 bg-slate-900 border border-white/10 rounded-2xl mb-2 text-white">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">description</span>
              <span className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                {classTitle} — Class Notes PDF
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activeNotesUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download</span>
              </a>
              <button
                type="button"
                onClick={() => setIsNotesFullscreen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Exit Fullscreen Notes"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-900">
            <iframe
              src={`${activeNotesUrl}#toolbar=1&navpanes=0`}
              title="Full Screen Class Notes PDF"
              className="w-full h-full border-0 bg-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
