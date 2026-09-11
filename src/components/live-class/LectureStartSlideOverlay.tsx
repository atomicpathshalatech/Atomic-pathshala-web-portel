"use client";

import { useEffect, useState } from "react";

/**
 * The auto-generated first slide (spec section 10) — shown as a brief
 * intro card over the live-class room, never something the teacher has to
 * build. Deliberately self-contained: its own fetch, its own state, no
 * interaction with the whiteboard/room's internals (that component is
 * ~3.8k lines of canvas/Pusher/LiveKit wiring — this overlay only ever
 * reads one small API and renders on top of it, dismissible, never
 * blocking the room underneath).
 */
export function LectureStartSlideOverlay({ scheduleId }: { scheduleId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/schedule/${scheduleId}/start-slide`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setUrl(json.data.url);
      })
      .catch(() => {});
    // Auto-dismiss after a few seconds so it never blocks teaching.
    const t = setTimeout(() => setDismissed(true), 6000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scheduleId]);

  if (!url || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-label="Class starting"
      onClick={() => setDismissed(true)}
    >
      <div className="relative max-w-3xl w-full mx-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Lecture start slide" className="w-full h-auto rounded-2xl shadow-2xl" />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
