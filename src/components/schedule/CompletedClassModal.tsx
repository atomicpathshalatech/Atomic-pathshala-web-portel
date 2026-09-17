"use client";

import React, { useEffect, useState, useRef } from "react";
import { formatISTDate, formatISTTime } from "@/lib/date-utils";

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

const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [notesType, setNotesType] = useState<"annotated" | "original">("annotated");
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Apply playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, isPlaying]);

  const durationMin = assets?.recording.durationSeconds
    ? Math.round(assets.recording.durationSeconds / 60)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wide">
                <span className="material-symbols-outlined text-[13px]">done_all</span>
                Class Completed
              </span>
              {subject && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                  {subject}
                </span>
              )}
              {batchName && (
                <span className="text-[10px] font-semibold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {batchName}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2">
              {classTitle}
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>{formatISTDate(startsAt)}</span>
              <span>•</span>
              <span>
                {formatISTTime(startsAt)} – {formatISTTime(endsAt)}
              </span>
              {teacherName && (
                <>
                  <span>•</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {teacherName}
                  </span>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
              <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span>Checking class recording &amp; notes...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: PLAY CLASS RECORDING */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#a33900] dark:text-orange-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Class Recording
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {durationMin ? `Duration: ~${durationMin} mins` : "Full classroom recording"}
                      </p>
                    </div>
                  </div>

                  {assets?.recording.status === "READY" && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Ready
                    </span>
                  )}
                  {assets?.recording.status === "PROCESSING" && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                      Processing
                    </span>
                  )}
                </div>

                {assets?.recording.status === "READY" && assets.recording.url ? (
                  isPlaying ? (
                    <div className="mt-3 space-y-2">
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-inner">
                        {assets.recording.type === "YOUTUBE" ? (
                          <iframe
                            src={
                              assets.recording.url.includes("embed")
                                ? assets.recording.url
                                : `https://www.youtube.com/embed/${
                                    assets.recording.url.match(/(?:v=|\/embed\/|\.be\/)([^&?]+)/)?.[1] || ""
                                  }?autoplay=1`
                            }
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Class Recording"
                          />
                        ) : (
                          <video
                            ref={videoRef}
                            src={assets.recording.url}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>

                      {assets.recording.type === "VIDEO" && (
                        <div className="flex items-center justify-between gap-2 px-1 pt-1 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">
                              Speed:
                            </span>
                            {SPEEDS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                  speed === s
                                    ? "bg-orange-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                }`}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsPlaying(false)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                          >
                            Hide Player
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsPlaying(true)}
                      className="w-full mt-2 py-2.5 px-4 bg-[#a33900] hover:bg-orange-800 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm hover:shadow transition active:scale-[0.99] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      <span>Play Class</span>
                    </button>
                  )
                ) : assets?.recording.status === "PROCESSING" ? (
                  <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
                    <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <p className="font-bold">Recording is being processed.</p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Please check again shortly. It usually becomes ready a few minutes after class ends.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-slate-400">videocam_off</span>
                    <span>Recording is currently unavailable.</span>
                  </div>
                )}
              </div>

              {/* SECTION 2: DOWNLOAD NOTES */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">description</span>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Class Notes &amp; Slides
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Official board notes &amp; lecture materials
                      </p>
                    </div>
                  </div>

                  {assets?.notes.status === "READY" && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Available
                    </span>
                  )}
                  {assets?.notes.status === "PROCESSING" && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                      Generating
                    </span>
                  )}
                </div>

                {assets?.notes.status === "READY" ? (
                  <div className="mt-2 space-y-2">
                    {assets.notes.hasOriginalSlides && assets.notes.originalDownloadUrl && (
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setNotesType("annotated")}
                          className={`flex-1 py-1 px-2.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            notesType === "annotated"
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          Annotated Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotesType("original")}
                          className={`flex-1 py-1 px-2.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            notesType === "original"
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          Original Slides
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
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm hover:shadow transition active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span>
                        {notesType === "original" && assets.notes.hasOriginalSlides
                          ? "Download Original Slides"
                          : "Download Notes (PDF)"}
                      </span>
                    </a>
                  </div>
                ) : assets?.notes.status === "PROCESSING" ? (
                  <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
                    <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <p className="font-bold">Notes are being finalized.</p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Slide exports are rendering. Please check back in a moment.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-slate-400">file_present</span>
                    <span>Notes are not available yet.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
