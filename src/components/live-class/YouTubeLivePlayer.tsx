"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export type YouTubeLivePlayerProps = {
  youtubeVideoId: string | null;
  title: string;
  subject?: string | null;
  livePhase: string;
  isTeacher?: boolean;
  onRefresh?: () => void;
  className?: string;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Live-edge tolerance: YouTube's reported duration for an ongoing live
// broadcast keeps growing (it's "how much has been broadcast so far," not
// a fixed length) - a few seconds of encoder/API lag between
// getCurrentTime() and getDuration() is normal even when genuinely caught
// up, so treat anything within this window as "at the live edge."
const LIVE_EDGE_TOLERANCE_SECONDS = 4;

// Minimal ambient types for exactly the YT IFrame API surface this
// component uses - avoids pulling in an @types/youtube dependency for a
// handful of methods.
type YTPlayerInstance = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  playVideo: () => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onPlaybackRateChange?: (e: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Module-level singleton loader: multiple player instances (or a remount)
// must never inject a second <script> tag or race on the same global
// ready callback.
let youtubeApiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT as YTNamespace);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export function YouTubeLivePlayer({
  youtubeVideoId,
  title,
  subject,
  livePhase,
  isTeacher,
  onRefresh,
  className = "",
}: YouTubeLivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount the real YT.Player against the video currently live - torn down
  // and recreated whenever the video id changes (e.g. the teacher re-maps
  // a fresh broadcast onto the same schedule).
  useEffect(() => {
    if (!youtubeVideoId || !mountRef.current) return;
    let cancelled = false;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: youtubeVideoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 1,
          origin: window.location.origin,
        },
        events: {
          onPlaybackRateChange: (e) => setPlaybackSpeed(e.data),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [youtubeVideoId]);

  // Poll current-vs-live-edge position so the LIVE/GO LIVE indicator stays
  // accurate as the student watches, not only right after a manual seek.
  useEffect(() => {
    if (!youtubeVideoId) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const behindLiveEdge = player.getDuration() - player.getCurrentTime();
        setIsLiveEdge(behindLiveEdge <= LIVE_EDGE_TOLERANCE_SECONDS);
      } catch {
        // Player not fully ready yet - ignore until the next tick.
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [youtubeVideoId]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    playerRef.current?.setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  // A real relative seek - reads the player's own current position rather
  // than guessing, unlike the previous version which had no way to know
  // current time over raw postMessage and just jumped to buffer-start or
  // live-edge for both -10s and +10s.
  const handleSeek = (offsetSeconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    const target = Math.max(0, player.getCurrentTime() + offsetSeconds);
    player.seekTo(target, true);
    setIsLiveEdge(false);
  };

  const handleGoLive = () => {
    const player = playerRef.current;
    if (!player) return;
    // A YouTube live broadcast's own reported duration IS the live edge
    // (it grows as the broadcast continues) - seeking to it is the
    // documented way to jump back to live.
    player.seekTo(player.getDuration(), true);
    player.playVideo();
    setPlaybackSpeed(1);
    player.setPlaybackRate(1);
    setIsLiveEdge(true);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(() => {
      if (!showSpeedMenu) setShowControls(false);
    }, 4000);
  }, [showSpeedMenu]);

  if (!youtubeVideoId || livePhase === "SCHEDULED" || livePhase === "PREPARING") {
    return (
      <div className={`w-full aspect-video bg-[#0d0e16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-8 text-center space-y-4 shadow-inner ${className}`}>
        <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl animate-pulse">sensors</span>
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="font-bold text-lg text-white">
            {livePhase === "PREPARING" ? "Class is Preparing..." : "Class Scheduled"}
          </h3>
          <p className="text-xs text-slate-400">
            {isTeacher
              ? "Enter or confirm the YouTube Live URL or Video ID to go LIVE."
              : "The educator is getting ready to broadcast. The stream will begin automatically once live."}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Check Stream Status
          </button>
        )}
      </div>
    );
  }

  if (livePhase === "ENDED") {
    return (
      <div className={`w-full aspect-video bg-[#0d0e16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-8 text-center space-y-3 ${className}`}>
        <div className="w-14 h-14 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">check_circle</span>
        </div>
        <h3 className="font-bold text-lg text-white">Class Completed</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          This live class has concluded. The recording will be processed and available in your batch dashboard.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none ${className}`}
    >
      {/* YouTube IFrame API player mounts here */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top Floating Info Banner (Fades on inactivity) */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-none transition-opacity duration-300 z-10 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Go Live / Live Edge Indicator */}
          <button
            type="button"
            onClick={handleGoLive}
            className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black transition-all shadow-md ${
              isLiveEdge
                ? "bg-rose-600 text-white shadow-rose-600/50 ring-1 ring-rose-400"
                : "bg-slate-800/90 hover:bg-rose-700 text-slate-300 hover:text-white border border-slate-700"
            }`}
            title="Click to sync directly to live edge"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveEdge ? "bg-white animate-pulse" : "bg-slate-500"
              }`}
            />
            <span>{isLiveEdge ? "LIVE" : "GO LIVE"}</span>
          </button>

          {subject && (
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
              {subject}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-white/90 truncate max-w-xs sm:max-w-md drop-shadow">
          {title}
        </p>
      </div>

      {/* Bottom Floating Control Bar (Overlay) */}
      <div
        className={`absolute bottom-2 left-2 right-2 px-3 py-1.5 bg-[#0e111d]/90 backdrop-blur-md rounded-xl border border-slate-700/80 flex items-center justify-between gap-2 shadow-2xl transition-opacity duration-300 z-10 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Go Live Button */}
          <button
            type="button"
            onClick={handleGoLive}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              isLiveEdge
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/40"
                : "bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Sync Live</span>
          </button>

          {/* Seek -10s */}
          <button
            type="button"
            onClick={() => handleSeek(-10)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-semibold flex items-center gap-0.5"
            title="Rewind 10 seconds"
          >
            <span className="material-symbols-outlined text-base">replay_10</span>
            <span className="hidden sm:inline text-[11px]">-10s</span>
          </button>

          {/* Seek +10s */}
          <button
            type="button"
            onClick={() => handleSeek(10)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-semibold flex items-center gap-0.5"
            title="Forward 10 seconds"
          >
            <span className="material-symbols-outlined text-base">forward_10</span>
            <span className="hidden sm:inline text-[11px]">+10s</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 relative">
          {/* Speed Selector Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedMenu((v) => !v)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1 border border-slate-700 transition"
              title="Playback Speed"
            >
              <span className="material-symbols-outlined text-sm">speed</span>
              <span>{playbackSpeed}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-28 bg-[#141726] border border-slate-700 rounded-xl p-1 shadow-2xl z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 border-b border-slate-800">
                  Playback Speed
                </div>
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSpeedChange(rate)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                      playbackSpeed === rate
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{rate}x</span>
                    {playbackSpeed === rate && (
                      <span className="material-symbols-outlined text-xs">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <span className="material-symbols-outlined text-base">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
