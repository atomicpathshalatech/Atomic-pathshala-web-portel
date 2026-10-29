"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAiVoice, type VoiceClip } from "./useAiVoice";

const SUB_LABEL: Record<string, string> = { orig: "As spoken", hi: "हिंदी", en: "English" };

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
 * Deterrents, not DRM: a moving watermark with the student's masked id and
 * the date (kept on screen in fullscreen — the whole player goes
 * fullscreen, not the bare <video>), no download button, no
 * picture-in-picture, no right-click menu on the video. Screen recording
 * and screenshots cannot be blocked in a browser.
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
  const resumeKey = `rl-pos:${lectureId}`;

  // AI voice tracks and subtitles (from the lecture's AI pass), when there are any.
  const [ai, setAi] = useState<{ audio: { lang: "hi" | "en"; chunks: VoiceClip[] }[]; subtitles: string[] } | null>(null);
  const [audioLang, setAudioLang] = useState<"orig" | "hi" | "en">("orig");
  const [subLang, setSubLang] = useState<string>("off");
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAi = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/recorded-lectures/${lectureId}/ai`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) return;
      setAi({ audio: json.data.audio ?? [], subtitles: json.data.subtitles ?? [] });
      // Clip URLs are signed: fetch fresh ones before they expire.
      if (aiTimer.current) clearTimeout(aiTimer.current);
      aiTimer.current = setTimeout(() => void loadAi(), (Number(json.data.expiresInSeconds) || 3600) * 800);
    } catch {
      // no AI tracks: the original audio plays as usual
    }
  }, [lectureId]);
  useEffect(() => {
    void loadAi();
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
    };
  }, [loadAi]);
  const clipErrors = useRef(0);
  const onClipError = useCallback(() => {
    // An expired clip URL: renew once, then fall back to the original audio.
    clipErrors.current += 1;
    if (clipErrors.current <= 2) void loadAi();
    else setAudioLang("orig");
  }, [loadAi]);
  const clips = audioLang === "orig" ? null : (ai?.audio.find((t) => t.lang === audioLang)?.chunks ?? null);
  useAiVoice(videoRef, src, clips, onClipError);

  useEffect(() => {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = subLang !== "off" && i === 0 ? "showing" : "disabled";
  }, [subLang, src]);

  const authorise = useCallback(
    async (keepPosition: boolean) => {
      const v = videoRef.current;
      const at = keepPosition && v ? v.currentTime : null;
      const wasPlaying = keepPosition && v ? !v.paused : false;
      try {
        const res = await fetch(`/api/student/recorded-lectures/${lectureId}/playback`, { method: "POST", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setError(typeof json.error === "string" ? json.error : "This lecture cannot be played right now.");
          setLoading(false);
          return;
        }
        setError(null);
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
        refreshTimer.current = setTimeout(() => void authorise(true), ttl * 800);
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
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const onLoaded = () => {
    setLoading(false);
    failures.current = 0;
    const v = videoRef.current;
    if (!v) return;
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
      void authorise(true);
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
    <div ref={boxRef} className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
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
          onError={onError}
          className="absolute inset-0 w-full h-full"
        >
          {subLang !== "off" && (
            <track
              key={subLang}
              kind="subtitles"
              default
              srcLang={subLang === "orig" ? "und" : subLang}
              label={SUB_LABEL[subLang] ?? subLang}
              src={`/api/student/recorded-lectures/${lectureId}/subtitles?lang=${subLang}`}
            />
          )}
        </video>
      )}

      {ai && (ai.audio.length > 0 || ai.subtitles.length > 0) && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 text-[11px] sm:text-xs">
          {ai.audio.length > 0 && (
            <label className="flex items-center gap-1 rounded-lg bg-black/60 text-white px-2 py-1">
              <span className="material-symbols-outlined text-sm" aria-hidden>
                record_voice_over
              </span>
              <span className="sr-only">Audio language</span>
              <select
                value={audioLang}
                onChange={(e) => {
                  clipErrors.current = 0;
                  setAudioLang(e.target.value as "orig" | "hi" | "en");
                }}
                className="bg-transparent font-bold outline-none [&>option]:text-slate-900"
              >
                <option value="orig">Audio: Original</option>
                {ai.audio.map((t) => (
                  <option key={t.lang} value={t.lang}>
                    Audio: {t.lang === "hi" ? "हिंदी (AI)" : "English (AI)"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {ai.subtitles.length > 0 && (
            <label className="flex items-center gap-1 rounded-lg bg-black/60 text-white px-2 py-1">
              <span className="material-symbols-outlined text-sm" aria-hidden>
                subtitles
              </span>
              <span className="sr-only">Subtitles</span>
              <select value={subLang} onChange={(e) => setSubLang(e.target.value)} className="bg-transparent font-bold outline-none [&>option]:text-slate-900">
                <option value="off">Subtitles: Off</option>
                {ai.subtitles.map((l) => (
                  <option key={l} value={l}>
                    Subtitles: {SUB_LABEL[l] ?? l}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {/* Watermark: masked student id + date/time, moving. */}
      <div aria-hidden className={`pointer-events-none absolute ${POSITIONS[pos]} transition-all duration-[2000ms] text-white/35 text-[11px] sm:text-sm font-bold tracking-wide drop-shadow`}>
        {watermark} · {now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>

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
