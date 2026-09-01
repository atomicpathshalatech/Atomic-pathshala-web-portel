"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface VideoPlayerProps {
  lectureId?: string;
  title: string;
  subtitle?: string;
  subjectTitle?: string;
  chapterTitle?: string;
  educatorName?: string;
  videoUrl: string;
  educatorVideoUrl?: string | null;
  slidesUrl?: string | null;
  dppUrl?: string | null;
  prevHref?: string | null;
  nextHref?: string | null;
  isCompleted?: boolean;
}

export function AtomicVideoPlayer({
  lectureId = "demo-lec-1",
  title = "Thermodynamics & Heat Transfer: Lecture 01",
  subtitle = "First Law of Thermodynamics, Work Done in Isothermal & Adiabatic Processes",
  subjectTitle = "Physics",
  chapterTitle = "Thermodynamics",
  educatorName = "Sonu Bhaiya",
  videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ",
  educatorVideoUrl,
  slidesUrl,
  dppUrl,
  prevHref,
  nextHref,
  isCompleted = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState("1080p");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "dpp" | "doubts">("overview");
  const [completed, setCompleted] = useState(isCompleted);

  // Notes & Bookmarks
  const [noteText, setNoteText] = useState("");
  const [bookmarks, setBookmarks] = useState<{ id: string; time: number; note: string }[]>([
    { id: "bm-1", time: 120, note: "Key concept: Work done in adiabatic expansion" },
    { id: "bm-2", time: 540, note: "Important formula for molar heat capacity" },
  ]);

  // Doubt input
  const [doubtText, setDoubtText] = useState("");
  const [doubtsList, setDoubtsList] = useState<{ id: string; time: string; text: string; author: string }[]>([
    { id: "d-1", time: "10 mins ago", text: "Is work done zero in free expansion in vacuum?", author: "Rahul Verma" },
    { id: "d-2", time: "25 mins ago", text: "Can we use PV^gamma = C for non-ideal gases?", author: "Anjali Gupta" },
  ]);

  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

  // Extract YouTube embed URL
  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("embed/")) return url;
    if (url.includes("watch?v=")) {
      const vid = url.split("watch?v=")[1]?.split("&")[0];
      return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0`;
    }
    if (url.includes("youtu.be/")) {
      const vid = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0`;
    }
    return url;
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.volume = volume || 0.5;
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handlePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleAddBookmark = () => {
    const newBm = {
      id: `bm-${Date.now()}`,
      time: Math.floor(currentTime),
      note: noteText.trim() || `Bookmark at ${formatTime(currentTime)}`,
    };
    setBookmarks((prev) => [...prev, newBm]);
    setNoteText("");
    toast.success(`Bookmark saved at ${formatTime(currentTime)}!`);
  };

  const handlePostDoubt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtText.trim()) return;
    setDoubtsList((prev) => [
      {
        id: `d-${Date.now()}`,
        time: "Just now",
        text: doubtText.trim(),
        author: "You (Student)",
      },
      ...prev,
    ]);
    setDoubtText("");
    toast.success("Doubt submitted! Faculty will answer shortly.");
  };

  const handleMarkComplete = () => {
    setCompleted(true);
    toast.success("Lecture marked as completed! DPP unlocked.");
    fetch(`/api/lectures/${lectureId}/complete`, { method: "POST" }).catch(() => {});
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["input", "textarea"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSkip(10);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, isPlaying, isMuted, volume]);

  return (
    <div className="min-h-screen bg-[#031635] text-white flex flex-col font-sans">
      {/* 1. Header Toolbar */}
      <header className="bg-[#031635]/90 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/courses"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
            title="Back to Course"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                {subjectTitle}
              </span>
              <span className="text-xs text-slate-400 font-medium">{chapterTitle}</span>
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-white line-clamp-1 mt-0.5">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {completed ? (
            <span className="px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-600 text-emerald-300 text-xs font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Completed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleMarkComplete}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              <span>Mark as Complete</span>
            </button>
          )}

          {prevHref && (
            <Link
              href={prevHref}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Previous Lecture"
            >
              <span className="material-symbols-outlined text-lg">skip_previous</span>
            </Link>
          )}
          {nextHref && (
            <Link
              href={nextHref}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Next Lecture"
            >
              <span className="material-symbols-outlined text-lg">skip_next</span>
            </Link>
          )}
        </div>
      </header>

      {/* 2. Main Player & Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left: Video Cinema Screen (8 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col bg-black relative">
          <div
            ref={containerRef}
            className="w-full flex-1 aspect-video lg:aspect-auto min-h-[360px] sm:min-h-[480px] bg-black relative flex items-center justify-center group overflow-hidden"
          >
            {isYouTube ? (
              <iframe
                src={getEmbedUrl(videoUrl)}
                title={title}
                className="w-full h-full border-0 absolute inset-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCompleted(true);
                  }}
                />

                {/* Video Play Overlay Button */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute w-20 h-20 rounded-full bg-[#6b46c1]/90 hover:bg-[#6b46c1] text-white shadow-2xl flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110 z-20"
                  >
                    <span className="material-symbols-outlined text-4xl">play_arrow</span>
                  </button>
                )}

                {/* Custom Overlay Controls (Visible on hover) */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  {/* Seeker Progress Bar */}
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-slate-700 accent-purple-500 rounded-lg cursor-pointer transition"
                    />
                  </div>

                  {/* Controls Bottom Row */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-4">
                      {/* Play / Pause */}
                      <button type="button" onClick={togglePlay} className="hover:text-purple-400 transition">
                        <span className="material-symbols-outlined text-2xl">
                          {isPlaying ? "pause" : "play_arrow"}
                        </span>
                      </button>

                      {/* 10s Rewind & Forward */}
                      <button
                        type="button"
                        onClick={() => handleSkip(-10)}
                        className="hover:text-purple-400 transition flex items-center"
                        title="Rewind 10s"
                      >
                        <span className="material-symbols-outlined text-xl">replay_10</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSkip(10)}
                        className="hover:text-purple-400 transition flex items-center"
                        title="Forward 10s"
                      >
                        <span className="material-symbols-outlined text-xl">forward_10</span>
                      </button>

                      {/* Volume Slider */}
                      <div className="flex items-center gap-1.5 group/vol">
                        <button type="button" onClick={toggleMute} className="hover:text-purple-400 transition">
                          <span className="material-symbols-outlined text-xl">
                            {isMuted || volume === 0
                              ? "volume_off"
                              : volume < 0.5
                              ? "volume_down"
                              : "volume_up"}
                          </span>
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 bg-slate-600 accent-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Time Indicator */}
                      <span className="font-mono text-[11px] text-slate-300">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Speed Selector */}
                      <div className="relative group/speed">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-mono font-bold text-xs"
                        >
                          {playbackRate}x
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/speed:flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-xl z-30">
                          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handlePlaybackRate(r)}
                              className={`px-3 py-1 rounded-lg text-xs font-mono text-left transition ${
                                playbackRate === r ? "bg-purple-600 text-white font-bold" : "hover:bg-slate-800"
                              }`}
                            >
                              {r}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quality Selector */}
                      <div className="relative group/qual">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-xs"
                        >
                          {quality}
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/qual:flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-xl z-30">
                          {["1080p", "720p", "480p", "360p", "Auto"].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setQuality(q)}
                              className={`px-3 py-1 rounded-lg text-xs text-left transition ${
                                quality === q ? "bg-purple-600 text-white font-bold" : "hover:bg-slate-800"
                              }`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="hover:text-purple-400 transition"
                        title="Toggle Fullscreen"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Interactive Student Learning Sidebar (4 cols on desktop) */}
        <aside className="lg:col-span-4 bg-[#0a192f] border-l border-slate-800 flex flex-col h-full overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex items-center border-b border-slate-800 p-2 gap-1 bg-[#071326] shrink-0 text-xs font-bold">
            {[
              { id: "overview", label: "Overview", icon: "info" },
              { id: "notes", label: "Notes & Bookmarks", icon: "bookmark" },
              { id: "dpp", label: "DPP & Material", icon: "description" },
              { id: "doubts", label: "Live Doubts", icon: "help_center" },
            ].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex-1 py-2 px-1.5 rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 ${
                    isActive
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  <span className="text-[11px] truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* 1. OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white">{title}</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{subtitle}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-purple-900/80 border border-purple-500/50 flex items-center justify-center font-bold text-sm text-purple-200">
                      {educatorName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{educatorName}</h4>
                      <p className="text-[11px] text-slate-400">Senior Faculty • NEET / JEE</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs transition"
                  >
                    Profile
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Topics Covered in This Lecture
                  </h4>
                  <ul className="text-xs space-y-2 text-slate-300">
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                      <span className="material-symbols-outlined text-purple-400 text-sm mt-0.5">check_circle</span>
                      <span>System, Surroundings & State Variables</span>
                    </li>
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                      <span className="material-symbols-outlined text-purple-400 text-sm mt-0.5">check_circle</span>
                      <span>First Law of Thermodynamics (Q = ΔU + W)</span>
                    </li>
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                      <span className="material-symbols-outlined text-purple-400 text-sm mt-0.5">check_circle</span>
                      <span>Work done in Isothermal Reversible vs Irreversible</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* 2. NOTES & BOOKMARKS TAB */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Add Timestamp Bookmark & Note</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type important takeaway..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddBookmark}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-1 shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">bookmark_add</span>
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saved Bookmarks</h4>
                  {bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = bm.time;
                              setCurrentTime(bm.time);
                            }
                          }}
                          className="font-mono text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">play_circle</span>
                          <span>{formatTime(bm.time)}</span>
                        </button>
                        <p className="text-xs text-slate-300">{bm.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. DPP & MATERIAL TAB */}
            {activeTab === "dpp" && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-400">assignment</span>
                      <span className="font-bold text-xs text-white">Daily Practice Problem (DPP 01)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
                      15 Questions
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Practice questions matching today&apos;s lecture concepts with instant step-by-step solutions.
                  </p>
                  <Link
                    href={`/team/dpp/${lectureId}/author`}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center block transition shadow"
                  >
                    Start DPP #01
                  </Link>
                </div>

                {slidesUrl && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400">description</span>
                      <div>
                        <h5 className="font-bold text-xs text-white">Class Handwritten Notes PDF</h5>
                        <p className="text-[10px] text-slate-400">Annotated by Sonu Bhaiya</p>
                      </div>
                    </div>
                    <a
                      href={slidesUrl}
                      download
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 4. LIVE DOUBTS TAB */}
            {activeTab === "doubts" && (
              <div className="space-y-4">
                <form onSubmit={handlePostDoubt} className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Ask doubt from this video timestamp..."
                    value={doubtText}
                    onChange={(e) => setDoubtText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs transition shadow flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>Submit Doubt</span>
                  </button>
                </form>

                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Doubts</h4>
                  {doubtsList.map((d) => (
                    <div key={d.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-purple-300">{d.author}</span>
                        <span className="text-slate-500">{d.time}</span>
                      </div>
                      <p className="text-xs text-slate-200">{d.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
