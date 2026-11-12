"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampToLive, livePositionSec } from "@/lib/recorded-lectures/premiere";
import { LectureVideoPlayer } from "@/components/video-player/LectureVideoPlayer";

/** This browser's id for the one-device rule (kept across visits). */
function deviceId(): string {
  try {
    let id = localStorage.getItem("rl-device");
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, "");
      localStorage.setItem("rl-device", id);
    }
    return id;
  } catch {
    return "nostorage-" + Math.random().toString(36).slice(2, 12);
  }
}

const POSITIONS = [
  "top-[8%] left-[6%]",
  "top-[12%] right-[6%]",
  "top-[45%] left-[30%]",
  "bottom-[22%] right-[10%]",
  "bottom-[30%] left-[8%]",
  "top-[30%] right-[28%]",
];

/**
 * Player for a recorded lecture — the SAME player as the live classes'
 * recordings (LectureVideoPlayer: its controls, speed, quality, resume,
 * watch time, full screen in landscape), fed a short-lived signed URL from
 * /api/student/recorded-lectures/[id]/playback after a fresh enrollment
 * check. The URL is renewed before it expires (and after a playback error)
 * without losing the position.
 *
 * Protection on top (deterrents — a browser cannot fully block screen
 * recording; that needs DRM): a moving watermark with the student's name,
 * id and the time, also tiled faintly over the picture (kept in full
 * screen); no download / picture-in-picture / right-click; 5-minute links;
 * one device at a time (a heartbeat every minute — another device starting
 * the lecture stops it here); and the picture is covered and paused when
 * the window loses focus or Print Screen is pressed.
 *
 * A lecture scheduled for the batch plays like a live class in its slot:
 * it starts at the live point, the student can go back but not ahead, and
 * "Go live" returns to it. After the slot it is an ordinary recording.
 */
