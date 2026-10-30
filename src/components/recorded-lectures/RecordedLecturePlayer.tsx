"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampToLive, livePositionSec } from "@/lib/recorded-lectures/premiere";

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
 * Player for a recorded lecture. The video comes from a short-lived signed
 * URL handed out by /api/student/recorded-lectures/[id]/playback after a
 * fresh enrollment check; the URL is renewed before it expires (and after a
 * playback error) without losing the position.
 *
 * Protection (deterrents — a browser cannot fully block screen recording;
 * that needs DRM): a moving watermark with the student's name, id and the
 * time, also tiled faintly over the whole picture (kept in fullscreen — the
 * whole player goes fullscreen, not the bare <video>); no download, no
 * picture-in-picture, no right-click; 5-minute video links; one device at a
 * time (a heartbeat every minute — another device starting the lecture stops
 * it here); and the picture is covered and paused whenever the window loses
 * focus or Print Screen is pressed (snipping tools and most recorders take
 * the focus).
 *
 * A lecture scheduled for the batch plays like a live class in its slot:
 * it starts at the live point (where the class is now), the student can go
 * back but not ahead of it, and "Go live" returns to it. After the slot it
 * is an ordinary recording.
 */
export function RecordedLecturePlayer({
  lectureId,
  watermark,
  initiallyCompleted,
}: {
  lectureId: string;
  watermark: string;
  initiallyCompleted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [completed, setCompleted] = useState(initiallyCompleted);
  // In a scheduled slot: its times and the server clock's offset from this device.
  const [live, setLive] = useState<{ startsAt: string; endsAt: string; offsetMs: number } | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [behindSec, setBehindSec] = useState(0);
  const resumeKey = `rl-pos:${lectureId}`;
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
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = subtitlesOn ? "showing" : "disabled";
  }, [subtitlesOn, src]);

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
          setLoading(false);
          return;
        }
        setError(null);
        const l = json.data.live as { startsAt: string; endsAt: string; serverNow: string } | null | undefined;
        setLive(l ? { startsAt: l.startsAt, endsAt: l.endsAt, offsetMs: new Date(l.serverNow).getTime() - Date.now() } : null);
        setSrc(json.data.url);
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
        setLoading(false);
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
    window.addEventListener("blur", shield);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("blur", shield);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const livePoint = useCallback(() => {
    const l = liveRef.current;
    if (!l) return null;
    return livePositionSec(l.startsAt, new Date(Date.now() + l.offsetMs), videoRef.current?.duration || null);
  }, []);

  const goLive = useCallback(() => {
    const v = videoRef.current;
    const at = livePoint();
    if (!v || at === null) return;
    v.currentTime = at;
    void v.play().catch(() => null);
  }, [livePoint]);

  // Live slot: how far behind the live point the student is; at the end of the slot it becomes a recording.
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

  // Live slot: no skipping ahead of the class (seeking, or a faster speed).
  const holdToLive = () => {
    const v = videoRef.current;
    const at = livePoint();
    if (!v || at === null) return;
    if (v.currentTime > at + 2) v.currentTime = clampToLive(v.currentTime, at);
  };

  const onLoaded = () => {
    setLoading(false);
    failures.current = 0;
    const v = videoRef.current;
    if (!v) return;
    // Joining a live slot: start where the class is now.
    const at = livePoint();
    if (at !== null) {
      if (v.currentTime < 1) {
        v.currentTime = at;
        void v.play().catch(() => null);
      }
      return;
    }
    try {
      const saved = Number(localStorage.getItem(resumeKey));
      if (saved > 5 && saved < v.duration - 10 && v.currentTime < 1) v.currentTime = saved;
    } catch {
      // storage unavailable: start from the beginning
    }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    holdToLive();
    try {
      if (Math.floor(v.currentTime) % 5 === 0) localStorage.setItem(resumeKey, String(Math.floor(v.currentTime)));
    } catch {
      // ignore
    }
    if (!completed && v.currentTime / v.duration >= 0.9) {
      setCompleted(true);
      void fetch(`/api/lectures/${lectureId}/complete`, { method: "POST" }).catch(() => null);
    }
  };

  // An expired URL or a dropped connection: ask for a fresh URL (twice), then show Retry.
  const onError = () => {
    failures.current += 1;
    if (failures.current <= 2) {
      setLoading(true);
      void authorise(true, true);
    } else {
      setLoading(false);
      setError("The video stopped loading. Press Retry.");
    }
  };

  const fullscreen = async () => {
    const box = boxRef.current;
    if (!box) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await box.requestFullscreen();
    } catch {
      // not supported here (some phones): the inline player stays
    }
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {src && (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          onLoadedMetadata={onLoaded}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onTimeUpdate={onTimeUpdate}
          onSeeking={holdToLive}
          onError={onError}
          className="absolute inset-0 w-full h-full"
        >
          {subtitlesOn && <track kind="subtitles" default srcLang="und" label="Subtitles" src={`/api/student/recorded-lectures/${lectureId}/subtitles`} />}
        </video>
      )}

      {hasSubtitles && (
        <button
          type="button"
          onClick={() => setSubtitlesOn((v) => !v)}
          aria-pressed={subtitlesOn}
          className={`absolute top-2 right-12 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:text-xs font-bold text-white ${subtitlesOn ? "bg-blue-600" : "bg-black/60 hover:bg-black/70"}`}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            subtitles
          </span>
          Subtitles {subtitlesOn ? "on" : "off"}
        </button>
      )}

      {/* Watermark: faint tiles over the whole picture + a clear moving one (student, id, time). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-1/4 grid grid-cols-3 gap-x-10 gap-y-16 -rotate-[24deg] place-items-center">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="text-white/[0.08] text-xs sm:text-sm font-bold whitespace-nowrap">
              {watermark}
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden className={`pointer-events-none absolute ${POSITIONS[pos]} transition-all duration-[1500ms] text-white/50 text-[11px] sm:text-sm font-black tracking-wide drop-shadow`}>
        {watermark} · {now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>

      {shielded && (
        <button
          type="button"
          onClick={() => {
            setShielded(false);
            void videoRef.current?.play().catch(() => null);
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black text-white text-center px-6"
        >
          <span className="material-symbols-outlined text-4xl">visibility_off</span>
          <span className="text-sm font-bold">Paused — the lecture is hidden while this window is not in use.</span>
          <span className="text-xs text-white/70">Tap to continue watching</span>
        </button>
      )}

      {live && (
        <div className="absolute top-2 left-2">
          {behindSec > 8 ? (
            <button
              type="button"
              onClick={goLive}
              className="inline-flex items-center gap-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-[11px] font-black px-2 py-1"
            >
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Go live
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600 text-white text-[11px] font-black px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      )}

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading video">
          <span className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-6">
          <p className="text-white text-sm max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => {
              failures.current = 0;
              setLoading(true);
              setError(null);
              void authorise(true);
            }}
            className="rounded-lg bg-white text-slate-900 text-sm font-bold px-4 py-2"
          >
            Retry
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={fullscreen}
        aria-label="Full screen"
        className="absolute top-2 right-2 rounded-lg bg-black/50 hover:bg-black/70 text-white p-1.5"
      >
        <span className="material-symbols-outlined text-lg">fullscreen</span>
      </button>
    </div>
  );
}
