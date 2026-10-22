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
  /** Link to this class on Atomic's own domain (never YouTube) — offered below the player. */
  shareUrl?: string;
  /** On a live call with the teacher: the stream's (delayed) audio is silenced so the student doesn't hear the teacher twice. */
  silenced?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * The live class as YouTube's own embedded player.
 *
 * YouTube API Services policy: the player is shown as YouTube ships it — its
 * controls, logo and title stay visible, nothing is drawn over it and clicks
 * reach it. (This player used to crop YouTube's branding off, cover the video
 * with a click shield and custom controls, and offer a pop-up window; all of
 * that is gone.) Our own pieces — status before the class starts, "tap for
 * sound", share, fullscreen — sit outside the player, never on it.
 *
 * The IFrame API is used only to read the player's state and to mute the
 * stream while the student is on a live call (they hear the teacher directly).
 */
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
  const playerRef = useRef<any>(null);

  const [hasEmbedError, setHasEmbedError] = useState(false);
  // The embed autoplays muted (browsers only allow muted autoplay); this
  // mirrors the player so the "tap for sound" button shows only when needed.
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [retryKey, setRetryKey] = useState(0);

  const ytPlayerElementId = useMemo(
    () => "atomic-yt-live-" + Math.random().toString(36).substring(2, 9),
    []
  );

  const isLive = livePhase === "LIVE" && Boolean(youtubeVideoId);
  // Remount the player when the class goes live or the student retries.
  const playerKey = `${youtubeVideoId ?? ""}:${isLive ? "live" : "pre"}:${retryKey}`;

  useEffect(() => {
    setHasEmbedError(false);
    setIsMuted(true);
  }, [playerKey]);

  const embedUrl = useMemo(() => {
    if (!youtubeVideoId) return "";
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    return `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=1&mute=1&controls=1&fs=1&rel=0&playsinline=1${originParam}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey]);

  // Countdown / "teacher connecting" clock for the pre-class card.
  useEffect(() => {
    if (isLive) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  const scheduledStartMs = useMemo(() => {
    if (!scheduledStart) return null;
    const ms = new Date(scheduledStart).getTime();
    return isNaN(ms) ? null : ms;
  }, [scheduledStart]);
  const lateSeconds = scheduledStartMs ? Math.max(0, Math.floor((nowMs - scheduledStartMs) / 1000)) : 0;
  const countdownSeconds = scheduledStartMs ? Math.max(0, Math.floor((scheduledStartMs - nowMs) / 1000)) : 0;

  // Official IFrame Player API — state only.
  useEffect(() => {
    if (!isLive || !iframeRef.current) return;
    let cancelled = false;
    let player: any = null;

    const attachPlayer = () => {
      if (cancelled || !(window as any).YT?.Player) return;
      const targetEl = document.getElementById(ytPlayerElementId) || iframeRef.current;
      if (!targetEl) return;
      try {
        player = new (window as any).YT.Player(targetEl, {
          events: {
            onReady: (e: any) => {
              playerRef.current = e.target;
              // Try for sound straight away; the browser may refuse it until
              // the student taps the page — read back what actually happened.
              try {
                e.target.unMute?.();
                e.target.setVolume?.(100);
              } catch {}
              setTimeout(() => {
                try {
                  setIsMuted(Boolean(e.target.isMuted?.()));
                } catch {}
              }, 800);
            },
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.PLAYING) setHasEmbedError(false);
            },
            onError: (e: any) => {
              console.warn("[YouTubeLivePlayer] Player error code:", e.data);
              if (e.data === 150 || e.data === 101 || e.data === 100 || e.data === 5) {
                setHasEmbedError(true);
              }
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

    // The student can unmute with YouTube's own button too — keep in step.
    const poll = setInterval(() => {
      try {
        const p = playerRef.current;
        if (p?.isMuted) setIsMuted(Boolean(p.isMuted()));
      } catch {}
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      playerRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        // no-op
      }
    };
  }, [playerKey, isLive, ytPlayerElementId]);

  const unmuteNow = useCallback(() => {
    try {
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(100);
    } catch {}
    setIsMuted(false);
  }, []);

  // Call audio comes live over LiveKit; the stream carries the same voice
  // 5-20 s later, so it is muted for the call and restored afterwards.
  const mutedBeforeCallRef = useRef<boolean | null>(null);
  useEffect(() => {
    const p = playerRef.current;
    if (silenced) {
      if (mutedBeforeCallRef.current === null) mutedBeforeCallRef.current = isMuted;
      try {
        p?.mute?.();
      } catch {}
    } else if (mutedBeforeCallRef.current !== null) {
      if (!mutedBeforeCallRef.current) {
        try {
          p?.unMute?.();
          p?.setVolume?.(100);
        } catch {}
      }
      mutedBeforeCallRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silenced]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        if (typeof screen !== "undefined" && screen.orientation && "lock" in screen.orientation) {
          await (screen.orientation as any).lock("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        if (typeof screen !== "undefined" && screen.orientation && "unlock" in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const shareClass = async () => {
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

  // Before the class is live: our own card — no YouTube player behind it.
  if (!isLive) {
    return (
      <div className={`w-full aspect-video bg-[#0a0c16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-6 text-center gap-3 relative overflow-hidden ${className}`}>
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 p-3 border border-white/20 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/logo.png" alt="Atomic Pathshala" className="w-full h-full object-contain" />
        </div>
        <div className="max-w-md space-y-1">
          {subject && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/30">
              {subject}
            </span>
          )}
          <h3 className="font-bold text-base sm:text-lg text-white line-clamp-2">{title}</h3>
          {educatorName && <p className="text-xs text-slate-300">{educatorName}</p>}
          <p className="text-xs text-slate-400">
            {isTeacher
              ? "Start the stream from the Teacher Studio or the Windows app to go live."
              : "The class will appear here automatically when the teacher goes live."}
          </p>
        </div>
        {lateSeconds > 0 ? (
          <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-mono font-bold">
            Teacher connecting… {Math.floor(lateSeconds / 60) > 0 ? `${Math.floor(lateSeconds / 60)}m ` : ""}
            {lateSeconds % 60}s
          </span>
        ) : countdownSeconds > 0 ? (
          <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-mono font-bold">
            Starts in {Math.floor(countdownSeconds / 60)}m {countdownSeconds % 60}s
          </span>
        ) : null}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Check stream status
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col bg-black ${isFullscreen ? "h-screen" : "h-full"} ${className}`}
    >
      <div
        // Fills the box the room gives it (its height minus the slim bar);
        // the iframe keeps YouTube's own letterboxing inside.
        className="relative w-full flex-1 min-h-0 bg-black overflow-hidden"
      >
        {hasEmbedError ? (
          // The player itself reported it can't play here — show why and a
          // link to the video on YouTube (a normal new tab, no pop-up).
          <div className="absolute inset-0 bg-[#0a0c16] flex flex-col items-center justify-center p-6 text-center gap-3">
            <span className="material-symbols-outlined text-3xl text-rose-400">live_tv</span>
            <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2">{title}</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              YouTube couldn&apos;t play this stream inside the app. You can watch it on YouTube.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                Watch on YouTube
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setHasEmbedError(false);
                  setRetryKey((k) => k + 1);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <iframe
            key={playerKey}
            id={ytPlayerElementId}
            ref={iframeRef}
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>

      {/* Our controls — below the player, never over it. */}
      <div className="h-8 px-2 flex items-center gap-2 text-[11px] shrink-0 bg-black text-slate-300">
        {isMuted && !silenced && !hasEmbedError && (
          <button
            type="button"
            onClick={unmuteNow}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">volume_up</span>
            Tap for sound
          </button>
        )}
        {silenced && (
          <span className="flex items-center gap-1 text-slate-400">
            <span className="material-symbols-outlined text-sm">call</span>
            Stream muted during your call
          </span>
        )}
        <span className="flex-1 min-w-0 truncate text-slate-400">{shareNote}</span>
        {shareUrl && (
          <button
            type="button"
            onClick={shareClass}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Share class"
          >
            <span className="material-symbols-outlined text-sm">share</span>
            Share
          </button>
        )}
        <button
          type="button"
          onClick={onFullscreen ?? toggleFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen / rotate"}
        >
          <span className="material-symbols-outlined text-sm">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
        </button>
      </div>

      {children}
    </div>
  );
}
