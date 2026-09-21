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


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="relative bg-slate-950 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Floating Close Button Top-Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-40 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition border border-white/20 cursor-pointer shadow-lg"
          aria-label="Close dialog"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* 1. CLASS VIDEO PLAYER (Directly rendered, no extra cards or clutter) */}
        <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden">
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

        {/* 2. CLASS NOTES / PDF SECTION (DIRECTLY UNDER CLASS VIDEO) */}
        {!loading && !error && assets?.notes && (
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">description</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    Class Notes &amp; Slides
                  </h4>
                  {assets.notes.status === "READY" && (
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase tracking-wide">
                      PDF
                    </span>
                  )}
                  {assets.notes.status === "PROCESSING" && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30 animate-pulse">
                      Generating
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Official board notes &amp; lecture materials
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              {assets.notes.status === "READY" ? (
                <>
                  {assets.notes.hasOriginalSlides && assets.notes.originalDownloadUrl && (
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setNotesType("annotated")}
                        className={`py-1 px-2.5 rounded-md font-bold text-[10px] transition cursor-pointer ${
                          notesType === "annotated"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Annotated
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotesType("original")}
                        className={`py-1 px-2.5 rounded-md font-bold text-[10px] transition cursor-pointer ${
                          notesType === "original"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Original
                      </button>
                    </div>
                  )}

                  <a
                    href={
                      notesType === "original" && assets.notes.originalDownloadUrl
                        ? assets.notes.originalDownloadUrl
                        : assets.notes.downloadUrl || "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial py-2 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    <span>Download Notes (PDF)</span>
                  </a>
                </>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  {assets.notes.status === "PROCESSING" ? "Rendering PDF..." : "Notes unavailable"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
