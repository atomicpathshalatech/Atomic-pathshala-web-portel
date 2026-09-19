"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ClassroomYouTubePlayerProps = {
  youtubeVideoId: string;
  title: string;
  onError?: () => void;
  className?: string;
};

/**
 * A simpler, independent sibling of src/components/live-class/
 * YouTubeLivePlayer.tsx (Whiteboard's player) — genuinely live video needs
 * no seek/speed scrubbing, just a clean embed, fullscreen, and error
 * detection. Deliberately does not import from the Whiteboard component.
 */
export function ClassroomYouTubePlayer({ youtubeVideoId, title, onError, className = "" }: ClassroomYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    setLoadError(false);
  }, [youtubeVideoId]);

  const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1&origin=${
    typeof window !== "undefined" ? window.location.origin : ""
  }`;

  if (loadError) {
    return (
      <div className={`w-full aspect-video bg-[#0d0e16] rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3 p-8 text-center ${className}`}>
        <span className="material-symbols-outlined text-3xl text-rose-400">error</span>
        <p className="text-sm text-slate-300">Live class is currently unavailable. Please try again shortly.</p>
        <button
          type="button"
          onClick={() => setLoadError(false)}
          className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden ${className}`}>
      <iframe
        key={youtubeVideoId}
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full border-0"
        onError={() => {
          setLoadError(true);
          onError?.();
        }}
      />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white transition"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        <span className="material-symbols-outlined text-base">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
      </button>
    </div>
  );
}
