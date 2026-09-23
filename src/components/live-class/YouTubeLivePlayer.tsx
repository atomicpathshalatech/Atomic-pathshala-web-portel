"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

export type YouTubeLivePlayerProps = {
  youtubeVideoId: string | null;
  title: string;
  subject?: string | null;
  educatorName?: string | null;
  scheduledStart?: string | Date | null;
  livePhase: string;
  isTeacher?: boolean;
  onRefresh?: () => void;
  className?: string;
  children?: React.ReactNode;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function YouTubeLivePlayer({
  youtubeVideoId,
  title,
  subject,
  educatorName,
  scheduledStart,
  livePhase,
  isTeacher,
  onRefresh,
  className = "",
  children,
}: YouTubeLivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // The real YT.Player wrapper (see the IFrame API bootstrap effect below) —
  // used for every control action instead of the old raw postMessage guesses.
  const playerRef = useRef<any>(null);

  const [isStreamLive, setIsStreamLive] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime clock ticker for Countdown / Late Buzzer
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const scheduledStartMs = useMemo(() => {
    if (!scheduledStart) return null;
    const ms = new Date(scheduledStart).getTime();
    return isNaN(ms) ? null : ms;
  }, [scheduledStart]);

  const lateSeconds = useMemo(() => {
    if (!scheduledStartMs) return 0;
    const diff = Math.floor((nowMs - scheduledStartMs) / 1000);
    return diff > 0 ? diff : 0;
  }, [scheduledStartMs, nowMs]);

  const countdownSeconds = useMemo(() => {
    if (!scheduledStartMs) return 0;
    const diff = Math.floor((scheduledStartMs - nowMs) / 1000);
    return diff > 0 ? diff : 0;
  }, [scheduledStartMs, nowMs]);

  // Dispatch a control action through the real YT.Player instance (set up
  // below) instead of guessing at YouTube's raw postMessage wire format —
  // that hand-rolled version never reliably told us the stream had actually
  // gone live, so the "Educator Connecting..." waiting screen never cleared
  // even once the broadcast was live on YouTube's own side.
  const sendYouTubeCommand = useCallback((func: string, args: unknown[] = []) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      switch (func) {
        case "playVideo":
          player.playVideo?.();
          break;
        case "pauseVideo":
          player.pauseVideo?.();
          break;
        case "seekTo":
          player.seekTo?.(args[0], args[1]);
          break;
        case "setPlaybackRate":
          player.setPlaybackRate?.(args[0]);
          break;
        case "mute":
          player.mute?.();
          break;
        case "unMute":
          player.unMute?.();
          break;
        case "setVolume":
          player.setVolume?.(args[0]);
          break;
        default:
          break;
      }
    } catch (err) {
      console.debug("[YouTubeLivePlayer] Command dispatch error", err);
    }
  }, []);

  // Bootstrap the official YouTube IFrame Player API and attach it to our
  // existing <iframe> (enablejsapi=1 in embedUrl lets the API adopt it in
  // place). This is what onStateChange === PLAYING actually means the
  // broadcast is live — the previous raw-postMessage listener could not be
  // trusted to fire at all.
  useEffect(() => {
    if (!youtubeVideoId || !iframeRef.current) return;
    let cancelled = false;
    let player: any = null;

    const attachPlayer = () => {
      if (cancelled || !iframeRef.current || !(window as any).YT?.Player) return;
      player = new (window as any).YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            playerRef.current = player;
            player.playVideo?.();
          },
          onStateChange: (e: any) => {
            const YT = (window as any).YT;
            if (e.data === YT.PlayerState.PLAYING) {
              setIsStreamLive(true);
            }
          },
          onPlaybackRateChange: (e: any) => {
            if (typeof e.data === "number") setPlaybackSpeed(e.data);
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      attachPlayer();
    } else {
      const existingCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        existingCallback?.();
        attachPlayer();
      };
      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        // no-op
      }
    };
  }, [youtubeVideoId]);

  // Periodically nudge playback until the live stream is confirmed playing —
  // a fresh broadcast's embed can load "cued" rather than auto-playing.
  useEffect(() => {
    if (!youtubeVideoId || isStreamLive) return;
    const interval = setInterval(() => {
      sendYouTubeCommand("playVideo");
    }, 2000);
    return () => clearInterval(interval);
  }, [youtubeVideoId, isStreamLive, sendYouTubeCommand]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    sendYouTubeCommand("setPlaybackRate", [speed]);
    setShowSpeedMenu(false);
    resetControlsTimer();
  };

  const handleSeek = (offsetSeconds: number) => {
    setIsLiveEdge(false);
    sendYouTubeCommand("seekTo", [offsetSeconds > 0 ? 999999 : 0, true]);
    resetControlsTimer();
  };

  const handleGoLive = () => {
    sendYouTubeCommand("seekTo", [999999, true]);
    sendYouTubeCommand("playVideo", []);
    setPlaybackSpeed(1);
    sendYouTubeCommand("setPlaybackRate", [1]);
    setIsLiveEdge(true);
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (isMuted) {
      sendYouTubeCommand("unMute");
      sendYouTubeCommand("setVolume", [100]);
      setIsMuted(false);
    } else {
      sendYouTubeCommand("mute");
      setIsMuted(true);
    }
    resetControlsTimer();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        if (typeof screen !== "undefined" && screen.orientation && "lock" in screen.orientation) {
          await (screen.orientation as any).lock("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        if (typeof screen !== "undefined" && screen.orientation && "unlock" in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
    resetControlsTimer();
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

  // Headless YouTube embed url (controls=0 completely removes YouTube player UI and logos)
  const embedUrl = useMemo(() => {
    if (!youtubeVideoId) return "";
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    return `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1&controls=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&showinfo=0${originParam}`;
  }, [youtubeVideoId]);

  if (!youtubeVideoId || livePhase === "SCHEDULED" || livePhase === "PREPARING") {
    return (
      <div className={`w-full aspect-video bg-[#0a0c16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-inner relative overflow-hidden ${className}`}>
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/20 flex items-center justify-center shadow-lg">
          <img
            src="/brand/logo.png"
            alt="Atomic Pathshala"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="max-w-md space-y-1.5 z-10">
          <h3 className="font-bold text-base sm:text-lg text-white">
            {livePhase === "PREPARING" ? "Live Classroom is Preparing..." : "Class Scheduled"}
          </h3>
          <p className="text-xs text-slate-400">
            {isTeacher
              ? "Confirm the YouTube Live stream in Teacher Studio to go LIVE."
              : "The educator is getting ready to broadcast. The stream will begin automatically once live."}
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="z-10 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Check Stream Status</span>
          </button>
        )}
      </div>
    );
  }

  if (livePhase === "ENDED") {
    return (
      <div className={`w-full aspect-video bg-[#0a0c16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-8 text-center space-y-3 ${className}`}>
        <div className="w-14 h-14 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center border border-slate-700">
          <span className="material-symbols-outlined text-2xl">check_circle</span>
        </div>
        <h3 className="font-bold text-base sm:text-lg text-white">Class Completed</h3>
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
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none flex items-center justify-center ${
        isFullscreen ? "!fixed !inset-0 !z-50 !w-screen !h-screen !rounded-none !aspect-auto" : ""
      } ${className}`}
    >
      {/* ----------------- 1. HEADLESS YOUTUBE IFRAME (Background) ----------------- */}
      <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="w-[102%] h-[124%] max-w-none border-0 pointer-events-none scale-[1.12] transition-transform duration-300"
        />

        {/* Interaction transparent shield: intercepts user clicks so they NEVER open or redirect to YouTube */}
        <div
          onClick={() => {
            setShowControls((prev) => !prev);
            resetControlsTimer();
          }}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        />
      </div>

      {/* ----------------- 2. ATOMIC PATHSHALA BRANDED WAITING STAGE ----------------- */}
      {/* Covers YouTube's raw waiting card until the live stream actually starts broadcasting */}
      {!isStreamLive && (
        <div className="absolute inset-0 z-20 bg-gradient-to-br from-[#080a14] via-[#0d1224] to-[#060810] flex flex-col items-center justify-between p-4 sm:p-7 select-none overflow-hidden animate-in fade-in duration-300">
          {/* Ambient decorative glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />

          {/* Top Bar inside Waiting Screen */}
          <div className="relative z-10 w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shadow">
                <img
                  src="/brand/logo.png"
                  alt="Atomic Pathshala"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide block leading-tight">
                  Atomic Pathshala
                </span>
                <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Live Classroom
                </span>
              </div>
            </div>

            {subject && (
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/30">
                {subject}
              </span>
            )}
          </div>

          {/* Center Stage Info & Animation */}
          <div className="relative z-10 my-auto text-center max-w-lg mx-auto px-4 flex flex-col items-center gap-3">
            {/* Animated Logo with Radar Waves */}
            <div className="relative flex items-center justify-center my-2">
              <div className="absolute w-24 h-24 rounded-full bg-blue-500/10 animate-ping pointer-events-none" />
              <div className="absolute w-20 h-20 rounded-full border-2 border-blue-500/30 animate-pulse pointer-events-none" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/20 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <img
                  src="/brand/logo.png"
                  alt="Atomic Pathshala"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Title & Educator */}
            <div>
              <h3 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-md line-clamp-2">
                {title}
              </h3>
              {educatorName && (
                <p className="mt-1 text-xs sm:text-sm text-slate-300 font-medium flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-400">school</span>
                  <span>{educatorName}</span>
                </p>
              )}
            </div>

            {/* Equalizer Wave / Audio Ingest Animation */}
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1 h-3.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-6 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
              <span className="w-1 h-4 bg-blue-400 rounded-full animate-bounce [animation-delay:450ms]" />
              <span className="w-1 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:600ms]" />
            </div>

            {/* Dynamic Late / Countdown Status */}
            {lateSeconds > 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] sm:text-xs font-mono font-bold shadow-lg animate-pulse">
                <span className="material-symbols-outlined text-sm text-rose-400">sensors</span>
                <span>
                  Educator connecting... ({Math.floor(lateSeconds / 60) > 0 ? `${Math.floor(lateSeconds / 60)}m ` : ""}{lateSeconds % 60}s)
                </span>
              </div>
            ) : countdownSeconds > 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] sm:text-xs font-mono font-bold shadow-sm">
                <span className="material-symbols-outlined text-sm text-blue-400">timer</span>
                <span>
                  Starts in {Math.floor(countdownSeconds / 60)}m {countdownSeconds % 60}s
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-[11px] sm:text-xs font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>Connecting to live broadcast stream...</span>
              </div>
            )}
          </div>

          {/* Bottom Notice */}
          <div className="relative z-10 text-[10px] sm:text-[11px] text-slate-400 text-center">
            Class will broadcast automatically the second the teacher goes live.
          </div>
        </div>
      )}

      {/* ----------------- 3. PERMANENT BRANDING WATERMARK (Always on live stream) ----------------- */}
      {isStreamLive && (
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-20 pointer-events-none select-none flex items-center gap-2.5 animate-in fade-in duration-200">
          <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shrink-0 shadow-md">
            <img
              src="/brand/logo.png"
              alt="Atomic Pathshala"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide drop-shadow leading-tight">
                Atomic Pathshala
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            </div>
            {subject && (
              <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium truncate leading-tight mt-0.5">
                {subject} {educatorName ? `• ${educatorName}` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ----------------- 4. FLOATING TOP HEADER INFO (Fades with controls) ----------------- */}
      {isStreamLive && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-end pointer-events-none transition-opacity duration-300 z-20 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Sync Live Badge */}
          <button
            type="button"
            onClick={handleGoLive}
            className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black transition-all shadow-md cursor-pointer ${
              isLiveEdge
                ? "bg-rose-600 text-white shadow-rose-600/50 ring-2 ring-white/20"
                : "bg-slate-800/90 hover:bg-rose-700 text-slate-300 hover:text-white border border-slate-700"
            }`}
            title="Click to sync directly to live edge"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveEdge ? "bg-white animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{isLiveEdge ? "SYNCED LIVE" : "GO LIVE"}</span>
          </button>
        </div>
      )}

      {/* ----------------- 5. BOTTOM CONTROL BAR OVERLAY ----------------- */}
      {isStreamLive && (
        <div
          className={`absolute bottom-2 left-2 right-2 px-3 py-1.5 bg-[#0e111d]/90 backdrop-blur-md rounded-xl border border-slate-700/80 flex items-center justify-between gap-2 shadow-2xl transition-opacity duration-300 z-20 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Controls: Sync Live, Seek -10s, Seek +10s */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGoLive}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                isLiveEdge
                  ? "bg-rose-600/20 text-rose-400 border border-rose-500/40"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Sync Live</span>
            </button>

            <button
              type="button"
              onClick={() => handleSeek(-10)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
              title="Rewind 10 seconds"
            >
              <span className="material-symbols-outlined text-base">replay_10</span>
              <span className="hidden sm:inline text-[11px]">-10s</span>
            </button>

            <button
              type="button"
              onClick={() => handleSeek(10)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
              title="Forward 10 seconds"
            >
              <span className="material-symbols-outlined text-base">forward_10</span>
              <span className="hidden sm:inline text-[11px]">+10s</span>
            </button>

            {/* Mute / Unmute Button */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition text-xs font-semibold flex items-center cursor-pointer ml-1"
              title={isMuted ? "Unmute" : "Mute"}
            >
              <span className="material-symbols-outlined text-base">
                {isMuted ? "volume_off" : "volume_up"}
              </span>
            </button>
          </div>

          {/* Right Controls: Speed Selector, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1 border border-slate-700 transition cursor-pointer"
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
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition cursor-pointer ${
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

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <span className="material-symbols-outlined text-base">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Children (e.g. VideoPollOverlay) */}
      <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}