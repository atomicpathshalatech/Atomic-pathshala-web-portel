"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useWatchHeartbeat } from "@/lib/video/use-watch-heartbeat";

export interface LectureVideoPlayerProps {
  mode?: "recorded" | "live";
  lectureId?: string;
  title: string;
  subtitle?: string;
  subjectTitle?: string;
  educatorName?: string;
  videoUrl: string;
  posterUrl?: string | null;
  initialTime?: number;
  watermarkText?: string;
  onClose?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** "lecture:<id>" | "schedule:<id>" — records this student's real watch time for the class. */
  watchContentKey?: string;
  onEnded?: () => void;
  onProgressPercentage?: (percent: number) => void;
  onBookmarkAdd?: (timestamp: number) => void;
  isCompleted?: boolean;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0] as const;

// Controls, branding and the close button all fade out after this long
// without interaction — whether the video is playing or paused.
const CONTROLS_HIDE_MS = 2500;

export const DEFAULT_QUALITY_OPTIONS = [
  "1080p",
  "720p",
  "480p",
  "360p",
  "240p",
  "144p",
  "Auto",
] as const;

export const YT_QUALITY_MAP: Record<string, string> = {
  "4K (2160p)": "hd2160",
  "1440p": "hd1440",
  "1080p": "hd1080",
  "720p": "hd720",
  "480p": "large",
  "360p": "medium",
  "240p": "small",
  "144p": "tiny",
  "Auto": "default",
};

export const YT_LEVEL_TO_LABEL: Record<string, string> = {
  highres: "4K (2160p)",
  hd2160: "4K (2160p)",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Auto",
  default: "Auto",
};

/**
 * YouTube ignores setPlaybackQuality() nowadays — its adaptive player picks
 * the stream from the embed's rendered pixel size. So to honour the chosen
 * quality we render the iframe at (at least) that many device pixels wide
 * and CSS-scale it back down to fit. "Auto" leaves it at its natural size.
 */
const QUALITY_TARGET_WIDTH: Record<string, number> = {
  "4K (2160p)": 3840,
  "1440p": 2560,
  "1080p": 1920,
  "720p": 1280,
  "480p": 854,
  "360p": 640,
  "240p": 426,
  "144p": 256,
};

const VIDEO_ASPECT = 16 / 9;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  if (url.includes("embed/")) {
    return url.split("embed/")[1]?.split("?")[0] || null;
  }
  if (url.includes("watch?v=")) {
    return url.split("watch?v=")[1]?.split("&")[0] || null;
  }
  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1]?.split("?")[0] || null;
  }
  if (url.includes("/live/")) {
    return url.split("/live/")[1]?.split(/[?&/]/)[0] || null;
  }
  return null;
}

