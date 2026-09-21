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
  onEnded?: () => void;
  onProgressPercentage?: (percent: number) => void;
  onBookmarkAdd?: (timestamp: number) => void;
  isCompleted?: boolean;
  className?: string;
}

// Exactly matching user Screenshot 2
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0] as const;

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
  return null;
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
  watermarkText,
  onClose,
  onTimeUpdate,
  onEnded,
  onProgressPercentage,
  onBookmarkAdd,
  isCompleted = false,
  className = "",
}: LectureVideoPlayerProps) {
  const { data: session } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ytPlayerRef = useRef<any>(null);

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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<string>("1080p");
  const [qualityOptions, setQualityOptions] = useState<string[]>([
    "1080p",
    "720p",
    "480p",
    "360p",
    "240p",
    "144p",
    "Auto",
  ]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAspectFill, setIsAspectFill] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Popups State (matching Screenshots 2 & 3)
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
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
    key: number;
  } | null>(null);

  // Live state
  const isLive = mode === "live";

  // Check if YouTube
  const youtubeVideoId = useMemo(() => extractYouTubeVideoId(videoUrl), [videoUrl]);
  const isYouTube = Boolean(youtubeVideoId);
  const ytPlayerElementId = useMemo(
    () => "atomic-yt-" + Math.random().toString(36).substring(2, 9),
    []
  );

  // Headless YouTube embed url (controls=0 completely removes YouTube player UI)
  const youtubeHeadlessEmbedUrl = useMemo(() => {
    if (!youtubeVideoId) return "";
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    return `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&controls=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&showinfo=0&autoplay=0&vq=hd1080${originParam}`;
  }, [youtubeVideoId]);

  // Student Watermark text (Screenshot 1: e.g. firozali78644@gmail.com 8958900405)
  const activeWatermark = useMemo(() => {
    if (watermarkText) return watermarkText;
    const email = session?.user?.email || "";
    const phone = (session?.user as any)?.phone || (session?.user as any)?.mobile || "";
    if (email && phone) return `${email} ${phone}`;
    if (email) return email;
    if (session?.user?.name) return `${session.user.name} (Atomic Pathshala)`;
    return "Atomic Pathshala Verified Student";
  }, [watermarkText, session]);

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
      if (storedMute === "true") {
        setIsMuted(true);
      }
      if (storedSpeed !== null) {
        const s = parseFloat(storedSpeed);
        if ((SPEED_OPTIONS as readonly number[]).includes(s)) {
          setPlaybackSpeed(s);
        }
      }
      if (storedQuality) {
        setSelectedQuality(storedQuality);
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
        if (t > 15 && (!initialTime || initialTime === 0)) {
          setSavedResumeTime(t);
          setShowResumeBanner(true);
        }
      }
    } catch {}
  }, [lectureId, isLive, initialTime]);

  // Trigger brief micro-feedback icon in center
  const triggerFeedback = useCallback((icon: string, text?: string) => {
    setFeedbackIcon({ icon, text, key: Date.now() });
    setTimeout(() => {
      setFeedbackIcon((prev) => (prev?.text === text ? null : prev));
    }, 600);
  }, []);

  // Auto-hide controls logic
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !showSpeedMenu && !showQualityMenu && !isScrubbing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, showSpeedMenu, showQualityMenu, isScrubbing]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  // Helper to dispatch command to YouTube (via YT.Player instance and postMessage fallback)
  const sendYouTubeCommand = useCallback(
    (func: string, args: any[] = []) => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current[func] === "function") {
        try {
          ytPlayerRef.current[func](...args);
        } catch {}
      }
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "*"
          );
        } catch {}
      }
    },
    []
  );

  // Helper to dynamically update available qualities from YouTube
  const updateAvailableQualities = useCallback((levels: string[]) => {
    if (!Array.isArray(levels) || levels.length === 0) return;
    const order = ["4K (2160p)", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];
    const detected = new Set<string>();
    for (const lvl of levels) {
      const mapped = YT_LEVEL_TO_LABEL[lvl];
      if (mapped && mapped !== "Auto") detected.add(mapped);
    }
    const filtered = order.filter((label) => detected.has(label));
    // If YouTube hasn't finished HD processing yet, keep 1080p selectable so user can request HD
    if (!filtered.includes("1080p") && !filtered.includes("1440p") && !filtered.includes("4K (2160p)")) {
      filtered.unshift("1080p");
    }
    filtered.push("Auto");
    if (filtered.length > 0) {
      setQualityOptions(filtered);
    }
  }, []);

  // Initialize YouTube Iframe API if YouTube URL
  useEffect(() => {
    if (!isYouTube || !youtubeVideoId) return;
    let cancelled = false;

    function initYt() {
      if (cancelled) return;
      if (!(window as any).YT || !(window as any).YT.Player) {
        return;
      }
      try {
        const targetEl = document.getElementById(ytPlayerElementId) || iframeRef.current;
        if (!targetEl) return;

        const player = new (window as any).YT.Player(targetEl, {
          events: {
            onReady: (e: any) => {
              ytPlayerRef.current = e.target;
              try {
                const dur = e.target.getDuration() || 0;
                if (dur > 0) setDuration(dur);
                e.target.setPlaybackRate(playbackSpeed);
                e.target.setVolume(isMuted ? 0 : volume * 100);
                if (initialTime > 0) {
                  e.target.seekTo(initialTime, true);
                }
                const targetYtQ = YT_QUALITY_MAP[selectedQuality] || "hd1080";
                e.target.setPlaybackQuality(targetYtQ);
                if (typeof e.target.setPlaybackQualityRange === "function") {
                  e.target.setPlaybackQualityRange(targetYtQ, targetYtQ);
                }
                if (typeof e.target.getAvailableQualityLevels === "function") {
                  const levels = e.target.getAvailableQualityLevels();
                  if (Array.isArray(levels) && levels.length > 0) {
                    updateAvailableQualities(levels);
                  }
                }
              } catch {}
            },
            onStateChange: (e: any) => {
              // 1: PLAYING, 2: PAUSED, 3: BUFFERING, 0: ENDED
              if (e.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
                setHasEnded(false);
              } else if (e.data === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (e.data === 3) {
                setIsBuffering(true);
              } else if (e.data === 0) {
                setIsPlaying(false);
                setHasEnded(true);
                if (onEnded) onEnded();
              }
            },
          },
        });
        ytPlayerRef.current = player;
      } catch (err) {
        console.debug("[LectureVideoPlayer] YT.Player init:", err);
      }
    }

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

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
    };
  }, [isYouTube, youtubeVideoId, ytPlayerElementId, initialTime, isMuted, volume, playbackSpeed, onEnded]);

  // Direct window postMessage listener for YouTube events (infoDelivery & onStateChange)
  useEffect(() => {
    if (!isYouTube) return;

    const handleWindowMessage = (e: MessageEvent) => {
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
          if (typeof info.currentTime === "number" && !isScrubbing) {
            setCurrentTime(info.currentTime);
          }
          if (typeof info.duration === "number" && info.duration > 0) {
            setDuration(info.duration);
          }
          if (typeof info.videoLoadedFraction === "number") {
            setBufferedEnd((prev) => info.videoLoadedFraction * (info.duration || prev || 0));
          }
          if (Array.isArray(info.availableQualityLevels) && info.availableQualityLevels.length > 0) {
            updateAvailableQualities(info.availableQualityLevels);
          }
          if (typeof info.playerState === "number") {
            if (info.playerState === 1) {
              setIsPlaying(true);
              setIsBuffering(false);
              setHasEnded(false);
            } else if (info.playerState === 2) {
              setIsPlaying(false);
              setIsBuffering(false);
            } else if (info.playerState === 3) {
              setIsBuffering(true);
            } else if (info.playerState === 0) {
              setIsPlaying(false);
              setHasEnded(true);
              if (onEnded) onEnded();
            }
          }
        } else if (msg.event === "onStateChange") {
          if (msg.info === 1) {
            setIsPlaying(true);
            setIsBuffering(false);
            setHasEnded(false);
          } else if (msg.info === 2) {
            setIsPlaying(false);
            setIsBuffering(false);
          } else if (msg.info === 3) {
            setIsBuffering(true);
          } else if (msg.info === 0) {
            setIsPlaying(false);
            setHasEnded(true);
            if (onEnded) onEnded();
          }
        }
      } catch {}
    };

    window.addEventListener("message", handleWindowMessage);
    return () => {
      window.removeEventListener("message", handleWindowMessage);
    };
  }, [isYouTube, isScrubbing, onEnded]);

  // Robust YouTube progress ticker: combines API calls with continuous smooth time advancement
  const lastTickTimeRef = useRef<number>(Date.now());
  const lastReportedTimeRef = useRef<number>(-1);

  useEffect(() => {
    if (!isYouTube) return;
    lastTickTimeRef.current = Date.now();

    const pollInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      // 1. Keep-alive ping to YouTube iframe
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
            "*"
          );
        } catch {}
      }

      // 2. Read state from YT.Player instance if available
      let reportedTime: number | null = null;
      let reportedDur: number | null = null;
      let loadedFraction: number | null = null;

      if (ytPlayerRef.current) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime?.();
          if (typeof cur === "number" && !isNaN(cur) && cur >= 0) {
            reportedTime = cur;
          }
          const dur = ytPlayerRef.current.getDuration?.();
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
            reportedDur = dur;
          }
          const frac = ytPlayerRef.current.getVideoLoadedFraction?.();
          if (typeof frac === "number" && !isNaN(frac)) {
            loadedFraction = frac;
          }
        } catch {}
      }

      if (reportedDur && reportedDur > 0) {
        setDuration(reportedDur);
      }
      const activeDur = reportedDur || duration;
      if (loadedFraction !== null && activeDur > 0) {
        setBufferedEnd(loadedFraction * activeDur);
      }

      // 3. Update current time & scrub progress bar
      if (!isScrubbing) {
        if (isPlaying) {
          // If reported time has changed noticeably from last time (user sought or fresh frame from YT)
          if (
            reportedTime !== null &&
            reportedTime > 0 &&
            Math.abs(reportedTime - lastReportedTimeRef.current) > 1.2
          ) {
            lastReportedTimeRef.current = reportedTime;
            setCurrentTime(reportedTime);
            if (onTimeUpdate) onTimeUpdate(reportedTime, activeDur);
            if (activeDur > 0 && onProgressPercentage) {
              onProgressPercentage(Math.floor((reportedTime / activeDur) * 100));
            }
          } else {
            // Smoothly advance time locally at high resolution
            setCurrentTime((prev) => {
              const base = (reportedTime !== null && reportedTime > prev) ? reportedTime : prev;
              const next = base + elapsed * playbackSpeed;
              const clamped = activeDur > 0 ? Math.min(next, activeDur) : next;
              if (onTimeUpdate) onTimeUpdate(clamped, activeDur);
              if (activeDur > 0 && onProgressPercentage) {
                onProgressPercentage(Math.floor((clamped / activeDur) * 100));
              }
              return clamped;
            });
          }
        } else if (reportedTime !== null && reportedTime > 0) {
          // When paused, strictly sync to the reported frame
          lastReportedTimeRef.current = reportedTime;
          setCurrentTime(reportedTime);
        }
      }
    }, 100);

    return () => clearInterval(pollInterval);
  }, [isYouTube, isPlaying, isScrubbing, duration, playbackSpeed, onTimeUpdate, onProgressPercentage]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (isYouTube) {
      if (isPlaying) {
        sendYouTubeCommand("pauseVideo");
        setIsPlaying(false);
      } else {
        sendYouTubeCommand("playVideo");
        setIsPlaying(true);
        setHasEnded(false);
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setHasEnded(false);
          })
          .catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
    resetControlsTimer();
  }, [isYouTube, isPlaying, sendYouTubeCommand, resetControlsTimer]);

  // Seek Skip (+10s or -10s)
  const skip = useCallback(
    (seconds: number) => {
      const targetTime = Math.min(Math.max(0, currentTime + seconds), duration || 999999);
      if (isYouTube) {
        sendYouTubeCommand("seekTo", [targetTime, true]);
        setCurrentTime(targetTime);
      } else if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
      }
      triggerFeedback(
        seconds > 0 ? "forward_10" : "replay_10",
        seconds > 0 ? "+10s" : "-10s"
      );
      resetControlsTimer();
    },
    [currentTime, duration, isYouTube, sendYouTubeCommand, triggerFeedback, resetControlsTimer]
  );

  // Volume & Mute Handlers
  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(1, newVol));
      setVolume(clamped);
      setIsMuted(clamped === 0);
      if (clamped > 0) setPreviousVolume(clamped);

      if (isYouTube) {
        sendYouTubeCommand("setVolume", [clamped * 100]);
        if (clamped === 0) sendYouTubeCommand("mute");
        else sendYouTubeCommand("unMute");
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
      if (isYouTube) {
        sendYouTubeCommand("mute");
      } else if (videoRef.current) {
        videoRef.current.muted = true;
      }
      triggerFeedback("volume_off", "Muted");
    }
    resetControlsTimer();
  }, [isMuted, volume, previousVolume, isYouTube, sendYouTubeCommand, triggerFeedback, resetControlsTimer]);

  // Speed Change Handler (matching Screenshot 2: 0.5x to 4.0x)
  const handleSpeedChange = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      if (isYouTube) {
        sendYouTubeCommand("setPlaybackRate", [speed]);
      } else if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      try {
        localStorage.setItem("atomic_playback_rate", String(speed));
      } catch {}
      triggerFeedback("speed", `${speed}x`);
      setShowSpeedMenu(false);
      resetControlsTimer();
    },
    [isYouTube, sendYouTubeCommand, triggerFeedback, resetControlsTimer]
  );

  // Quality Change Handler (supporting 4K, 1440p, 1080p, 720p, 480p, 360p, 240p, 144p, Auto)
  const handleQualityChange = useCallback(
    (q: string) => {
      setSelectedQuality(q);
      try {
        localStorage.setItem("atomic_player_quality", q);
      } catch {}

      if (isYouTube) {
        const ytQ = YT_QUALITY_MAP[q] || "default";
        sendYouTubeCommand("setPlaybackQuality", [ytQ]);
        sendYouTubeCommand("setPlaybackQualityRange", [ytQ, ytQ]);
      }
      triggerFeedback("high_quality", `${q}`);
      setShowQualityMenu(false);
      resetControlsTimer();
    },
    [isYouTube, sendYouTubeCommand, triggerFeedback, resetControlsTimer]
  );

  // Screen Rotation / Aspect Ratio Handler
  const handleRotateOrAspect = useCallback(async () => {
    // 1. Attempt mobile screen orientation lock
    if (typeof window !== "undefined" && "screen" in window && "orientation" in window.screen) {
      try {
        const orientation = window.screen.orientation;
        if (orientation && "lock" in orientation) {
          if (!document.fullscreenElement && containerRef.current) {
            await containerRef.current.requestFullscreen().catch(() => {});
          }
          await (orientation.lock as any)("landscape").catch(() => {});
        }
      } catch {}
    }
    // 2. Toggle aspect fill/contain
    setIsAspectFill((prev) => !prev);
    triggerFeedback("aspect_ratio", isAspectFill ? "Aspect: Fit" : "Aspect: Fill");
    resetControlsTimer();
  }, [isAspectFill, triggerFeedback, resetControlsTimer]);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        // Lock landscape on mobile when entering fullscreen
        if (screen.orientation && "lock" in screen.orientation) {
          await (screen.orientation as any).lock("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        if (screen.orientation && "unlock" in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      }
    } catch {
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
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
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, skip, handleVolumeChange, volume]);

  // Video Events (HTML5 video fallback)
  const handleTimeUpdate = () => {
    if (!videoRef.current || isYouTube) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    if (!isScrubbing) {
      setCurrentTime(cur);
    }
    if (dur > 0) setDuration(dur);

    if (videoRef.current.buffered.length > 0) {
      try {
        const bufferedTime = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedEnd(bufferedTime);
      } catch {}
    }

    if (onTimeUpdate) onTimeUpdate(cur, dur);

    if (dur > 0) {
      const pct = Math.floor((cur / dur) * 100);
      if (onProgressPercentage) onProgressPercentage(pct);

      if (!isLive && lectureId) {
        if (progressSaveTimeoutRef.current) clearTimeout(progressSaveTimeoutRef.current);
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
  const calculateScrubPosition = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX =
      "touches" in e && e.touches[0]
        ? e.touches[0].clientX
        : (e as React.MouseEvent<HTMLDivElement>).clientX;
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
    if (duration <= 0) return;
    setIsScrubbing(true);
    const target = calculateScrubPosition(e);
    setCurrentTime(target);

    if (isYouTube) {
      sendYouTubeCommand("seekTo", [target, true]);
    } else if (videoRef.current) {
      videoRef.current.currentTime = target;
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const t = pos * duration;
      setCurrentTime(t);
      if (isYouTube) {
        sendYouTubeCommand("seekTo", [t, true]);
      } else if (videoRef.current) {
        videoRef.current.currentTime = t;
      }
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
    if (savedResumeTime <= 0) return;
    setCurrentTime(savedResumeTime);
    if (isYouTube) {
      sendYouTubeCommand("seekTo", [savedResumeTime, true]);
      sendYouTubeCommand("playVideo");
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = savedResumeTime;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    setShowResumeBanner(false);
    toast.success(`Resumed from ${formatTime(savedResumeTime)}`);
  };

  const dismissResumeBanner = () => {
    setShowResumeBanner(false);
    setCurrentTime(0);
    if (isYouTube) {
      sendYouTubeCommand("seekTo", [0, true]);
      sendYouTubeCommand("playVideo");
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
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
      if (tapX < rect.width * 0.35) {
        skip(-10);
      } else if (tapX > rect.width * 0.65) {
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
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group select-none flex items-center justify-center font-sans ${
        isFullscreen ? "!rounded-none !aspect-auto !w-screen !h-screen" : ""
      } ${className}`}
    >
      {/* ----------------- 1. VIDEO LAYER (HEADLESS YOUTUBE OR HTML5 VIDEO) ----------------- */}
      {isYouTube ? (
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
          <iframe
            id={ytPlayerElementId}
            ref={iframeRef}
            src={youtubeHeadlessEmbedUrl}
            title="Atomic Pathshala Player"
            onLoad={() => {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: ytPlayerElementId }),
                  "*"
                );
              } catch {}
            }}
            className={`w-[102%] h-[124%] max-w-none border-0 pointer-events-none transition-transform duration-300 ${
              isAspectFill ? "scale-[1.25]" : "scale-[1.12]"
            }`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
          {/* Interaction transparent shield: intercepts user clicks/taps directly to our custom handler */}
          <div
            onClick={togglePlay}
            className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl || undefined}
          playsInline
          className={`w-full h-full cursor-pointer transition-transform duration-300 ${
            isAspectFill ? "object-cover" : "object-contain"
          }`}
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

      {/* ----------------- 2. FLOATING STUDENT ANTI-PIRACY WATERMARK ----------------- */}
      {/* Drifting subtly across center matching user screenshot */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-15 overflow-hidden select-none">
        <div className="text-white/20 text-xs sm:text-sm font-mono tracking-wider font-semibold pointer-events-none transform -rotate-12 transition-transform duration-1000">
          {activeWatermark}
        </div>
      </div>

      {/* ----------------- 3. BUFFERING SPINNER ----------------- */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <span className="text-xs font-semibold text-white/90 mt-2 tracking-wide drop-shadow">
            Buffering...
          </span>
        </div>
      )}

      {/* ----------------- 4. MICRO-FEEDBACK ANIMATION ----------------- */}
      {feedbackIcon && (
        <div
          key={feedbackIcon.key}
          className="absolute z-30 pointer-events-none flex flex-col items-center justify-center inset-0 m-auto animate-in zoom-in-75 fade-in duration-200"
        >
          <div className="w-16 h-16 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl">
            <span className="material-symbols-outlined text-3xl text-blue-400">
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

      {/* ----------------- 5. RESUME PROMPT BANNER ----------------- */}
      {showResumeBanner && !isLive && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-slate-900/95 backdrop-blur-md border border-blue-500/50 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
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
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
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

      {/* ----------------- 6. PERMANENT BRANDING (Logo + Atomic Pathshala - Always Visible) ----------------- */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-30 pointer-events-none select-none flex items-center gap-2.5">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shrink-0 shadow-md">
          <img
            src="/brand/logo.png"
            alt="Atomic Pathshala"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide drop-shadow leading-tight block">
            Atomic Pathshala
          </span>
          {subjectTitle ? (
            <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium truncate leading-tight">
              {subjectTitle} {educatorName ? `• ${educatorName}` : ""}
            </p>
          ) : educatorName ? (
            <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium truncate leading-tight">
              {educatorName}
            </p>
          ) : null}
        </div>
      </div>

      {/* Top Header Bar Gradient & Close Button (Fades with controls) */}
      <div
        className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/70 via-black/20 to-transparent transition-opacity duration-300 z-29 flex items-start justify-end p-3 sm:p-4 pointer-events-none border-0 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Close Button matching Screenshot 1 Top Right */}
        <button
          type="button"
          onClick={() => {
            if (onClose) {
              onClose();
            } else if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            }
          }}
          className="pointer-events-auto w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition border border-white/10 cursor-pointer shadow-md"
          title="Close Player"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* ----------------- 7. CENTER CONTROLS (Screenshot 1: Rewind 10, Play/Pause, Forward 10) ----------------- */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-10 sm:gap-20 pointer-events-none z-25 border-0 bg-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Rewind 10s Circular Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip(-10);
          }}
          className="pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 text-white/90 hover:text-white border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-xs transition cursor-pointer"
          title="Rewind 10 seconds"
        >
          <span className="material-symbols-outlined text-2xl sm:text-3xl">replay_10</span>
        </button>

        {/* Big Center Play / Pause Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="pointer-events-auto w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white border-2 border-white/30 flex items-center justify-center shadow-2xl backdrop-blur-sm transition cursor-pointer"
          title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
        >
          <span className="material-symbols-outlined text-3xl sm:text-5xl">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>

        {/* Forward 10s Circular Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skip(10);
          }}
          className="pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 text-white/90 hover:text-white border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-xs transition cursor-pointer"
          title="Forward 10 seconds"
        >
          <span className="material-symbols-outlined text-2xl sm:text-3xl">forward_10</span>
        </button>
      </div>

      {/* ----------------- 8. BOTTOM CONTROL BAR (Screenshots 1, 2, 3) ----------------- */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 pointer-events-auto flex flex-col gap-2.5 ${
          showControls || !isPlaying || showSpeedMenu || showQualityMenu
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-width Timeline Scrub Bar with BLUE THUMB (Screenshot 1) */}
        {!isLive && (
          <div
            ref={progressBarRef}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={handleProgressMouseLeave}
            onMouseDown={handleProgressMouseDown}
            className="relative w-full h-3 group/progress cursor-pointer flex items-center"
          >
            {/* Background Track */}
            <div className="w-full h-1 group-hover/progress:h-2 bg-white/25 rounded-full overflow-hidden relative transition-all duration-150">
              {/* Buffer Bar */}
              <div
                className="absolute top-0 left-0 bottom-0 bg-white/35 rounded-full transition-all duration-200"
                style={{ width: `${bufferPercent}%` }}
              />
              {/* Played Bar */}
              <div
                className={`absolute top-0 left-0 bottom-0 bg-white rounded-full ${
                  isScrubbing ? "transition-none" : "transition-[width] duration-150 ease-linear"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Blue Circular Thumb Knob matching Screenshot 1 */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-blue-500 rounded-full shadow-lg border-2 border-white pointer-events-none ${
                isScrubbing ? "transition-none" : "transition-[left] duration-150 ease-linear"
              }`}
              style={{ left: `${progressPercent}%` }}
            />

            {/* Hover Tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 text-white text-[10px] font-mono font-bold border border-white/20 shadow-xl pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
        )}

        {/* Bottom Controls Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls: Play/Pause, -10s, +10s, Volume with Blue Thumb, Time Display */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-95 transition text-white cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              <span className="material-symbols-outlined text-2xl">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>

            {/* Replay 10s */}
            <button
              type="button"
              onClick={() => skip(-10)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition text-white/90 hover:text-white cursor-pointer"
              title="Rewind 10 seconds"
            >
              <span className="material-symbols-outlined text-xl">replay_10</span>
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => skip(10)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition text-white/90 hover:text-white cursor-pointer"
              title="Forward 10 seconds"
            >
              <span className="material-symbols-outlined text-xl">forward_10</span>
            </button>

            {/* Volume Icon + Horizontal Slider (with blue dot thumb) */}
            <div className="flex items-center gap-1 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition text-white/90 hover:text-white cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
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
                className="w-14 sm:w-20 h-1 bg-white/30 rounded-full appearance-none accent-blue-500 cursor-pointer hidden sm:block opacity-85 group-hover/volume:opacity-100 transition"
                title="Volume"
              />
            </div>

            {/* Exact Time indicator format from Screenshot 1: 27:14/01:47:41 */}
            <div className="text-[11px] sm:text-xs font-mono font-medium text-white/90 select-none ml-1">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Speedometer, Rotate/Aspect, Settings Gear, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative">
            {/* Speedometer Button (Screenshot 1 & 2) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu((prev) => !prev);
                  setShowQualityMenu(false);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition cursor-pointer ${
                  showSpeedMenu ? "bg-white/20 text-blue-400" : "text-white/90 hover:text-white"
                }`}
                title="Playback Speed"
              >
                <span className="material-symbols-outlined text-xl">speed</span>
              </button>

              {/* Exact Speed Popup Menu from Screenshot 2 */}
              {showSpeedMenu && (
                <div className="absolute bottom-11 right-0 w-24 bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex flex-col space-y-0.5">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSpeedChange(s)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          playbackSpeed === s
                            ? "bg-white/20 text-white font-bold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Screen Rotation / Aspect Ratio Button (Screenshot 1) */}
            <button
              type="button"
              onClick={handleRotateOrAspect}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 text-white/90 hover:text-white transition cursor-pointer"
              title="Screen Rotation / Aspect Ratio"
            >
              <span className="material-symbols-outlined text-xl">
                {isAspectFill ? "crop_free" : "aspect_ratio"}
              </span>
            </button>

            {/* Settings Gear Button (Screenshot 1 & 3) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((prev) => !prev);
                  setShowSpeedMenu(false);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition cursor-pointer ${
                  showQualityMenu ? "bg-white/20 text-blue-400" : "text-white/90 hover:text-white"
                }`}
                title="Video Quality"
              >
                <span className="material-symbols-outlined text-xl">settings</span>
              </button>

              {/* Quality Popup Menu (Supporting 1080p HD, 720p, 480p, 360p, 240p, 144p, Auto) */}
              {showQualityMenu && (
                <div className="absolute bottom-11 right-0 w-28 bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-64 overflow-y-auto scrollbar-none">
                  <div className="flex flex-col space-y-0.5">
                    {qualityOptions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleQualityChange(q)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                          selectedQuality === q
                            ? "bg-white/20 text-white font-bold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{q}</span>
                        {q === "1080p" && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/30 text-blue-300 font-semibold uppercase tracking-wider">
                            HD
                          </span>
                        )}
                        {q === "4K (2160p)" && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-300 font-semibold uppercase tracking-wider">
                            4K
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 text-white/90 hover:text-white transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <span className="material-symbols-outlined text-xl">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