export function RecordedLecturePlayer({
  lectureId,
  watermark,
  initiallyCompleted,
  title,
  subjectTitle,
  educatorName,
}: {
  lectureId: string;
  watermark: string;
  initiallyCompleted: boolean;
  title: string;
  subjectTitle?: string;
  educatorName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const completed = useRef(initiallyCompleted);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [now, setNow] = useState(() => new Date());
  // In a scheduled slot: its times and the server clock's offset from this device.
  const [live, setLive] = useState<{ startsAt: string; endsAt: string; offsetMs: number } | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [behindSec, setBehindSec] = useState(0);
  const device = useRef<string>("");
  // Covered and paused: the window lost focus / Print Screen (see the comment above).
  const [shielded, setShielded] = useState(false);

  // Subtitles of what the teacher says (from the lecture's AI pass), when there are any.
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/student/recorded-lectures/${lectureId}/ai`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => alive && setHasSubtitles(Boolean(json?.success && json.data?.subtitles?.length)))
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [lectureId]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.querySelectorAll("track").forEach((t) => t.remove());
    if (!subtitlesOn) return;
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.srclang = "und";
    track.label = "Subtitles";
    track.default = true;
    track.src = `/api/student/recorded-lectures/${lectureId}/subtitles`;
    v.appendChild(track);
    track.track.mode = "showing";
  }, [subtitlesOn, src, lectureId]);

  const livePoint = useCallback(() => {
    const l = liveRef.current;
    if (!l) return null;
    return livePositionSec(l.startsAt, new Date(Date.now() + l.offsetMs), videoRef.current?.duration || null);
  }, []);

  const authorise = useCallback(
    async (keepPosition: boolean, renew = false) => {
      const v = videoRef.current;
      const at = keepPosition && v ? v.currentTime : null;
      const wasPlaying = keepPosition && v ? !v.paused : false;
      if (!device.current) device.current = deviceId();
      try {
        const res = await fetch(`/api/student/recorded-lectures/${lectureId}/playback`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          // A renewal does not take the lecture over from another device; opening / Retry does.
          body: JSON.stringify({ deviceId: device.current, renew }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          v?.pause();
          if (json.code === "OTHER_DEVICE") setSrc(null);
          setError(typeof json.error === "string" ? json.error : "This lecture cannot be played right now.");
          return;
        }
        setError(null);
        const l = json.data.live as { startsAt: string; endsAt: string; serverNow: string } | null | undefined;
        setLive(l ? { startsAt: l.startsAt, endsAt: l.endsAt, offsetMs: new Date(l.serverNow).getTime() - Date.now() } : null);
        setSrc(json.data.url);
        // A renewed link replaces the source of the same <video>: carry on where it was.
        if (at !== null && v) {
          const restore = () => {
            v.currentTime = at;
            if (wasPlaying) void v.play().catch(() => null);
            v.removeEventListener("loadedmetadata", restore);
          };
          v.addEventListener("loadedmetadata", restore);
        }
        // Renew at 80% of the URL's life.
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        const ttl = Number(json.data.expiresInSeconds) || 600;
        refreshTimer.current = setTimeout(() => void authorise(true, true), ttl * 800);
      } catch {
        setError("Network problem. Check your connection and press Retry.");
      }
    },
    [lectureId]
  );

  useEffect(() => {
    void authorise(false);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [authorise]);

  // Move the watermark and keep its clock current.
  useEffect(() => {
    const t = setInterval(() => {
      setPos((p) => (p + 1) % POSITIONS.length);
      setNow(new Date());
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // One device at a time: while playing, tell the server every minute; another device took over → stop here.
  useEffect(() => {
    const t = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.paused || !device.current) return;
      try {
        const res = await fetch(`/api/student/recorded-lectures/${lectureId}/playback`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: device.current, heartbeat: true }),
        });
        if (res.status === 409 || res.status === 403) {
          const json = await res.json().catch(() => ({}));
          v.pause();
          setSrc(null);
          setError(typeof json.error === "string" ? json.error : "This lecture stopped here.");
        }
      } catch {
        // offline for a moment: the next beat tries again
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [lectureId]);

  // Cover and pause when the window loses focus (snipping tool, screen recorder, another app) or on Print Screen.
  useEffect(() => {
    const shield = () => {
      videoRef.current?.pause();
      setShielded(true);
    };
    // Going full screen / turning the phone can blur the window for a moment: not a reason to cover it.
    let quietUntil = 0;
    const onTurn = () => {
      quietUntil = Date.now() + 2000;
    };
    const onBlur = () => {
      if (Date.now() > quietUntil) shield();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") shield();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || "").toLowerCase();
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey) || ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p"))) {
        if (e.key !== "PrintScreen") e.preventDefault();
        shield();
        try {
          void navigator.clipboard?.writeText(" ").catch(() => null);
        } catch {
          // clipboard not available
        }
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("orientationchange", onTurn);
    window.addEventListener("resize", onTurn);
    document.addEventListener("fullscreenchange", onTurn);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("orientationchange", onTurn);
      window.removeEventListener("resize", onTurn);
      document.removeEventListener("fullscreenchange", onTurn);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // Live slot: join at the live point, never ahead of it; at the end of the slot it becomes a recording.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const onLoaded = () => {
      failures.current = 0;
      const at = livePoint();
      if (at !== null && v.currentTime < 1) {
        v.currentTime = at;
        void v.play().catch(() => null);
      }
    };
    const holdToLive = () => {
      const at = livePoint();
      if (at !== null && v.currentTime > at + 2) v.currentTime = clampToLive(v.currentTime, at);
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("seeking", holdToLive);
    v.addEventListener("timeupdate", holdToLive);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("seeking", holdToLive);
      v.removeEventListener("timeupdate", holdToLive);
    };
  }, [src, livePoint]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const l = liveRef.current;
      if (!l) return;
      if (Date.now() + l.offsetMs >= new Date(l.endsAt).getTime()) {
        setLive(null);
        setBehindSec(0);
        return;
      }
      const at = livePoint();
      const v = videoRef.current;
      if (at !== null && v) setBehindSec(Math.max(0, at - v.currentTime));
    }, 1000);
    return () => clearInterval(t);
  }, [live, livePoint]);

  const goLive = () => {
    const v = videoRef.current;
    const at = livePoint();
    if (!v || at === null) return;
    v.currentTime = at;
    void v.play().catch(() => null);
  };

  // An expired URL or a dropped connection: ask for a fresh URL (twice), then show Retry.
  const onVideoError = () => {
    failures.current += 1;
    if (failures.current <= 2) void authorise(true, true);
    else setError("The video stopped loading. Press Retry.");
  };

  const markComplete = () => {
    if (completed.current) return;
    completed.current = true;
    void fetch(`/api/lectures/${lectureId}/complete`, { method: "POST" }).catch(() => null);
  };

  const overlay = (
    <>
      {/* Watermark: faint tiles over the whole picture + a clear moving one (student, id, time). */}
      <div aria-hidden className="!pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-1/4 grid grid-cols-3 gap-x-10 gap-y-16 -rotate-[24deg] place-items-center">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="text-white/[0.08] text-xs sm:text-sm font-bold whitespace-nowrap">
              {watermark}
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden className={`!pointer-events-none absolute ${POSITIONS[pos]} transition-all duration-[1500ms] text-white/50 text-[11px] sm:text-sm font-black tracking-wide drop-shadow`}>
        {watermark} · {now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>

      {/* Clean recorded lecture playback: no misleading LIVE badge */}

      {hasSubtitles && (
        <button
          type="button"
          onClick={() => setSubtitlesOn((v) => !v)}
          aria-pressed={subtitlesOn}
          className={`absolute top-14 right-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white ${subtitlesOn ? "bg-blue-600" : "bg-black/60 hover:bg-black/70"}`}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            subtitles
          </span>
          {subtitlesOn ? "CC on" : "CC"}
        </button>
      )}

      {shielded && (
        <button
          type="button"
          onClick={() => {
            setShielded(false);
            void videoRef.current?.play().catch(() => null);
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white text-center px-6"
        >
          <span className="material-symbols-outlined text-4xl">visibility_off</span>
          <span className="text-sm font-bold">Paused — the lecture is hidden while this window is not in use.</span>
          <span className="text-xs text-white/70">Tap to continue watching</span>
        </button>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-center px-6">
          <p className="text-white text-sm max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => {
              failures.current = 0;
              setError(null);
              void authorise(true);
            }}
            className="rounded-lg bg-white text-slate-900 text-sm font-bold px-4 py-2"
          >
            Retry
          </button>
        </div>
      )}
    </>
  );

  if (!src) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
        {error ? (
          overlay
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading video">
            <span className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <LectureVideoPlayer
      mode="recorded"
      lectureId={lectureId}
      watchContentKey={`lecture:${lectureId}`}
      title={title}
      subjectTitle={subjectTitle}
      educatorName={educatorName}
      videoUrl={src}
      watermarkText={watermark}
      videoElementRef={videoRef}
      onVideoError={onVideoError}
      onEnded={markComplete}
      onProgressPercentage={(pct) => {
        if (pct >= 90) markComplete();
      }}
      overlay={overlay}
    />
  );
}