export function LectureVideoPlayer({
  mode = "recorded",
  lectureId = "lecture",
  title,
  subjectTitle,
  educatorName,
  videoUrl,
  posterUrl,
  initialTime = 0,
  watermarkText,
  onClose,
  onTimeUpdate,
  watchContentKey,
  onEnded,
  onProgressPercentage,
  className = "",
}: LectureVideoPlayerProps) {
  const { data: session } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ytPlayerRef = useRef<any>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastTickTimeRef = useRef<number>(Date.now());
  const lastReportedTimeRef = useRef<number>(-1);
  const seekCooldownUntilRef = useRef<number>(0);
  const scrubTargetTimeRef = useRef<number>(0);
  const lastSavedProgressRef = useRef<number>(0);
  // A resume position chosen before the first real play (the seek may be
  // dropped while a phone is still waiting for the in-iframe tap).
  const pendingSeekRef = useRef<number | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  useWatchHeartbeat(mode === "recorded" ? watchContentKey : null, currentTime, duration);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<string>("1080p");
  const [qualityOptions, setQualityOptions] = useState<string[]>([...DEFAULT_QUALITY_OPTIONS]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iPhone Safari can't fullscreen a <div>; fall back to a fixed overlay.
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isAspectFill, setIsAspectFill] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  // YouTube flashes its title / channel logo for a few seconds whenever
  // playback starts or resumes; keep the top edge veiled until it fades.
  const [ytTitleVeil, setYtTitleVeil] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [savedResumeTime, setSavedResumeTime] = useState(0);

  const [feedbackIcon, setFeedbackIcon] = useState<{
    icon: string;
    text?: string;
    key: number;
  } | null>(null);

  const isLive = mode === "live";
  const expanded = isFullscreen || isPseudoFullscreen;

  const youtubeVideoId = useMemo(() => extractYouTubeVideoId(videoUrl), [videoUrl]);
  const isYouTube = Boolean(youtubeVideoId);
  const ytPlayerElementId = useMemo(
    () => "atomic-yt-" + Math.random().toString(36).substring(2, 9),
    []
  );

  // Latest values for the one-time YT.Player init + callbacks, so changing
  // volume/speed never re-creates the player (that used to reset playback).
  const settingsRef = useRef({ volume, isMuted, playbackSpeed, selectedQuality, initialTime });
  settingsRef.current = { volume, isMuted, playbackSpeed, selectedQuality, initialTime };
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  const callbacksRef = useRef({ onEnded, onTimeUpdate, onProgressPercentage });
  callbacksRef.current = { onEnded, onTimeUpdate, onProgressPercentage };

  // The standard YouTube embed: YouTube's own controls, logo and branding stay
  // visible and nothing is drawn over the player (YouTube API Services
  // policy). The JS API is on only to save progress and resume.
  const youtubeEmbedUrl = useMemo(() => {
    if (!youtubeVideoId) return "";
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    return `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&controls=1&rel=0&playsinline=1&fs=1&iv_load_policy=3&autoplay=0${originParam}`;
  }, [youtubeVideoId]);

  const activeWatermark = useMemo(() => {
    if (watermarkText) return watermarkText;
    const email = session?.user?.email || "";
    const phone = (session?.user as any)?.phone || (session?.user as any)?.mobile || "";
    if (email && phone) return `${email} ${phone}`;
    if (email) return email;
    if (session?.user?.name) return `${session.user.name} (Atomic Pathshala)`;
    return "Atomic Pathshala Verified Student";
  }, [watermarkText, session]);

  // Track the rendered size — drives the YouTube quality render-scale and
  // the "fill" crop factor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load stored preferences (volume, muted, speed, quality)
  useEffect(() => {
    try {
      const storedVol = localStorage.getItem("atomic_player_volume");
      const storedMute = localStorage.getItem("atomic_player_muted");
      const storedSpeed = localStorage.getItem("atomic_playback_rate");
      const storedQuality = localStorage.getItem("atomic_player_quality");

      if (storedVol !== null) {
        const v = parseFloat(storedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          setVolume(v);
          setPreviousVolume(v > 0 ? v : 1);
        }
      }
      if (storedMute === "true") setIsMuted(true);
      if (storedSpeed !== null) {
        const s = parseFloat(storedSpeed);
        if ((SPEED_OPTIONS as readonly number[]).includes(s)) setPlaybackSpeed(s);
      }
      if (storedQuality && (storedQuality === "Auto" || QUALITY_TARGET_WIDTH[storedQuality])) {
        setSelectedQuality(storedQuality);
      }
    } catch {}
  }, []);

  // Saved resume position for recorded lectures
  useEffect(() => {
    if (isLive || !lectureId) return;
    try {
      const saved = localStorage.getItem(`atomic_progress_${lectureId}`);
      if (saved) {
        const t = parseFloat(saved);
        if (t > 15 && (!initialTime || initialTime === 0)) {
          setSavedResumeTime(t);
          setShowResumeBanner(true);
        }
      }
    } catch {}
  }, [lectureId, isLive, initialTime]);

  // Persist progress (YouTube and HTML5 alike) every ~5s of playback
  useEffect(() => {
    if (isLive || !lectureId || !isPlaying) return;
    if (Math.abs(currentTime - lastSavedProgressRef.current) < 5) return;
    lastSavedProgressRef.current = currentTime;
    try {
      localStorage.setItem(`atomic_progress_${lectureId}`, String(currentTime));
    } catch {}
  }, [currentTime, isPlaying, isLive, lectureId]);

  const triggerFeedback = useCallback((icon: string, text?: string) => {
    setFeedbackIcon({ icon, text, key: Date.now() });
    setTimeout(() => {
      setFeedbackIcon((prev) => (prev?.text === text ? null : prev));
    }, 600);
  }, []);

  // ---------- Auto-hide ----------
  const menusOpen = showSpeedMenu || showQualityMenu;
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);

  // Menus / scrubbing pin the controls; closing them restarts the countdown.
  useEffect(() => {
    if (menusOpen || isScrubbing) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
    } else {
      resetControlsTimer();
    }
  }, [menusOpen, isScrubbing, resetControlsTimer]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasStartedPlaying) resetControlsTimer();
  }, [hasStartedPlaying, resetControlsTimer]);

  const controlsVisible = hasStartedPlaying && (showControls || menusOpen || isScrubbing);

  // ---------- YouTube bridge ----------
  const sendYouTubeCommand = useCallback((func: string, args: any[] = []) => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current[func] === "function") {
      try {
        ytPlayerRef.current[func](...args);
        return;
      } catch {}
    }
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
      } catch {}
    }
  }, []);

  const markStarted = useCallback(() => {
    setHasStartedPlaying(true);
    setIsPlaying(true);
    setIsBuffering(false);
  }, []);

  const handleYtState = useCallback(
    (state: number) => {
      // 1: PLAYING, 2: PAUSED, 3: BUFFERING, 0: ENDED
      if (state === 1) {
        markStarted();
        if (pendingSeekRef.current !== null) {
          const t = pendingSeekRef.current;
          pendingSeekRef.current = null;
          ytPlayerRef.current?.seekTo?.(t, true);
        }
      } else if (state === 2) {
        setIsPlaying(false);
        setIsBuffering(false);
      } else if (state === 3) setIsBuffering(true);
      else if (state === 0) {
        setIsPlaying(false);
        setShowControls(true);
        callbacksRef.current.onEnded?.();
      }
    },
    [markStarted]
  );

  const commitSeek = useCallback(
    (targetTime: number) => {
      const activeDur = duration || 999999;
      const clamped = Math.max(0, Math.min(targetTime, activeDur));
      setCurrentTime(clamped);
      lastReportedTimeRef.current = clamped;
      seekCooldownUntilRef.current = Date.now() + 1200;

      if (isYouTube) sendYouTubeCommand("seekTo", [clamped, true]);
      else if (videoRef.current) videoRef.current.currentTime = clamped;

      callbacksRef.current.onTimeUpdate?.(clamped, duration);
      if (duration > 0) callbacksRef.current.onProgressPercentage?.(Math.floor((clamped / duration) * 100));
    },
    [duration, isYouTube, sendYouTubeCommand]
  );

  const updateAvailableQualities = useCallback((levels: string[]) => {
    if (!Array.isArray(levels) || levels.length === 0) return;
    const order = ["4K (2160p)", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];
    const detected = new Set<string>();
    for (const lvl of levels) {
      const mapped = YT_LEVEL_TO_LABEL[lvl];
      if (mapped && mapped !== "Auto") detected.add(mapped);
    }
    const filtered = order.filter((label) => detected.has(label));
    if (filtered.length === 0) return;
    filtered.push("Auto");
    setQualityOptions(filtered);
  }, []);

  // Initialize the YouTube Iframe API once per video
  useEffect(() => {
    if (!isYouTube || !youtubeVideoId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function initYt() {
      if (cancelled) return;
      const YT = (window as any).YT;
      if (!YT || !YT.Player) {
        // Script present but not ready yet (e.g. another player loaded it).
        if (attempts++ < 50) retryTimer = setTimeout(initYt, 200);
        return;
      }
      try {
        const targetEl = document.getElementById(ytPlayerElementId) || iframeRef.current;
        if (!targetEl) return;
        new YT.Player(targetEl, {
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              ytPlayerRef.current = e.target;
              const s = settingsRef.current;
              try {
                const dur = e.target.getDuration() || 0;
                if (dur > 0) setDuration(dur);
                e.target.setPlaybackRate(s.playbackSpeed);
                e.target.setVolume(s.isMuted ? 0 : s.volume * 100);
                if (s.isMuted) e.target.mute();
                if (s.initialTime > 0) e.target.seekTo(s.initialTime, true);
                const q = YT_QUALITY_MAP[s.selectedQuality] || "default";
                e.target.setPlaybackQuality?.(q);
                e.target.unloadModule?.("captions");
                e.target.unloadModule?.("cc");
                const levels = e.target.getAvailableQualityLevels?.();
                if (Array.isArray(levels) && levels.length > 0) updateAvailableQualities(levels);
              } catch {}
            },
            onStateChange: (e: any) => handleYtState(e.data),
          },
        });
      } catch (err) {
        console.debug("[LectureVideoPlayer] YT.Player init:", err);
      }
    }

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      const prevReady = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevReady === "function") prevReady();
        initYt();
      };
    } else {
      initYt();
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ytPlayerRef.current = null;
    };
  }, [isYouTube, youtubeVideoId, ytPlayerElementId, handleYtState, updateAvailableQualities]);

  // Raw postMessage listener (works even before YT.Player's onReady)
  useEffect(() => {
    if (!isYouTube) return;
    const handleWindowMessage = (e: MessageEvent) => {
      if (typeof e.origin === "string" && !e.origin.includes("youtube")) return;
      try {
        let msg = e.data;
        if (typeof msg === "string") {
          try {
            msg = JSON.parse(msg);
          } catch {
            return;
          }
        }
        if (!msg || typeof msg !== "object") return;
        if (msg.event === "infoDelivery" && msg.info) {
          const info = msg.info;
          if (typeof info.duration === "number" && info.duration > 0) setDuration(info.duration);
          if (typeof info.videoLoadedFraction === "number") {
            setBufferedEnd((prev) => info.videoLoadedFraction * (info.duration || prev || 0));
          }
          if (Array.isArray(info.availableQualityLevels) && info.availableQualityLevels.length > 0) {
            updateAvailableQualities(info.availableQualityLevels);
          }
          if (typeof info.playerState === "number") handleYtState(info.playerState);
        } else if (msg.event === "onStateChange" && typeof msg.info === "number") {
          handleYtState(msg.info);
        }
      } catch {}
    };
    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [isYouTube, handleYtState, updateAvailableQualities]);

  // First play on phones has to be a real tap *inside* the YouTube iframe
  // (mobile browsers block API-initiated playback of an untouched embed),
  // so before playback starts the iframe is left tappable under our
  // non-interactive poster. If the state event is slow to arrive, a focus
  // move into the iframe is our cue that the student tapped it.
  useEffect(() => {
    if (!isYouTube || hasStartedPlaying) return;
    const onBlur = () => {
      setTimeout(() => {
        if (document.activeElement === iframeRef.current) {
          setHasStartedPlaying(true);
        }
      }, 0);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [isYouTube, hasStartedPlaying]);

  // YouTube progress ticker (the iframe doesn't push timeupdate events)
  useEffect(() => {
    if (!isYouTube) return;
    lastTickTimeRef.current = Date.now();

    const pollInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      let reportedTime: number | null = null;
      let reportedDur: number | null = null;
      let loadedFraction: number | null = null;
      const p = ytPlayerRef.current;
      if (p) {
        try {
          const cur = p.getCurrentTime?.();
          if (typeof cur === "number" && !isNaN(cur) && cur >= 0) reportedTime = cur;
          const dur = p.getDuration?.();
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) reportedDur = dur;
          const frac = p.getVideoLoadedFraction?.();
          if (typeof frac === "number" && !isNaN(frac)) loadedFraction = frac;
        } catch {}
      }

      if (reportedDur && reportedDur > 0) setDuration(reportedDur);
      const activeDur = reportedDur || duration;
      if (loadedFraction !== null && activeDur > 0) setBufferedEnd(loadedFraction * activeDur);
      if (isScrubbing) return;

      const currentTime = currentTimeRef.current;
      let next: number | null = null;
      if (Date.now() < seekCooldownUntilRef.current) {
        if (isPlaying) next = currentTime + elapsed * playbackSpeed;
      } else if (isPlaying) {
        if (reportedTime !== null && Math.abs(reportedTime - currentTime) > 1.2) {
          next = reportedTime;
        } else {
          const base = reportedTime !== null && reportedTime > currentTime ? reportedTime : currentTime;
          next = base + elapsed * playbackSpeed;
        }
      } else if (reportedTime !== null && reportedTime > 0) {
        next = reportedTime;
      }
      if (next === null) return;
      const clamped = activeDur > 0 ? Math.min(next, activeDur) : next;
      lastReportedTimeRef.current = clamped;
      setCurrentTime(clamped);
      callbacksRef.current.onTimeUpdate?.(clamped, activeDur);
      if (activeDur > 0) callbacksRef.current.onProgressPercentage?.(Math.floor((clamped / activeDur) * 100));
    }, 250);

    return () => clearInterval(pollInterval);
  }, [isYouTube, isPlaying, isScrubbing, duration, playbackSpeed]);

  useEffect(() => {
    if (!isYouTube || !isPlaying) return;
    setYtTitleVeil(true);
    const t = setTimeout(() => setYtTitleVeil(false), 4000);
    return () => clearTimeout(t);
  }, [isYouTube, isPlaying]);

  // ---------- Actions ----------
  const togglePlay = useCallback(() => {
    if (isYouTube) {
      if (isPlaying) {
        sendYouTubeCommand("pauseVideo");
        setIsPlaying(false);
      } else if (!hasStartedPlaying) {
        // Not flipped optimistically: on phones this call can be refused
        // until the student taps the iframe itself, and the poster must
        // stay tappable-through until YouTube reports PLAYING.
        sendYouTubeCommand("playVideo");
      } else {
        sendYouTubeCommand("playVideo");
        setIsPlaying(true);
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        setHasStartedPlaying(true);
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
    resetControlsTimer();
  }, [isYouTube, isPlaying, hasStartedPlaying, sendYouTubeCommand, resetControlsTimer]);

  const skip = useCallback(
    (seconds: number) => {
      const targetTime = Math.min(Math.max(0, currentTime + seconds), duration || 999999);
      commitSeek(targetTime);
      triggerFeedback(seconds > 0 ? "forward_10" : "replay_10", seconds > 0 ? "+10s" : "-10s");
      resetControlsTimer();
    },
    [currentTime, duration, commitSeek, triggerFeedback, resetControlsTimer]
  );

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(1, newVol));
      setVolume(clamped);
      setIsMuted(clamped === 0);
      if (clamped > 0) setPreviousVolume(clamped);

      if (isYouTube) {
        sendYouTubeCommand("setVolume", [clamped * 100]);
        sendYouTubeCommand(clamped === 0 ? "mute" : "unMute");
      } else if (videoRef.current) {
        videoRef.current.volume = clamped;
        videoRef.current.muted = clamped === 0;
      }
      try {
        localStorage.setItem("atomic_player_volume", String(clamped));
        localStorage.setItem("atomic_player_muted", clamped === 0 ? "true" : "false");
      } catch {}
    },
    [isYouTube, sendYouTubeCommand]
  );

  const toggleMute = useCallback(() => {
    if (isMuted || volume === 0) {
      const restored = previousVolume > 0 ? previousVolume : 1;
      setVolume(restored);
      setIsMuted(false);
      if (isYouTube) {
        sendYouTubeCommand("unMute");
        sendYouTubeCommand("setVolume", [restored * 100]);
      } else if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = restored;
      }
      triggerFeedback("volume_up", `${Math.round(restored * 100)}%`);
    } else {
      setIsMuted(true);
      if (isYouTube) sendYouTubeCommand("mute");
      else if (videoRef.current) videoRef.current.muted = true;
      triggerFeedback("volume_off", "Muted");
    }
    resetControlsTimer();
  }, [isMuted, volume, previousVolume, isYouTube, sendYouTubeCommand, triggerFeedback, resetControlsTimer]);

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      if (isYouTube) sendYouTubeCommand("setPlaybackRate", [speed]);
      else if (videoRef.current) videoRef.current.playbackRate = speed;
      try {
        localStorage.setItem("atomic_playback_rate", String(speed));
      } catch {}
      triggerFeedback("speed", `${speed}x`);
      setShowSpeedMenu(false);
    },
    [isYouTube, sendYouTubeCommand, triggerFeedback]
  );

  const handleQualityChange = useCallback(
    (q: string) => {
      setSelectedQuality(q);
      try {
        localStorage.setItem("atomic_player_quality", q);
      } catch {}
      if (isYouTube) sendYouTubeCommand("setPlaybackQuality", [YT_QUALITY_MAP[q] || "default"]);
      triggerFeedback("high_quality", q);
      setShowQualityMenu(false);
    },
    [isYouTube, sendYouTubeCommand, triggerFeedback]
  );

  const toggleAspect = useCallback(() => {
    setIsAspectFill((prev) => {
      triggerFeedback("aspect_ratio", prev ? "Fit" : "Fill");
      return !prev;
    });
    resetControlsTimer();
  }, [triggerFeedback, resetControlsTimer]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current as any;
    if (!el) return;
    const doc = document as any;
    const fsElement = document.fullscreenElement || doc.webkitFullscreenElement;
    try {
      if (fsElement) {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
        (screen.orientation as any)?.unlock?.();
        return;
      }
      if (isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        return;
      }
      const request = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!request) {
        setIsPseudoFullscreen(true);
        return;
      }
      await request.call(el);
      await (screen.orientation as any)?.lock?.("landscape").catch?.(() => {});
    } catch {
      setIsPseudoFullscreen((v) => !v);
    }
    resetControlsTimer();
  }, [isPseudoFullscreen, resetControlsTimer]);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "escape":
          if (isPseudoFullscreen) setIsPseudoFullscreen(false);
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          skip(-10);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          skip(10);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          resetControlsTimer();
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          resetControlsTimer();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, skip, handleVolumeChange, volume, isPseudoFullscreen, resetControlsTimer]);

  // ---------- HTML5 video events ----------
  const handleTimeUpdate = () => {
    if (!videoRef.current || isYouTube) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    if (!isScrubbing) setCurrentTime(cur);
    if (dur > 0) setDuration(dur);
    if (videoRef.current.buffered.length > 0) {
      try {
        setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      } catch {}
    }
    onTimeUpdate?.(cur, dur);
    if (dur > 0) onProgressPercentage?.(Math.floor((cur / dur) * 100));
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    onEnded?.();
  };

  // ---------- Progress bar scrubbing ----------
  const resolveDuration = useCallback(() => {
    if (duration > 0) return duration;
    try {
      const d = isYouTube ? ytPlayerRef.current?.getDuration?.() : videoRef.current?.duration;
      if (typeof d === "number" && d > 0) {
        setDuration(d);
        return d;
      }
    } catch {}
    return 0;
  }, [duration, isYouTube]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const dur = resolveDuration();
      if (!progressBarRef.current || dur <= 0) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * dur;
    },
    [resolveDuration]
  );

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const dur = resolveDuration();
    if (dur <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(true);
    const target = timeFromClientX(e.clientX);
    scrubTargetTimeRef.current = target;
    setCurrentTime(target);
    setHoverPosition((target / dur) * 100);
    setHoverTime(target);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dur = duration > 0 ? duration : 1;
    const target = timeFromClientX(e.clientX);
    setHoverPosition((target / dur) * 100);
    setHoverTime(target);
    if (isScrubbing) {
      scrubTargetTimeRef.current = target;
      setCurrentTime(target);
    }
  };

  const endScrub = (e: React.PointerEvent<HTMLDivElement>, target: number) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(false);
    setHoverTime(null);
    commitSeek(target);
  };

  // ---------- Resume ----------
  const applyResumeTime = () => {
    if (savedResumeTime <= 0) return;
    setShowResumeBanner(false);
    if (isYouTube && !hasStartedPlaying) pendingSeekRef.current = savedResumeTime;
    commitSeek(savedResumeTime);
    if (!hasStartedPlaying || !isPlaying) togglePlay();
    toast.success(`Resumed from ${formatTime(savedResumeTime)}`);
  };

  // ---------- Surface taps / clicks ----------
  // Mouse: click toggles play, double-click toggles fullscreen.
  // Touch: tap shows/hides controls; double-tap left/right seeks ±10s,
  // double-tap centre toggles play (YouTube-app behaviour).
  const lastTapRef = useRef<number>(0);
  const lastPointerTypeRef = useRef<string>("mouse");
  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      togglePlay();
      return;
    }
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const width = rect?.width || 1;
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (x < width * 0.35) skip(-10);
      else if (x > width * 0.65) skip(10);
      else togglePlay();
      return;
    }
    lastTapRef.current = now;
    if (showControls) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(false);
      setShowSpeedMenu(false);
      setShowQualityMenu(false);
    } else {
      resetControlsTimer();
    }
  };

  // ---------- Layout maths ----------
  const cw = containerSize.w || 1;
  const ch = containerSize.h || 1;
  const containerAspect = cw / ch;
  const fillScale = isAspectFill
    ? containerAspect > VIDEO_ASPECT
      ? containerAspect / VIDEO_ASPECT
      : VIDEO_ASPECT / containerAspect
    : 1;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const targetWidth = QUALITY_TARGET_WIDTH[selectedQuality];
  const renderScale =
    isYouTube && targetWidth && containerSize.w > 0
      ? Math.min(3, Math.max(0.25, targetWidth / (containerSize.w * dpr)))
      : 1;

  // YouTube draws its title bar, share/watch-later, "More videos", captions
  // and logo along the top and bottom edges of the iframe. The iframe is made
  // exactly as wide as the video and taller than it by YT_EDGE_PAD (its own
  // pixels) above and below: the video stays the same size and centred, and
  // YouTube's edge chrome lands in those extra bands, which sit outside the
  // visible video (cropped by the container or covered by the masks below).
  const videoW = Math.min(cw, ch * VIDEO_ASPECT); // fitted video, container px
  const videoH = videoW / VIDEO_ASPECT;
  const ytInnerW = videoW * renderScale;
  const ytInnerH = videoH * renderScale;
  const ytEdgePad = Math.max(160, ytInnerH * 0.25);
  const ytShownH = videoH * fillScale; // visible video height, container px
  const ytMaskH = Math.max(0, (ch - ytShownH) / 2);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const iconBtn =
    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer";
  const iconCls = "material-symbols-outlined text-[18px] sm:text-[20px]";
  const fade = `transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`;

  // YouTube videos: the plain YouTube player, untouched. The student's
  // watermark and the resume button sit below it, not on the video.
  if (isYouTube) {
    return (
      <div className={`w-full ${className}`}>
        <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
          <iframe
            id={ytPlayerElementId}
            ref={iframeRef}
            src={youtubeEmbedUrl}
            title={title || "Atomic Pathshala Player"}
            onLoad={() => {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: ytPlayerElementId }),
                  "*"
                );
              } catch {}
            }}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="mt-1.5 px-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
          <span className="font-mono truncate select-none">{activeWatermark}</span>
          {showResumeBanner && !isLive && (
            <span className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={applyResumeTime}
                className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Resume from {formatTime(savedResumeTime)}
              </button>
              <button
                type="button"
                onClick={() => setShowResumeBanner(false)}
                className="px-1.5 py-1 rounded-full text-slate-500 hover:text-slate-800 cursor-pointer"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") resetControlsTimer();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !menusOpen && !isScrubbing) setShowControls(false);
      }}
      className={`relative w-full aspect-video bg-black overflow-hidden group select-none flex items-center justify-center font-sans ${
        controlsVisible || !hasStartedPlaying ? "" : "cursor-none"
      } ${
        isFullscreen
          ? "!aspect-auto !w-screen !h-screen !rounded-none"
          : isPseudoFullscreen
          ? "!fixed !inset-0 !z-[200] !aspect-auto !w-screen !h-[100dvh] !rounded-none"
          : "rounded-2xl"
      } ${className}`}
    >
      {/* 1. VIDEO LAYER */}
      {isYouTube ? (
        <div className="absolute inset-0 overflow-hidden bg-black">
          <iframe
            id={ytPlayerElementId}
            ref={iframeRef}
            src={youtubeEmbedUrl}
            title={title || "Atomic Pathshala Player"}
            onLoad={() => {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: ytPlayerElementId }),
                  "*"
                );
              } catch {}
            }}
            // Untransformed until the first play so the student's first tap
            // lands on a plain iframe (transformed iframes have had touch
            // hit-testing bugs on mobile Safari).
            style={
              hasStartedPlaying
                ? {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${ytInnerW}px`,
                    height: `${ytInnerH + 2 * ytEdgePad}px`,
                    transform: `translate(-50%, -50%) scale(${fillScale / renderScale})`,
                  }
                : { position: "absolute", inset: 0, width: "100%", height: "100%" }
            }
            className={`max-w-none border-0 transition-transform duration-300 ${
              hasStartedPlaying ? "pointer-events-none" : "pointer-events-auto"
            }`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl || undefined}
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full ${isAspectFill ? "object-cover" : "object-contain"}`}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={markStarted}
          onPause={() => setIsPlaying(false)}
          onCanPlay={() => setIsBuffering(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              if (initialTime > 0) videoRef.current.currentTime = initialTime;
              videoRef.current.volume = isMuted ? 0 : volume;
              videoRef.current.muted = isMuted;
              videoRef.current.playbackRate = playbackSpeed;
            }
          }}
        />
      )}

      {/* 1.1 YouTube chrome cover. Paused or ended, YouTube draws its title,
          share button, logo and "More videos" over the frame — hide all of it
          behind the poster. Right after play/resume, veil just the top edge
          where the title flashes. Sits under the interaction surface and
          every control. */}
      {isYouTube && hasStartedPlaying && ytMaskH > 0 && (
        <>
          <div className="absolute top-0 left-0 right-0 z-[4] bg-black pointer-events-none" style={{ height: ytMaskH + 1 }} />
          <div className="absolute bottom-0 left-0 right-0 z-[4] bg-black pointer-events-none" style={{ height: ytMaskH + 1 }} />
        </>
      )}
      {isYouTube && hasStartedPlaying && !isPlaying && (
        <div className="absolute inset-0 z-[5] bg-black pointer-events-none overflow-hidden">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail
            <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          ) : null}
        </div>
      )}
      {isYouTube && hasStartedPlaying && isPlaying && ytTitleVeil && (
        <div className="absolute top-0 left-0 right-0 h-[22%] z-[5] bg-gradient-to-b from-black via-black/95 to-transparent pointer-events-none" />
      )}

      {/* 1.2 Interaction surface — above the video, below every control */}
      {hasStartedPlaying && (
        <div
          onPointerUp={handleSurfacePointerUp}
          onDoubleClick={(e) => {
            e.preventDefault();
            if (lastPointerTypeRef.current === "mouse") toggleFullscreen();
          }}
          className="absolute inset-0 z-10 bg-transparent"
        />
      )}

      {/* 1.5 PRE-PLAY POSTER — hides YouTube's own preview/branding. For
          YouTube it lets the tap through to the iframe (see above). */}
      {!hasStartedPlaying && (
        <div
          onClick={isYouTube ? undefined : togglePlay}
          className={`absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center select-none overflow-hidden ${
            isYouTube ? "pointer-events-none" : "cursor-pointer"
          }`}
        >
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail
            <img src={posterUrl} alt={title || "Lecture"} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl ml-0.5">play_arrow</span>
            </div>
            {title && (
              <h3 className="text-sm sm:text-lg font-bold text-white/95 line-clamp-2 max-w-lg drop-shadow">{title}</h3>
            )}
            {(subjectTitle || educatorName) && (
              <p className="text-[11px] sm:text-xs text-white/60">
                {[subjectTitle, educatorName].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. ANTI-PIRACY WATERMARK */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[15] overflow-hidden select-none">
        <div className="text-white/15 text-[10px] sm:text-xs font-mono tracking-wider font-semibold -rotate-12">
          {activeWatermark}
        </div>
      </div>

      {/* 3. BUFFERING SPINNER */}
      {isBuffering && hasStartedPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 rounded-full border-[3px] border-white/15 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* 4. MICRO-FEEDBACK */}
      {feedbackIcon && (
        <div
          key={feedbackIcon.key}
          className="absolute z-30 pointer-events-none flex flex-col items-center justify-center inset-0 m-auto animate-in zoom-in-75 fade-in duration-200"
        >
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">{feedbackIcon.icon}</span>
          </div>
          {feedbackIcon.text && (
            <span className="mt-1.5 text-[11px] font-bold text-white bg-black/40 px-2.5 py-0.5 rounded-full">
              {feedbackIcon.text}
            </span>
          )}
        </div>
      )}

      {/* 5. RESUME PROMPT */}
      {showResumeBanner && !isLive && (
        <div className="absolute bottom-3 sm:bottom-12 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md border border-white/10 pl-3 pr-1.5 py-1.5 rounded-full flex items-center gap-2 text-white text-[11px] sm:text-xs whitespace-nowrap">
          <span className="material-symbols-outlined text-base text-white/70">history</span>
          <span>Resume from {formatTime(savedResumeTime)}?</span>
          <button
            type="button"
            onClick={applyResumeTime}
            className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 font-bold hover:bg-white transition cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={() => setShowResumeBanner(false)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* 6. TOP BAR — back/close, title, branding (auto-hides) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-2 sm:px-3 pt-2 pb-6 bg-gradient-to-b from-black/50 to-transparent ${fade}`}
      >
        <button
          type="button"
          onClick={() => {
            if (isPseudoFullscreen) {
              setIsPseudoFullscreen(false);
              return;
            }
            if (onClose) onClose();
            else if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
          }}
          className={iconBtn}
          title="Back"
        >
          <span className={iconCls}>arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold text-white/90 truncate">{title}</p>
          {(subjectTitle || educatorName) && (
            <p className="text-[10px] text-white/55 truncate">{[subjectTitle, educatorName].filter(Boolean).join(" • ")}</p>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/brand/logo.png" alt="Atomic Pathshala" className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-60 shrink-0" />
      </div>

      {/* 7. CENTER CONTROLS — small and translucent */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center gap-8 sm:gap-14 pointer-events-none ${fade}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip(-10);
          }}
          className="pointer-events-auto w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/25 hover:bg-black/40 active:scale-90 text-white/85 flex items-center justify-center backdrop-blur-[2px] transition cursor-pointer"
          title="Rewind 10 seconds"
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl">replay_10</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="pointer-events-auto w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/25 hover:bg-black/40 active:scale-95 text-white/90 flex items-center justify-center backdrop-blur-[2px] transition cursor-pointer"
          title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl">{isPlaying ? "pause" : "play_arrow"}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip(10);
          }}
          className="pointer-events-auto w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/25 hover:bg-black/40 active:scale-90 text-white/85 flex items-center justify-center backdrop-blur-[2px] transition cursor-pointer"
          title="Forward 10 seconds"
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl">forward_10</span>
        </button>
      </div>

      {/* 8. BOTTOM CONTROL BAR */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 px-2 sm:px-3 pb-1 sm:pb-1.5 pt-6 bg-gradient-to-t from-black/60 to-transparent flex flex-col gap-0.5 ${fade}`}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {!isLive && (
          <div
            ref={progressBarRef}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              endScrub(e, timeFromClientX(e.clientX));
            }}
            onPointerCancel={(e) => endScrub(e, scrubTargetTimeRef.current)}
            onMouseLeave={() => !isScrubbing && setHoverTime(null)}
            className="relative w-full py-2 group/progress cursor-pointer flex items-center touch-none select-none"
          >
            <div className="w-full h-[3px] group-hover/progress:h-[5px] bg-white/25 rounded-full overflow-hidden relative transition-all duration-150">
              <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferPercent}%` }} />
              <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 group-hover/progress:w-3.5 group-hover/progress:h-3.5 bg-blue-500 rounded-full pointer-events-none transition-[width,height] ${
                isScrubbing ? "w-3.5 h-3.5" : ""
              }`}
              style={{ left: `${progressPercent}%` }}
            />
            {hoverTime !== null && (
              <div
                className="absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-1 text-white">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
            <button type="button" onClick={togglePlay} className={iconBtn} title={isPlaying ? "Pause" : "Play"}>
              <span className={iconCls}>{isPlaying ? "pause" : "play_arrow"}</span>
            </button>
            <div className="flex items-center group/volume">
              <button type="button" onClick={toggleMute} className={iconBtn} title={isMuted ? "Unmute" : "Mute"}>
                <span className={iconCls}>
                  {isMuted || volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}
                </span>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 focus:w-16 focus:opacity-100 h-1 accent-blue-500 cursor-pointer hidden sm:block transition-all duration-200"
                title="Volume"
              />
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-white/80 ml-1 whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu((prev) => !prev);
                  setShowQualityMenu(false);
                }}
                className={`${iconBtn} !w-auto px-1.5 text-[11px] font-bold ${showSpeedMenu ? "bg-white/15" : ""}`}
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-9 right-0 w-20 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-1 z-50 max-h-60 overflow-y-auto">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                        playbackSpeed === s ? "bg-white/20 text-white font-bold" : "text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((prev) => !prev);
                  setShowSpeedMenu(false);
                }}
                className={`${iconBtn} ${showQualityMenu ? "bg-white/15" : ""}`}
                title="Video Quality"
              >
                <span className={iconCls}>settings</span>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-9 right-0 w-24 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-1 z-50 max-h-60 overflow-y-auto">
                  {qualityOptions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQualityChange(q)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-between ${
                        selectedQuality === q ? "bg-white/20 text-white font-bold" : "text-white/75 hover:bg-white/10"
                      }`}
                    >
                      <span>{q}</span>
                      {(q === "1080p" || q === "1440p" || q === "4K (2160p)") && (
                        <span className="text-[8px] font-bold text-blue-300">HD</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleAspect}
              className={iconBtn}
              title={isAspectFill ? "Fit to screen" : "Fill screen"}
            >
              <span className={iconCls}>{isAspectFill ? "fit_screen" : "aspect_ratio"}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className={iconBtn}
              title={expanded ? "Exit Fullscreen" : "Fullscreen"}
            >
              <span className={iconCls}>{expanded ? "fullscreen_exit" : "fullscreen"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
