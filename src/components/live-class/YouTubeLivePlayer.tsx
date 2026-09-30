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
  /** Host-provided fullscreen (e.g. the student room: whole page + landscape, so chat can sit beside the video). */
  onFullscreen?: () => void;
  /** Link to this class on Atomic's own domain (never YouTube) — offered in the ⋮ menu. */
  shareUrl?: string;
  /** On a live call with the teacher: the stream's (delayed) audio is silenced so the student doesn't hear the teacher twice. */
  silenced?: boolean;
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
  onFullscreen,
  shareUrl,
  silenced = false,
  className = "",
  children,
}: YouTubeLivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // The real YT.Player wrapper (see the IFrame API bootstrap effect below) —
  // used for every control action instead of the old raw postMessage guesses.
  const playerRef = useRef<any>(null);
  // Time and DVR length as the iframe last reported them (infoDelivery).
  const reportedRef = useRef<{ cur: number | null; dur: number | null }>({ cur: null, dur: null });

  const [isStreamLive, setIsStreamLive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [hasEmbedError, setHasEmbedError] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const shareClass = async () => {
    setShowMoreMenu(false);
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: `Join the live class: ${title}`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareNote("Class link copied");
    } catch {
      setShareNote(shareUrl);
    }
    setTimeout(() => setShareNote(null), 3000);
  };
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // The embed autoplays with mute=1 (browsers only allow muted autoplay), so
  // the player starts muted; unmuteNow() lifts it on the first possible moment.
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const ytPlayerElementId = useMemo(
    () => "atomic-yt-live-" + Math.random().toString(36).substring(2, 9),
    []
  );

  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // An embed opened while the broadcast was still "upcoming" only notices it
  // went live after YouTube polls again (often 30-60 s) — students sat on the
  // waiting screen after the class had started. Remount the player the moment
  // the class goes LIVE so the live video loads straight away.
  const playerKey = `${youtubeVideoId ?? ""}:${livePhase === "LIVE" ? "live" : "pre"}`;

  // Reset embed error when video changes
  useEffect(() => {
    setHasEmbedError(false);
    setIsStreamLive(false);
    setHasStartedPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    reportedRef.current = { cur: null, dur: null };
    setIsLiveEdge(true);
  }, [playerKey]);

  // Dispatch a control action through the real YT.Player instance
  const sendYouTubeCommand = useCallback((func: string, args: unknown[] = []) => {
    const player = playerRef.current;
    if (player) {
      try {
        switch (func) {
          case "playVideo":
            player.playVideo?.();
            break;
          case "pauseVideo":
            player.pauseVideo?.();
            break;
          case "seekTo":
            player.seekTo?.(args[0], args[1] ?? true);
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
    }
    // PostMessage fallback directly to iframe
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func,
          args,
        }),
        "*"
      );
    } catch {
      // ignore
    }
  }, []);

  // Poll player current time & duration regularly for DVR seekbar
  useEffect(() => {
    if (!isStreamLive) return;
    const interval = setInterval(() => {
      try {
        const player = playerRef.current;
        if (player || reportedRef.current.cur !== null) {
          const cur = player?.getCurrentTime?.() ?? reportedRef.current.cur;
          const dur = player?.getDuration?.() ?? reportedRef.current.dur;
          if (typeof cur === "number" && !isNaN(cur)) {
            setCurrentTime(cur);
          }
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
            setDuration(dur);
            if (dur - (cur ?? 0) <= 6) {
              setIsLiveEdge(true);
            } else {
              setIsLiveEdge(false);
            }
          }
        }
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isStreamLive]);

  // When video ID exists, trigger play and ensure stream is marked live
  useEffect(() => {
    if (youtubeVideoId) {
      sendYouTubeCommand("playVideo");
      const timer = setTimeout(() => {
        setIsStreamLive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [livePhase, youtubeVideoId, sendYouTubeCommand]);

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

  // Bootstrap the official YouTube IFrame Player API
  useEffect(() => {
    if (!youtubeVideoId || !iframeRef.current) return;
    let cancelled = false;
    let player: any = null;

    const handleMessage = (event: MessageEvent) => {
      try {
        const d = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // The player's own time/DVR length, even if the YT.Player wrapper isn't
        // ready: rewinding used to count from 0 then and jump to the start.
        if (d?.event === "infoDelivery" && d.info) {
          if (typeof d.info.currentTime === "number" && !isNaN(d.info.currentTime)) reportedRef.current.cur = d.info.currentTime;
          if (typeof d.info.duration === "number" && d.info.duration > 0) reportedRef.current.dur = d.info.duration;
        }
        if (d?.event === "infoDelivery" && (d.info?.playerState === 1 || d.info?.playerState === 3)) {
          setIsStreamLive(true);
          setHasEmbedError(false);
          setIsPlaying(true);
        } else if (d?.event === "onStateChange") {
          if (d.data === 1 || d.data === 3) {
            setIsStreamLive(true);
            setHasEmbedError(false);
            setIsPlaying(true);
          } else if (d.data === 2) {
            setIsPlaying(false);
          }
        } else if (d?.event === "onError" && (d.data === 150 || d.data === 101 || d.data === 100 || d.data === 5)) {
          setHasEmbedError(true);
        }
      } catch {
        // ignore non-json messages
      }
    };
    window.addEventListener("message", handleMessage);

    const attachPlayer = () => {
      if (cancelled || !(window as any).YT?.Player) return;
      const targetEl = document.getElementById(ytPlayerElementId) || iframeRef.current;
      if (!targetEl) return;

      try {
        player = new (window as any).YT.Player(targetEl, {
          events: {
            onReady: (e: any) => {
              playerRef.current = e.target;
              try {
                e.target.seekTo?.(999999, true);
                e.target.playVideo?.();
                e.target.unMute?.();
                e.target.setVolume?.(100);
              } catch {}
              setIsPlaying(true);
              // The browser may refuse sound without a tap on this page: read back the truth.
              setTimeout(() => {
                try {
                  setIsMuted(Boolean(e.target.isMuted?.()));
                } catch {}
              }, 800);
            },
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) {
                setIsStreamLive(true);
                setHasEmbedError(false);
                setIsPlaying(true);
                setHasStartedPlaying(true);
              } else if (e.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
            },
            onError: (e: any) => {
              console.warn("[YouTubeLivePlayer] Player error code:", e.data);
              if (e.data === 150 || e.data === 101 || e.data === 100 || e.data === 5) {
                setHasEmbedError(true);
              }
            },
            onPlaybackRateChange: (e: any) => {
              if (typeof e.data === "number") setPlaybackSpeed(e.data);
            },
          },
        });
      } catch (err) {
        console.warn("[YouTubeLivePlayer] Player init error:", err);
      }
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
      window.removeEventListener("message", handleMessage);
      playerRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        // no-op
      }
    };
  }, [playerKey]);

  // Periodically nudge playback until the live stream is confirmed playing
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
    const cur = playerRef.current?.getCurrentTime?.() ?? reportedRef.current.cur ?? currentTime;
    const dur = playerRef.current?.getDuration?.() ?? reportedRef.current.dur ?? duration;
    const target = Math.max(0, cur + offsetSeconds);
    setCurrentTime(target);
    if (dur > 0 && target >= dur - 6) {
      setIsLiveEdge(true);
    } else {
      setIsLiveEdge(false);
    }
    sendYouTubeCommand("seekTo", [target, true]);
    resetControlsTimer();
  };

  const handleSliderSeek = (targetTime: number) => {
    setCurrentTime(targetTime);
    const dur = duration || (playerRef.current?.getDuration?.() ?? 0);
    if (dur > 0 && targetTime >= dur - 6) {
      setIsLiveEdge(true);
    } else {
      setIsLiveEdge(false);
    }
    sendYouTubeCommand("seekTo", [targetTime, true]);
    resetControlsTimer();
  };

  const handleGoLive = () => {
    const dur = playerRef.current?.getDuration?.() ?? duration;
    sendYouTubeCommand("seekTo", [dur > 0 ? dur : 999999, true]);
    sendYouTubeCommand("playVideo", []);
    setPlaybackSpeed(1);
    sendYouTubeCommand("setPlaybackRate", [1]);
    setIsLiveEdge(true);
    setIsPlaying(true);
    resetControlsTimer();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      sendYouTubeCommand("pauseVideo");
      setIsPlaying(false);
    } else {
      sendYouTubeCommand("playVideo");
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  const formatDisplayTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const unmuteNow = () => {
    sendYouTubeCommand("unMute");
    sendYouTubeCommand("setVolume", [100]);
    setIsMuted(false);
  };

  // Call audio comes live over LiveKit; the stream carries the same voice
  // 5-20 s later, so it is muted for the call and restored afterwards.
  const mutedBeforeCallRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (silenced) {
      if (mutedBeforeCallRef.current === null) mutedBeforeCallRef.current = isMuted;
      sendYouTubeCommand("mute");
    } else if (mutedBeforeCallRef.current !== null) {
      if (!mutedBeforeCallRef.current) {
        sendYouTubeCommand("unMute");
        sendYouTubeCommand("setVolume", [100]);
      }
      mutedBeforeCallRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silenced, sendYouTubeCommand]);

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
    return `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&fs=0&live=1${originParam}`;
  }, [playerKey]);

  if (!youtubeVideoId || livePhase === "SCHEDULED") {
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
          key={playerKey}
          id={ytPlayerElementId}
          ref={iframeRef}
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => {
            try {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "listening", id: ytPlayerElementId }),
                "*"
              );
            } catch {}
          }}
          // Taller than 16:9 at full width: YouTube letterboxes the video in the
          // middle and puts its own title/share/logo on the black bands, which
          // the container crops. (The old zoom-crop cut the edges of the board.)
          className="w-full h-[160%] max-w-none shrink-0 border-0 pointer-events-none"
        />

        {/* Interaction transparent shield: intercepts user clicks so they NEVER open or redirect to YouTube */}
        <div
          onClick={() => {
            if (isMuted) unmuteNow();
            if (!hasStartedPlaying) {
              setHasStartedPlaying(true);
              sendYouTubeCommand("playVideo");
              sendYouTubeCommand("seekTo", [999999, true]);
              setIsPlaying(true);
              setIsStreamLive(true);
            } else if (!isPlaying) {
              // Paused while watching an earlier part: resume right there
              // (it used to jump back to the live moment).
              sendYouTubeCommand("playVideo");
              setIsPlaying(true);
            }
            setShowControls((prev) => !prev);
            resetControlsTimer();
          }}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        />

        {/* Big Center Play / Tap to Watch Live Button if autoplay is waiting */}
        {!hasStartedPlaying && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setHasStartedPlaying(true);
              sendYouTubeCommand("playVideo");
              sendYouTubeCommand("seekTo", [999999, true]);
              sendYouTubeCommand("unMute");
              setIsMuted(false);
              setIsPlaying(true);
              setIsStreamLive(true);
            }}
            className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs cursor-pointer group transition-all"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/95 group-hover:bg-red-500 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-200 ring-4 ring-white/30 animate-pulse">
              <span className="material-symbols-outlined text-3xl sm:text-4xl ml-1">play_arrow</span>
            </div>
            <span className="mt-3 px-3.5 py-1 rounded-full bg-slate-900/90 text-white text-xs font-bold border border-slate-700 shadow-lg">
              Click to Start Live Stream
            </span>
          </div>
        )}
      </div>

      {/* ----------------- 2. EMBED RESTRICTION FALLBACK CARD ----------------- */}
      {hasEmbedError && (
        <div className="absolute inset-0 z-25 bg-gradient-to-br from-[#080b14] via-[#0d1222] to-[#060810] flex flex-col items-center justify-between p-5 sm:p-7 text-center select-none overflow-hidden animate-in fade-in duration-300">
          {/* Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

          {/* Top Info */}
          <div className="relative z-10 w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shadow">
                <img src="/brand/logo.png" alt="Atomic Pathshala" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">Atomic Pathshala</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>LIVE BROADCAST ACTIVE</span>
            </div>
          </div>

          {/* Center Stream Action */}
          <div className="relative z-10 my-auto flex flex-col items-center gap-3 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 p-3.5 shadow-xl shadow-red-500/25 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-white">live_tv</span>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight line-clamp-2">{title}</h3>
              {educatorName && <p className="text-xs text-slate-300 mt-1 font-medium">Educator: {educatorName}</p>}
            </div>

            <p className="text-xs text-slate-400">
              Live broadcast is streaming. Tap below to watch directly with zero lag.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <a
                href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span>Watch Stream in New Tab</span>
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  const url = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
                  window.open(url, "AtomicLiveStream", "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no");
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">picture_in_picture_alt</span>
                <span>Popout Window</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasEmbedError(false);
                  sendYouTubeCommand("playVideo");
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium border border-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Retry</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 text-[10px] text-slate-500 text-center">
            Atomic Pathshala High Definition Live Broadcast Engine
          </div>
        </div>
      )}

      {/* ----------------- 3. ATOMIC PATHSHALA BRANDED WAITING STAGE ----------------- */}
      {/* Covers YouTube's raw waiting card until the live stream actually starts broadcasting */}
      {!isStreamLive && !hasEmbedError && (
        <div
          onClick={() => {
            if (livePhase === "LIVE") {
              sendYouTubeCommand("playVideo");
              setIsStreamLive(true);
            }
          }}
          className={`absolute inset-0 z-20 bg-gradient-to-br from-[#080a14] via-[#0d1224] to-[#060810] flex flex-col items-center justify-between p-4 sm:p-7 select-none overflow-hidden animate-in fade-in duration-300 ${
            livePhase === "LIVE" ? "cursor-pointer" : ""
          }`}
        >
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

            {/* Dynamic Status / Tap to Play */}
            {livePhase === "LIVE" ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sendYouTubeCommand("playVideo");
                  setIsStreamLive(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-red-600/30 ring-2 ring-red-400/40 animate-pulse cursor-pointer transition transform active:scale-95"
              >
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span>🔴 Live Broadcast Started — Tap to Watch</span>
              </button>
            ) : lateSeconds > 0 ? (
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
            {livePhase === "LIVE"
              ? "Live broadcast is currently active. Tap anywhere to begin playback."
              : "Class will broadcast automatically the second the teacher goes live."}
          </div>
        </div>
      )}

      {/* ----------------- 4. SOUND: the embed autoplays MUTED (browser rule) ----------------- */}
      {/* A clear "tap for sound" pill whenever the player is actually muted —
          students previously heard nothing while the icon said "volume on". */}
      {isStreamLive && isMuted && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            unmuteNow();
          }}
          className="absolute top-2 left-2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur-sm border border-white/20 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">volume_off</span>
          <span>Tap for sound</span>
        </button>
      )}

      {shareNote && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/80 text-white text-[11px] max-w-[90%] truncate">
          {shareNote}
        </div>
      )}

      {/* ----------------- 5. SLIM CONTROL STRIP (transparent, fades out) ----------------- */}
      {isStreamLive && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 px-2 pb-1 pt-4 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Thin progress line */}
          <input
            type="range"
            min={0}
            max={Math.max(duration, currentTime, 1)}
            step={1}
            value={currentTime}
            onChange={(e) => handleSliderSeek(Number(e.target.value))}
            aria-label="Seek"
            className="block w-full h-[3px] appearance-none cursor-pointer bg-white/25 rounded-full accent-red-500 focus:outline-none"
          />
          <div className="mt-0.5 flex items-center justify-between text-white/90">
            <div className="flex items-center">
              <button type="button" onClick={togglePlayPause} className="p-1 cursor-pointer" title={isPlaying ? "Pause" : "Play"}>
                <span className="material-symbols-outlined text-[18px]">{isPlaying ? "pause" : "play_arrow"}</span>
              </button>
              <button type="button" onClick={() => handleSeek(-10)} className="p-1 cursor-pointer" title="Back 10 seconds">
                <span className="material-symbols-outlined text-[18px]">replay_10</span>
              </button>
              <button type="button" onClick={() => handleSeek(10)} className="p-1 cursor-pointer" title="Forward 10 seconds">
                <span className="material-symbols-outlined text-[18px]">forward_10</span>
              </button>
              <button type="button" onClick={toggleMute} className="p-1 cursor-pointer" title={isMuted ? "Unmute" : "Mute"}>
                <span className="material-symbols-outlined text-[18px]">{isMuted ? "volume_off" : "volume_up"}</span>
              </button>
              <span className="ml-1 text-[10px] font-mono text-white/70 select-none">{formatDisplayTime(currentTime)}</span>
              {!isLiveEdge && (
                <button
                  type="button"
                  onClick={handleGoLive}
                  className="ml-2 text-[10px] font-semibold text-white/80 hover:text-white underline underline-offset-2 cursor-pointer"
                  title="Jump to the live moment"
                >
                  Go live
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="px-1 text-[11px] font-mono cursor-pointer"
                title="Playback speed"
              >
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 w-20 bg-black/85 rounded-lg p-1 z-30 backdrop-blur-sm">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] cursor-pointer ${playbackSpeed === rate ? "bg-white/20 font-bold" : "hover:bg-white/10"}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
              {shareUrl && (
                <div className="relative">
                  <button type="button" onClick={() => setShowMoreMenu((v) => !v)} className="p-1 cursor-pointer" title="More">
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </button>
                  {showMoreMenu && (
                    <div className="absolute bottom-full right-0 mb-1 w-36 bg-black/85 rounded-lg p-1 z-30 backdrop-blur-sm">
                      <button type="button" onClick={shareClass} className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-[11px] hover:bg-white/10 cursor-pointer">
                        <span className="material-symbols-outlined text-[15px]">share</span>
                        Share class
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button type="button" onClick={onFullscreen ?? toggleFullscreen} className="p-1 cursor-pointer" title={isFullscreen ? "Exit fullscreen" : "Fullscreen / rotate"}>
                <span className="material-symbols-outlined text-[18px]">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
              </button>
            </div>
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