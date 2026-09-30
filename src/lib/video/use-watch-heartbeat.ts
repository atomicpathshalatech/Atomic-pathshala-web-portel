"use client";

import { useEffect, useRef } from "react";
import { WATCH_BEAT_MS, playedBetween } from "@/lib/video/watch-time";

/**
 * Reports how long this student really watched a recorded class: samples
 * the player position every few seconds, adds wall time only while it moves
 * forward, and sends the total every 30 s (and when the page is left).
 * `contentKey` = "lecture:<id>" | "schedule:<id>"; null turns it off.
 */
export function useWatchHeartbeat(contentKey: string | null | undefined, position: number, duration: number) {
  const posRef = useRef(position);
  const durRef = useRef(duration);
  posRef.current = position;
  durRef.current = duration;

  useEffect(() => {
    if (!contentKey) return;
    let last: { at: number; pos: number } | null = null;
    let pending = 0;

    const sample = () => {
      const now = { at: Date.now(), pos: posRef.current };
      pending += playedBetween(last, now);
      last = now;
    };
    const send = (useBeacon = false) => {
      sample();
      const playedSec = Math.floor(pending);
      if (playedSec < 1) return;
      pending -= playedSec;
      const body = JSON.stringify({
        contentKey,
        playedSec,
        positionSec: Math.floor(posRef.current),
        durationSec: durRef.current > 0 ? Math.floor(durRef.current) : undefined,
      });
      if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/student/video-watch", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/student/video-watch", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    };

    const sampler = window.setInterval(sample, 5000);
    const beat = window.setInterval(() => send(false), WATCH_BEAT_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") send(true);
    };
    const onLeave = () => send(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(sampler);
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      send(true);
    };
  }, [contentKey]);
}
