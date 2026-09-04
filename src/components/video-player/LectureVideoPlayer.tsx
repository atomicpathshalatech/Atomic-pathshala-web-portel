"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";

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
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onProgressPercentage?: (percent: number) => void;
  onBookmarkAdd?: (timestamp: number) => void;
  isCompleted?: boolean;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const QUALITY_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "1080p (FHD)", value: "1080p" },
  { label: "720p (HD)", value: "720p" },
  { label: "480p (SD)", value: "480p" },
  { label: "360p", value: "360p" },
  { label: "240p", value: "240p" },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LectureVideoPlayer({
  mode = "recorded",
  lectureId = "lecture",
  title,
  subtitle,
  subjectTitle,
  educatorName,
  videoUrl,
  posterUrl,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  onProgressPercentage,
  onBookmarkAdd,
  isCompleted = false,
  className = "",
}: LectureVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // UI / Controls State
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsView, setSettingsView] = useState<"main" | "speed" | "quality">("main");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Resume Banner State
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [savedResumeTime, setSavedResumeTime] = useState(0);

  // Micro-feedback animation state
  const [feedbackIcon, setFeedbackIcon] = useState<{
    icon: string;
    text?: string;
    side?: "center" | "left" | "right";
    key: number;
  } | null>(null);

  // Live state
  const isLive = mode === "live";
  const [isLiveEdge, setIsLiveEdge] = useState(true);

  // YouTube check
  const isYouTube = useMemo(() => {
    return (
      videoUrl.includes("youtube.com") ||
      videoUrl.includes("youtu.be") ||
      videoUrl.includes("youtube-nocookie.com")
    );
  }, [videoUrl]);

  const youtubeEmbedUrl = useMemo(() => {
    if (!isYouTube) return "";
    let vid = "";
    if (videoUrl.includes("embed/")) {
      vid = videoUrl.split("embed/")[1]?.split("?")[0] || "";
    } else if (videoUrl.includes("watch?v=")) {
      vid = videoUrl.split("watch?v=")[1]?.split("&")[0] || "";
    } else if (videoUrl.includes("youtu.be/")) {
      vid = videoUrl.split("youtu.be/")[1]?.split("?")[0] || "";
    }
    return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`;
  }, [isYouTube, videoUrl]);

  // Load stored preferences (volume, muted, speed)
  useEffect(() => {
    try {
      const storedVol = localStorage.getItem("atomic_player_volume");
      const storedMute = localStorage.getItem("atomic_player_muted");
      const storedSpeed = localStorage.getItem("atomic_playback_rate");

      if (storedVol !== null) {
        const v = parseFloat(storedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          setVolume(v);
          setPreviousVolume(v > 0 ? v : 1);
        }
      }
      if (storedMute === "true") {
        setIsMuted(true);
      }
      if (storedSpeed !== null) {
        const s = parseFloat(storedSpeed);
        if (SPEED_OPTIONS.includes(s)) {
          setPlaybackSpeed(s);
        }
      }
    } catch {}
  }, []);

  // Check saved resume position for recorded lectures
  useEffect(() => {
    if (isLive || !lectureId) return;
    try {
      const savedKey = `atomic_progress_${lectureId}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        const t = parseFloat(saved);
        if (t > 10 && (!initialTime || initialTime === 0)) {
          setSavedResumeTime(t);
          setShowResumeBanner(true);
        }
      }
    } catch {}
  }, [lectureId, isLive, initialTime]);

  // Show micro-feedback overlay animation
  const triggerFeedback = useCallback(
    (icon: string, text?: string, side: "center" | "left" | "right" = "center") => {
      setFeedbackIcon({ icon, text, side, key: Date.now() });
      setTimeout(() => {
        setFeedbackIcon((prev) => (prev?.text === text ? null : prev));
      }, 700);
    },
    []
  );

  // Auto-hide controls logic
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !showSettingsMenu && !isScrubbing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, showSettingsMenu, isScrubbing]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setHasEnded(false);
        triggerFeedback("play_arrow", "Play");
      }).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerFeedback("pause", "Pause");
    }
    resetControlsTimer();
  }, [triggerFeedback, resetControlsTimer]);

  // Seek Skip (10s)
  const skip = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const targetTime = Math.min(
        Math.max(0, videoRef.current.currentTime + seconds),
        duration || 999999
      );
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      triggerFeedback(
        seconds > 0 ? "forward_10" : "replay_10",
        seconds > 0 ? "+10s" : "-10s",
        seconds > 0 ? "right" : "left"
      );
      resetControlsTimer();
    },
    [duration, triggerFeedback, resetControlsTimer]
  );

  // Volume & Mute Handlers
  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (clamped > 0) setPreviousVolume(clamped);

    if (videoRef.current) {
      videoRef.current.volume = clamped;
      videoRef.current.muted = clamped === 0;
    }
    try {
      localStorage.setItem("atomic_player_volume", String(clamped));
      localStorage.setItem("atomic_player_muted", clamped === 0 ? "true" : "false");
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    if (isMuted || volume === 0) {
      const restored = previousVolume > 0 ? previousVolume : 1;
      setVolume(restored);
      setIsMuted(false);
      videoRef.current.muted = false;
      videoRef.current.volume = restored;
      triggerFeedback("volume_up", `${Math.round(restored * 100)}%`);
      try {
        localStorage.setItem("atomic_player_volume", String(restored));
        localStorage.setItem("atomic_player_muted", "false");
      } catch {}
    } else {
      setIsMuted(true);
      videoRef.current.muted = true;
      triggerFeedback("volume_off", "Muted");
      try {
        localStorage.setItem("atomic_player_muted", "true");
      } catch {}
    }
    resetControlsTimer();
  }, [isMuted, volume, previousVolume, triggerFeedback, resetControlsTimer]);

  // Speed Change Handler
  const handleSpeedChange = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      try {
        localStorage.setItem("atomic_playback_rate", String(speed));
      } catch {}
      triggerFeedback("speed", `${speed}x`);
      setShowSettingsMenu(false);
      setSettingsView("main");
      resetControlsTimer();
    },
    [triggerFeedback, resetControlsTimer]
  );

  // Quality Change Handler
  const handleQualityChange = useCallback(
    (q: string) => {
      setSelectedQuality(q);
      triggerFeedback("high_quality", q === "auto" ? "Quality: Auto" : `Quality: ${q}`);
      setShowSettingsMenu(false);
      setSettingsView("main");
      resetControlsTimer();
    },
    [triggerFeedback, resetControlsTimer]
  );

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Picture in Picture Handler
  const togglePip = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch {
      toast.error("Picture-in-Picture is not supported or was blocked.");
    }
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused =
        activeTag === "input" ||
        activeTag === "textarea" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (isInputFocused) return;

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
        case "p":
          e.preventDefault();
          togglePip();
          break;
        case "arrowleft":
          e.preventDefault();
          skip(e.shiftKey ? -10 : -5);
          break;
        case "arrowright":
          e.preventDefault();
          skip(e.shiftKey ? 10 : 5);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          break;
        case ">":
          if (e.shiftKey) {
            e.preventDefault();
            const currIdx = SPEED_OPTIONS.indexOf(playbackSpeed);
            if (currIdx < SPEED_OPTIONS.length - 1) {
              const nextSpeed = SPEED_OPTIONS[currIdx + 1];
              if (nextSpeed !== undefined) handleSpeedChange(nextSpeed);
            }
          }
          break;
        case "<":
          if (e.shiftKey) {
            e.preventDefault();
            const currIdx = SPEED_OPTIONS.indexOf(playbackSpeed);
            if (currIdx > 0) {
              const prevSpeed = SPEED_OPTIONS[currIdx - 1];
              if (prevSpeed !== undefined) handleSpeedChange(prevSpeed);
            }
          }
          break;
        case "1":
          if (!e.shiftKey && !e.ctrlKey) {
            handleSpeedChange(1);
          }
          break;
        default:
          if (!isLive && /^[0-9]$/.test(e.key) && duration > 0) {
            e.preventDefault();
            const fraction = parseInt(e.key, 10) / 10;
            const target = fraction * duration;
            if (videoRef.current) {
              videoRef.current.currentTime = target;
              setCurrentTime(target);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    toggleMute,
    toggleFullscreen,
    togglePip,
    skip,
    handleVolumeChange,
    handleSpeedChange,
    volume,
    playbackSpeed,
    duration,
    isLive,
  ]);

  // Video Events
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    if (dur > 0) setDuration(dur);

    // Track buffer ranges
    if (videoRef.current.buffered.length > 0) {
      try {
        const bufferedTime = videoRef.current.buffered.end(
          videoRef.current.buffered.length - 1
        );
        setBufferedEnd(bufferedTime);
      } catch {}
    }

    if (onTimeUpdate) onTimeUpdate(cur, dur);

    // Progress percentage & complete trigger
    if (dur > 0) {
      const pct = Math.floor((cur / dur) * 100);
      if (onProgressPercentage) onProgressPercentage(pct);

      // Debounced progress saving to localStorage
      if (!isLive && lectureId) {
        if (progressSaveTimeoutRef.current) {
          clearTimeout(progressSaveTimeoutRef.current);
        }
        progressSaveTimeoutRef.current = setTimeout(() => {
          try {
            localStorage.setItem(`atomic_progress_${lectureId}`, String(cur));
          } catch {}
        }, 3000);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setHasEnded(true);
    setShowControls(true);
    if (onEnded) onEnded();
  };

  // Progress Bar Scrubbing
  const calculateScrubPosition = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = "touches" in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent<HTMLDivElement>).clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    setIsScrubbing(true);
    const target = calculateScrubPosition(e);
    videoRef.current.currentTime = target;
    setCurrentTime(target);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!progressBarRef.current || !videoRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const t = pos * duration;
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Resume Video Action
  const applyResumeTime = () => {
    if (!videoRef.current || savedResumeTime <= 0) return;
    videoRef.current.currentTime = savedResumeTime;
    setCurrentTime(savedResumeTime);
    setShowResumeBanner(false);
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    toast.success(`Resumed from ${formatTime(savedResumeTime)}`);
  };

  const dismissResumeBanner = () => {
    setShowResumeBanner(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Double Tap for Mobile
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const tapX = touch.clientX - rect.left;
    const isDoubleTap = now - lastTapRef.current.time < 300;

    if (isDoubleTap) {
      if (tapX < rect.width * 0.4) {
        skip(-10);
      } else if (tapX > rect.width * 0.6) {
        skip(10);
      } else {
        togglePlay();
      }
    } else {
      setShowControls((prev) => !prev);
      resetControlsTimer();
    }
    lastTapRef.current = { time: now, x: tapX };
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group select-none flex items-center justify-center font-sans ${className}`}
    >
      {/* ----------------- VIDEO ELEMENT OR YOUTUBE EMBED ----------------- */}
      {isYouTube ? (
        <div className="w-full h-full relative">
          <iframe
            src={youtubeEmbedUrl}
            title={title}
            className="w-full h-full border-0 pointer-events-auto"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl || undefined}
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onCanPlay={() => setIsBuffering(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              if (initialTime > 0) {
                videoRef.current.currentTime = initialTime;
              }
              videoRef.current.volume = isMuted ? 0 : volume;
              videoRef.current.playbackRate = playbackSpeed;
            }
          }}
        />
      )}

      {/* ----------------- BUFFERING SPINNER ----------------- */}
      {isBuffering && !isYouTube && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-20">
          <div className="w-14 h-14 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
          <span className="text-xs font-semibold text-white/90 mt-3 tracking-wide drop-shadow">
            Buffering Lecture...
          </span>
        </div>
      )}

      {/* ----------------- MICRO-FEEDBACK ANIMATION ----------------- */}
      {feedbackIcon && (
        <div
          key={feedbackIcon.key}
          className={`absolute z-30 pointer-events-none flex flex-col items-center justify-center animate-in zoom-in-75 fade-in duration-200 ${
            feedbackIcon.side === "left"
              ? "left-12 top-1/2 -translate-y-1/2"
              : feedbackIcon.side === "right"
              ? "right-12 top-1/2 -translate-y-1/2"
              : "inset-0 m-auto"
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl">
            <span className="material-symbols-outlined text-3xl text-orange-400">
              {feedbackIcon.icon}
            </span>
          </div>
          {feedbackIcon.text && (
            <span className="mt-2 text-xs font-bold text-white bg-black/80 px-3 py-1 rounded-full border border-white/10 shadow">
              {feedbackIcon.text}
            </span>
          )}
        </div>
      )}

      {/* ----------------- RESUME PROMPT BANNER ----------------- */}
      {showResumeBanner && !isLive && (
        <div className="absolute top-4 left-4 right-4 z-40 bg-slate-900/95 backdrop-blur-md border border-orange-500/50 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">history</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Resume playback from {formatTime(savedResumeTime)}?
              </p>
              <p className="text-[10px] text-slate-400">
                You previously watched this lecture up to this position.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={applyResumeTime}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={dismissResumeBanner}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TOP INFO BAR OVERLAY ----------------- */}
      {!isYouTube && (
        <div
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none z-20 flex items-center justify-between ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="min-w-0 max-w-xl">
            {subjectTitle && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                {subjectTitle}
              </span>
            )}
            <h2 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow">
              {title}
            </h2>
            {educatorName && (
              <p className="text-[11px] text-slate-300 font-medium truncate">
                By {educatorName}
              </p>
            )}
          </div>

          {isLive && (
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                LIVE
              </span>
            </div>
          )}
        </div>
      )}

      {/* ----------------- CUSTOM BOTTOM CONTROL BAR ----------------- */}
      {!isYouTube && (
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 pointer-events-auto flex flex-col gap-2 ${
            showControls || !isPlaying || showSettingsMenu ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress / Seek Timeline Bar */}
          {!isLive && (
            <div
              ref={progressBarRef}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
              onMouseDown={handleProgressMouseDown}
              className="relative w-full h-3 group/progress cursor-pointer flex items-center"
            >
              {/* Background Track */}
              <div className="w-full h-1.5 group-hover/progress:h-2.5 bg-white/20 rounded-full overflow-hidden relative transition-all duration-150">
                {/* Buffer Loaded Bar */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-white/30 rounded-full transition-all duration-200"
                  style={{ width: `${bufferPercent}%` }}
                />
                {/* Played Progress Bar */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Progress Thumb Knob */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 group-hover/progress:w-4 group-hover/progress:h-4 bg-white rounded-full shadow-lg border-2 border-orange-500 scale-0 group-hover/progress:scale-100 transition-transform duration-150 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Hover Timestamp Preview Tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 text-white text-[10px] font-mono font-bold border border-white/20 shadow-xl pointer-events-none"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>
          )}

          {/* Bottom Controls Row */}
          <div className="flex items-center justify-between gap-2 text-white">
            {/* Left Controls: Play/Pause, 10s skips, Timers */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all text-white focus:outline-none cursor-pointer"
                title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
              >
                <span className="material-symbols-outlined text-2xl">
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>

              {/* 10s Replay / Forward Buttons */}
              {!isLive && (
                <>
                  <button
                    type="button"
                    onClick={() => skip(-10)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-slate-200 hover:text-white cursor-pointer"
                    title="Rewind 10 seconds (←)"
                  >
                    <span className="material-symbols-outlined text-xl">replay_10</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => skip(10)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-slate-200 hover:text-white cursor-pointer"
                    title="Forward 10 seconds (→)"
                  >
                    <span className="material-symbols-outlined text-xl">forward_10</span>
                  </button>
                </>
              )}

              {/* Volume & Slider */}
              <div className="flex items-center gap-1 group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 transition-all text-slate-200 hover:text-white cursor-pointer"
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
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
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-14 sm:w-20 h-1.5 bg-white/30 rounded-full appearance-none accent-orange-500 cursor-pointer hidden sm:block opacity-80 group-hover/volume:opacity-100 transition"
                  title="Volume (↑ / ↓)"
                />
              </div>

              {/* Time Indicators */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono font-semibold text-slate-300 select-none">
                {isLive ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = videoRef.current.duration;
                        setIsLiveEdge(true);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      isLiveEdge
                        ? "bg-rose-600/30 text-rose-400 border border-rose-500/40"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>{isLiveEdge ? "LIVE" : "GO LIVE"}</span>
                  </button>
                ) : (
                  <>
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-slate-500">/</span>
                    <span>{formatTime(duration)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right Controls: Bookmark, Speed, Quality/Settings, PiP, Fullscreen */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Add Bookmark button if callback provided */}
              {onBookmarkAdd && !isLive && (
                <button
                  type="button"
                  onClick={() => onBookmarkAdd(currentTime)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 text-slate-200 hover:text-white transition cursor-pointer"
                  title="Add Bookmark at current timestamp"
                >
                  <span className="material-symbols-outlined text-lg">bookmark_add</span>
                </button>
              )}

              {/* Playback Speed Pill Button */}
              {!isLive && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsView("speed");
                    setShowSettingsMenu((prev) => !prev);
                  }}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold font-mono transition text-slate-200 hover:text-white cursor-pointer"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>
              )}

              {/* Settings Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsView("main");
                    setShowSettingsMenu((prev) => !prev);
                  }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 transition cursor-pointer ${
                    showSettingsMenu ? "bg-white/20 text-orange-400" : "text-slate-200 hover:text-white"
                  }`}
                  title="Settings (Speed & Quality)"
                >
                  <span className="material-symbols-outlined text-xl">settings</span>
                </button>

                {/* Popover Settings Menu */}
                {showSettingsMenu && (
                  <div className="absolute bottom-11 right-0 w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Main Settings Menu View */}
                    {settingsView === "main" && (
                      <div className="space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          Player Settings
                        </div>
                        {!isLive && (
                          <button
                            type="button"
                            onClick={() => setSettingsView("speed")}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-base text-orange-400">speed</span>
                              Playback Speed
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">{playbackSpeed}x &rsaquo;</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSettingsView("quality")}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-indigo-400">high_quality</span>
                            Quality
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {selectedQuality === "auto" ? "Auto" : selectedQuality} &rsaquo;
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Speed Submenu View */}
                    {settingsView === "speed" && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSettingsView("main")}
                          className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-400 hover:text-white border-b border-slate-800 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          <span>Playback Speed</span>
                        </button>
                        <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                          {SPEED_OPTIONS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSpeedChange(s)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                                playbackSpeed === s
                                  ? "bg-orange-500/20 text-orange-400 font-bold"
                                  : "text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              <span>{s === 1 ? "1x (Normal)" : `${s}x`}</span>
                              {playbackSpeed === s && (
                                <span className="material-symbols-outlined text-sm">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quality Submenu View */}
                    {settingsView === "quality" && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSettingsView("main")}
                          className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-400 hover:text-white border-b border-slate-800 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          <span>Quality</span>
                        </button>
                        <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                          {QUALITY_OPTIONS.map((q) => (
                            <button
                              key={q.value}
                              type="button"
                              onClick={() => handleQualityChange(q.value)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                                selectedQuality === q.value
                                  ? "bg-indigo-500/20 text-indigo-400 font-bold"
                                  : "text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              <span>{q.label}</span>
                              {selectedQuality === q.value && (
                                <span className="material-symbols-outlined text-sm">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Picture in Picture */}
              {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
                <button
                  type="button"
                  onClick={togglePip}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 text-slate-200 hover:text-white transition cursor-pointer"
                  title="Picture in Picture (P)"
                >
                  <span className="material-symbols-outlined text-xl">
                    {isPipActive ? "pip_exit" : "picture_in_picture_alt"}
                  </span>
                </button>
              )}

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 text-slate-200 hover:text-white transition cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen (F / Esc)" : "Fullscreen (F)"}
              >
                <span className="material-symbols-outlined text-xl">
                  {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
