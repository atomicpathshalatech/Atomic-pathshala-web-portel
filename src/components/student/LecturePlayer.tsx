"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { lectureIssueReportSchema } from "@/lib/validation/lecture";

type Props = {
  lectureId: string;
  title: string;
  language: string;
  subjectTitle: string;
  teacherName: string;
  videoUrl: string;
  educatorVideoUrl: string | null;
  slidesUrl: string | null;
  prevHref: string | null;
  nextHref: string | null;
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function LecturePlayer({
  lectureId,
  title,
  language,
  subjectTitle,
  teacherName,
  videoUrl,
  educatorVideoUrl,
  slidesUrl,
  prevHref,
  nextHref,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showPlaybackMenu, setShowPlaybackMenu] = useState(false);
  const [educatorVideoOn, setEducatorVideoOn] = useState(Boolean(educatorVideoUrl));
  const [slideMode, setSlideMode] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function seekBy(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + deltaSeconds, 0), video.duration || 0);
  }

  function handleSeekBarChange(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  function handleVolumeChange(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    setVolume(value);
  }

  function handlePlaybackRateChange(rate: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowPlaybackMenu(false);
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }

  async function submitReport() {
    setReportSubmitting(true);
    setReportError(null);
    try {
      const parsed = lectureIssueReportSchema.safeParse({ note: reportNote });
      if (!parsed.success) {
        setReportError(parsed.error.issues[0]?.message ?? "Please describe the issue.");
        return;
      }
      const res = await fetch(`/api/lectures/${lectureId}/report-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setReportError(json.error ?? "Could not send this report. Please try again.");
        return;
      }
      setReportSuccess(true);
      setReportNote("");
    } catch {
      setReportError("Something went wrong. Please check your connection and try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary">
              {subjectTitle}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
              {language}
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface truncate">{title}</h1>
          <p className="text-label-sm text-on-surface-variant mt-0.5">{teacherName}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {prevHref ? (
            <Link
              href={prevHref}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/5 text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Previous lecture"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </Link>
          ) : (
            <span className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant/30">
              <span className="material-symbols-outlined">chevron_left</span>
            </span>
          )}
          {nextHref ? (
            <Link
              href={nextHref}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/5 text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Next lecture"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          ) : (
            <span className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant/30">
              <span className="material-symbols-outlined">chevron_right</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Video area */}
        <div
          ref={containerRef}
          className="relative flex-1 min-w-0 bg-black rounded-2xl overflow-hidden aspect-video group"
        >
          {slideMode && slidesUrl ? (
            <iframe src={slidesUrl} title="Slides" className="w-full h-full bg-white" />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
          )}

          {/* Educator webcam PiP — only rendered when a real recording exists
              for this lecture and the student hasn't turned it off. No fake
              "quality" selector is shown for it: there's only one source. */}
          {!slideMode && educatorVideoUrl && educatorVideoOn && (
            <div className="absolute top-3 right-3 w-28 sm:w-36 aspect-video rounded-lg overflow-hidden shadow-lg ring-2 ring-white/20">
              <video src={educatorVideoUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            </div>
          )}

          {/* Custom controls */}
          {!slideMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 sm:px-4 pt-8 pb-2">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeekBarChange(Number(e.target.value))}
                className="w-full h-1.5 accent-primary cursor-pointer mb-2"
                style={{
                  background: `linear-gradient(to right, var(--color-primary, #6750A4) ${progressPct}%, rgba(255,255,255,0.3) ${progressPct}%)`,
                }}
                aria-label="Seek"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => seekBy(-10)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label="Rewind 10 seconds"
                  >
                    <span className="material-symbols-outlined text-xl">replay_10</span>
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    <span className="material-symbols-outlined text-2xl">{isPlaying ? "pause" : "play_arrow"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekBy(10)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label="Forward 10 seconds"
                  >
                    <span className="material-symbols-outlined text-xl">forward_10</span>
                  </button>
                  <span className="text-white text-label-sm font-label-sm ml-1 hidden sm:inline">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-white text-lg">volume_up</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-16 accent-primary cursor-pointer"
                      aria-label="Volume"
                    />
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSettings((v) => !v)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                      aria-label="Settings"
                    >
                      <span className="material-symbols-outlined text-xl">settings</span>
                    </button>

                    {showSettings && (
                      <div className="absolute bottom-10 right-0 w-64 bg-surface rounded-xl shadow-xl border border-outline-variant/20 py-1.5 text-on-surface z-10">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowPlaybackMenu((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2 text-body-md hover:bg-primary/5 transition-colors"
                          >
                            <span>Playback speed</span>
                            <span className="text-on-surface-variant text-label-sm">{playbackRate}x</span>
                          </button>
                          {showPlaybackMenu && (
                            <div className="px-2 pb-1 grid grid-cols-4 gap-1">
                              {PLAYBACK_RATES.map((rate) => (
                                <button
                                  key={rate}
                                  type="button"
                                  onClick={() => handlePlaybackRateChange(rate)}
                                  className={`text-label-sm rounded-md py-1 transition-colors ${
                                    rate === playbackRate
                                      ? "bg-primary text-on-primary"
                                      : "hover:bg-primary/5 text-on-surface-variant"
                                  }`}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-4 py-2 text-body-md">
                          <span>Educator video quality</span>
                          <span className="text-on-surface-variant text-label-sm">Auto</span>
                        </div>

                        {educatorVideoUrl && (
                          <button
                            type="button"
                            onClick={() => setEducatorVideoOn((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2 text-body-md hover:bg-primary/5 transition-colors"
                          >
                            <span>Educator video</span>
                            <span className="text-on-surface-variant text-label-sm">{educatorVideoOn ? "On" : "Off"}</span>
                          </button>
                        )}

                        {slidesUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setSlideMode((v) => !v);
                              setShowSettings(false);
                            }}
                            className="w-full flex items-center justify-between px-4 py-2 text-body-md hover:bg-primary/5 transition-colors"
                          >
                            <span>Slide mode</span>
                            <span className="text-on-surface-variant text-label-sm">{slideMode ? "On" : "Off"}</span>
                          </button>
                        )}

                        <div className="h-px bg-outline-variant/20 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setShowSettings(false);
                            setShowReportModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-body-md text-error hover:bg-error-container/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">flag</span>
                          Report an issue
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label="Fullscreen"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {slideMode && (
            <button
              type="button"
              onClick={() => setSlideMode(false)}
              className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-label-sm px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">movie</span>
              Back to video
            </button>
          )}
        </div>

        {/* Chat panel — honest about not being available for recorded content;
            this mirrors the disabled state shown for live classes rather than
            hiding the panel entirely, so students know chat isn't broken. */}
        <div className="w-full lg:w-72 shrink-0 glass-card rounded-2xl p-4 flex flex-col">
          <h2 className="font-label-md text-label-md text-on-surface mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-on-surface-variant">chat_bubble</span>
            Chat
          </h2>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8 px-2">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">forum</span>
            <p className="text-label-sm text-on-surface-variant">
              Chat is disabled for recorded lectures. Chats will only be visible in a live class.
            </p>
          </div>
        </div>
      </div>

      {/* Report an issue modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Report an issue</h3>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false);
                  setReportError(null);
                }}
                className="text-on-surface-variant hover:text-on-surface"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {reportSuccess ? (
              <div className="text-center py-4 space-y-2">
                <span className="material-symbols-outlined text-3xl text-primary">check_circle</span>
                <p className="text-body-md text-on-surface">Thanks — we've received your report.</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportSuccess(false);
                  }}
                  className="text-label-md text-primary font-label-md"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-label-sm text-on-surface-variant">
                  Video not playing, audio out of sync, wrong slides — let us know what's wrong.
                </p>
                <textarea
                  rows={4}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all"
                />
                {reportError && <p className="text-label-sm font-label-sm text-error">{reportError}</p>}
                <button
                  type="button"
                  disabled={reportSubmitting || reportNote.trim().length === 0}
                  onClick={submitReport}
                  className="w-full bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {reportSubmitting ? "Sending..." : "Send report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
