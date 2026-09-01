"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { lectureIssueReportSchema } from "@/lib/validation/lecture";
import { FollowTeacherButton } from "@/components/student/FollowTeacherButton";

type Props = {
  lectureId: string;
  title: string;
  language: string;
  subjectTitle: string;
  teacherId: string;
  teacherName: string;
  videoUrl: string;
  educatorVideoUrl: string | null;
  slidesUrl: string | null;
  prevHref: string | null;
  nextHref: string | null;
  isCompleted: boolean;
};

export type Bookmark = {
  id: string;
  timestamp: number;
  note: string;
  createdAt: string;
};

type NotePayload = {
  text: string;
  bookmarks: Bookmark[];
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const NOTE_AUTOSAVE_DELAY_MS = 1000;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function parseNoteData(rawBody: string): NotePayload {
  if (!rawBody || rawBody.trim().length === 0) {
    return { text: "", bookmarks: [] };
  }
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && ("text" in parsed || "bookmarks" in parsed)) {
      return {
        text: typeof parsed.text === "string" ? parsed.text : "",
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      };
    }
  } catch {
    // If not JSON, it's a legacy plain-text note
  }
  return { text: rawBody, bookmarks: [] };
}

export function LecturePlayer({
  lectureId,
  title,
  language,
  subjectTitle,
  teacherId,
  teacherName,
  videoUrl,
  educatorVideoUrl,
  slidesUrl,
  prevHref,
  nextHref,
  isCompleted,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const [markingComplete, setMarkingComplete] = useState(false);

  const markComplete = useCallback(() => {
    if (completed || markingComplete) return;
    setMarkingComplete(true);
    setCompleted(true);
    fetch(`/api/lectures/${lectureId}/complete`, { method: "POST" })
      .catch(() => setCompleted(false))
      .finally(() => setMarkingComplete(false));
  }, [lectureId, completed, markingComplete]);

  const [showSettings, setShowSettings] = useState(false);
  const [showPlaybackMenu, setShowPlaybackMenu] = useState(false);
  const [educatorVideoOn, setEducatorVideoOn] = useState(Boolean(educatorVideoUrl));
  const [slideMode, setSlideMode] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Side panel tabs: "notes" | "bookmarks" | "doubt"
  const [sidePanelTab, setSidePanelTab] = useState<"notes" | "bookmarks" | "doubt">("notes");
  const [noteBody, setNoteBody] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New bookmark input
  const [newBookmarkText, setNewBookmarkText] = useState("");

  // In-lecture Doubt state
  const [doubtText, setDoubtText] = useState("");
  const [doubtSubmitting, setDoubtSubmitting] = useState(false);
  const [doubtSuccess, setDoubtSuccess] = useState(false);
  const [doubtError, setDoubtError] = useState<string | null>(null);

  // Restore saved playback speed
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem("atomic_playback_rate");
      if (savedRate) {
        const rateNum = Number(savedRate);
        if (PLAYBACK_RATES.includes(rateNum as any)) {
          setPlaybackRate(rateNum);
          if (videoRef.current) videoRef.current.playbackRate = rateNum;
        }
      }
    } catch {}
  }, []);

  // Restore video playback progress
  useEffect(() => {
    if (!duration || duration <= 0) return;
    try {
      const savedProgress = localStorage.getItem(`atomic_progress_${lectureId}`);
      if (savedProgress && videoRef.current && videoRef.current.currentTime === 0) {
        const time = Number(savedProgress);
        if (time > 5 && time < duration - 10) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
      }
    } catch {}
  }, [duration, lectureId]);

  // Save progress occasionally
  useEffect(() => {
    if (currentTime > 0) {
      try {
        localStorage.setItem(`atomic_progress_${lectureId}`, String(Math.floor(currentTime)));
      } catch {}
    }
  }, [currentTime, lectureId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Load Notes & Bookmarks from server
  useEffect(() => {
    let cancelled = false;
    setNoteLoaded(false);
    fetch(`/api/lectures/${lectureId}/notes`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        const parsed = parseNoteData(json.data.body ?? "");
        setNoteBody(parsed.text);
        setBookmarks(parsed.bookmarks);
        setNoteSavedAt(json.data.updatedAt ? new Date(json.data.updatedAt) : null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setNoteLoaded(true);
      });
    return () => {
      cancelled = true;
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    };
  }, [lectureId]);

  const saveNoteAndBookmarks = useCallback(
    async (text: string, currentBookmarks: Bookmark[]) => {
      setNoteSaving(true);
      try {
        const payload: NotePayload = { text, bookmarks: currentBookmarks };
        const res = await fetch(`/api/lectures/${lectureId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: JSON.stringify(payload) }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setNoteSavedAt(json.data.updatedAt ? new Date(json.data.updatedAt) : new Date());
        }
      } catch {
        // Silent recovery on next autosave
      } finally {
        setNoteSaving(false);
      }
    },
    [lectureId]
  );

  function handleNoteChange(value: string) {
    setNoteBody(value);
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    noteSaveTimeout.current = setTimeout(() => saveNoteAndBookmarks(value, bookmarks), NOTE_AUTOSAVE_DELAY_MS);
  }

  function addBookmark(customTimestamp?: number, customText?: string) {
    const time = customTimestamp ?? (videoRef.current ? Math.floor(videoRef.current.currentTime) : Math.floor(currentTime));
    const text = (customText ?? newBookmarkText).trim() || `Bookmark at ${formatTime(time)}`;
    const newBookmark: Bookmark = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: time,
      note: text,
      createdAt: new Date().toISOString(),
    };
    const updated = [...bookmarks, newBookmark].sort((a, b) => a.timestamp - b.timestamp);
    setBookmarks(updated);
    setNewBookmarkText("");
    saveNoteAndBookmarks(noteBody, updated);
  }

  function removeBookmark(id: string) {
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    saveNoteAndBookmarks(noteBody, updated);
  }

  function seekToTimestamp(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(seconds, 0), video.duration || duration);
    setCurrentTime(seconds);
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    }
  }

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
    setIsMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }

  function handlePlaybackRateChange(rate: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowPlaybackMenu(false);
    try {
      localStorage.setItem("atomic_playback_rate", String(rate));
    } catch {}
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }

  // Keyboard controls listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          seekBy(10);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "b":
          e.preventDefault();
          addBookmark();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted, currentTime]);

  async function submitDoubt() {
    if (!doubtText.trim()) return;
    setDoubtSubmitting(true);
    setDoubtError(null);
    try {
      const timeTag = `[At ${formatTime(currentTime)} in lecture "${title}"]`;
      const fullBody = `${doubtText.trim()}\n\n${timeTag}`;
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectTitle,
          body: fullBody,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDoubtError(data.error || "Could not submit doubt. Please try again.");
        return;
      }
      setDoubtSuccess(true);
      setDoubtText("");
      setTimeout(() => setDoubtSuccess(false), 4000);
    } catch {
      setDoubtError("Network error while submitting doubt. Please try again.");
    } finally {
      setDoubtSubmitting(false);
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
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary">
              {subjectTitle}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
              {language}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              Press <b>B</b> to bookmark
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface truncate">{title}</h1>
          <p className="text-label-sm text-on-surface-variant mt-0.5 flex items-center gap-2 flex-wrap">
            {teacherName}
            <FollowTeacherButton teacherId={teacherId} />
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={markComplete}
            disabled={completed || markingComplete}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-label-sm font-label-sm transition-colors ${
              completed
                ? "bg-green-500/10 text-green-600 cursor-default"
                : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {completed ? "check_circle" : "radio_button_unchecked"}
            </span>
            {completed ? "Completed" : "Mark as complete"}
          </button>
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
          className="relative flex-1 min-w-0 bg-black rounded-2xl overflow-hidden aspect-video group shadow-lg"
        >
          {slideMode && slidesUrl ? (
            <iframe src={slidesUrl} title="Slides" className="w-full h-full bg-white" />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full cursor-pointer"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                e.currentTarget.playbackRate = playbackRate;
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={markComplete}
            />
          )}

          {/* Educator webcam PiP */}
          {!slideMode && educatorVideoUrl && educatorVideoOn && (
            <div className="absolute top-3 right-3 w-28 sm:w-36 aspect-video rounded-lg overflow-hidden shadow-lg ring-2 ring-white/20">
              <video src={educatorVideoUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            </div>
          )}

          {/* Custom controls overlay */}
          {!slideMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 sm:px-4 pt-10 pb-2 transition-opacity">
              {/* Seek bar with bookmark markers */}
              <div className="relative mb-2 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => handleSeekBarChange(Number(e.target.value))}
                  className="w-full h-1.5 accent-primary cursor-pointer relative z-10"
                  style={{
                    background: `linear-gradient(to right, var(--color-primary, #6750A4) ${progressPct}%, rgba(255,255,255,0.3) ${progressPct}%)`,
                  }}
                  aria-label="Seek"
                />
                {/* Visual Bookmark Dots on Timeline */}
                {duration > 0 &&
                  bookmarks.map((bm) => {
                    const leftPct = (bm.timestamp / duration) * 100;
                    return (
                      <div
                        key={bm.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekToTimestamp(bm.timestamp);
                        }}
                        title={`${formatTime(bm.timestamp)}: ${bm.note}`}
                        style={{ left: `${leftPct}%` }}
                        className="absolute w-2 h-2 rounded-full bg-amber-400 -translate-x-1/2 z-20 cursor-pointer hover:scale-150 transition-transform shadow"
                      />
                    );
                  })}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => seekBy(-10)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label="Rewind 10 seconds"
                    title="Rewind 10s (J)"
                  >
                    <span className="material-symbols-outlined text-xl">replay_10</span>
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title="Play/Pause (Space)"
                  >
                    <span className="material-symbols-outlined text-2xl">{isPlaying ? "pause" : "play_arrow"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekBy(10)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                    aria-label="Forward 10 seconds"
                    title="Forward 10s (L)"
                  >
                    <span className="material-symbols-outlined text-xl">forward_10</span>
                  </button>
                  <span className="text-white text-label-sm font-label-sm ml-1 hidden sm:inline">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Bookmark Button */}
                  <button
                    type="button"
                    onClick={() => {
                      addBookmark();
                      setSidePanelTab("bookmarks");
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                    title="Add Bookmark at current timestamp (B)"
                  >
                    <span className="material-symbols-outlined text-sm text-amber-400">bookmark_add</span>
                    <span className="hidden sm:inline">Bookmark</span>
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <button type="button" onClick={toggleMute} className="text-white hover:opacity-80">
                      <span className="material-symbols-outlined text-lg">{isMuted ? "volume_off" : "volume_up"}</span>
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
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
                      <div className="absolute bottom-10 right-0 w-64 bg-surface rounded-xl shadow-xl border border-outline-variant/20 py-1.5 text-on-surface z-30">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowPlaybackMenu((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2 text-body-md hover:bg-primary/5 transition-colors"
                          >
                            <span>Playback speed</span>
                            <span className="text-on-surface-variant text-label-sm font-semibold">{playbackRate}x</span>
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
                                      ? "bg-primary text-on-primary font-bold"
                                      : "hover:bg-primary/5 text-on-surface-variant"
                                  }`}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          )}
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
                    title="Fullscreen (F)"
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

        {/* Side panel — 3 Tabs: Notes, Bookmarks & Ask Doubt */}
        <div className="w-full lg:w-80 shrink-0 glass-card rounded-2xl p-4 flex flex-col min-h-[420px]">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 mb-3 bg-surface-container-lowest rounded-full p-1 shrink-0 border border-outline-variant/20">
            <button
              type="button"
              onClick={() => setSidePanelTab("notes")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 ${
                sidePanelTab === "notes"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Notes
            </button>
            <button
              type="button"
              onClick={() => setSidePanelTab("bookmarks")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 ${
                sidePanelTab === "bookmarks"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bookmarks</span>
              Key Moments ({bookmarks.length})
            </button>
            <button
              type="button"
              onClick={() => setSidePanelTab("doubt")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 ${
                sidePanelTab === "doubt"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">help</span>
              Ask Doubt
            </button>
          </div>

          {/* TAB 1: General Notes */}
          {sidePanelTab === "notes" && (
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={noteBody}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={noteLoaded ? "Jot down notes while you watch (autosaves)..." : "Loading your notes..."}
                disabled={!noteLoaded}
                className="flex-1 min-h-[260px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:opacity-60 font-sans"
              />
              <div className="flex items-center justify-between text-xs text-on-surface-variant mt-2 px-1">
                <span>Personal study notes</span>
                <span>
                  {noteSaving
                    ? "Saving..."
                    : noteSavedAt
                      ? `Saved at ${noteSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : noteLoaded
                        ? "Synced"
                        : ""}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Bookmarks & Key Moments */}
          {sidePanelTab === "bookmarks" && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Quick Add Bar */}
              <div className="space-y-1.5 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/30">
                <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                  <span>Mark Current Moment</span>
                  <span className="text-primary font-bold">{formatTime(currentTime)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBookmarkText}
                    onChange={(e) => setNewBookmarkText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBookmark();
                      }
                    }}
                    placeholder="e.g. Formula Derivation..."
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-outline-variant/50 bg-surface text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => addBookmark()}
                    className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:opacity-90 transition-all shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Bookmark List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant space-y-1">
                    <span className="material-symbols-outlined text-3xl text-amber-400/50">bookmark_border</span>
                    <p className="text-xs">No bookmarks saved yet.</p>
                    <p className="text-[11px] opacity-75">Click "Bookmark" during video playback to save key moments.</p>
                  </div>
                ) : (
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="group flex items-start justify-between gap-2 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => seekToTimestamp(bm.timestamp)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[11px]">
                            {formatTime(bm.timestamp)}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">Click to jump</span>
                        </div>
                        <p className="text-xs text-on-surface font-medium line-clamp-2">{bm.note}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(bm.id)}
                        className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete bookmark"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: In-Lecture Doubt */}
          {sidePanelTab === "doubt" && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-xs text-on-surface-variant">
                <p className="font-semibold text-primary mb-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">info</span>
                  Timestamped Doubt
                </p>
                Your question will automatically attach the current timestamp (<b>{formatTime(currentTime)}</b>) so faculty can assist faster.
              </div>

              {doubtSuccess && (
                <div className="bg-tertiary-container/30 border border-tertiary/20 rounded-xl p-2.5 text-xs text-tertiary font-semibold">
                  Doubt submitted successfully! You can track it in Doubt Portal.
                </div>
              )}
              {doubtError && (
                <div className="bg-error-container/40 border border-error/20 rounded-xl p-2.5 text-xs text-error">
                  {doubtError}
                </div>
              )}

              <textarea
                value={doubtText}
                onChange={(e) => setDoubtText(e.target.value)}
                placeholder="What concept or step is confusing at this timestamp?..."
                className="flex-1 min-h-[140px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />

              <button
                type="button"
                disabled={doubtSubmitting || !doubtText.trim()}
                onClick={submitDoubt}
                className="w-full bg-primary text-on-primary text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                {doubtSubmitting ? "Submitting..." : `Ask Doubt at ${formatTime(currentTime)}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report issue modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-outline-variant/20">
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
