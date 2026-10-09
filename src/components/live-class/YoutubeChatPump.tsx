"use client";

import { useEffect } from "react";

/**
 * Keeps the class's YouTube comments flowing while the teacher's room is open.
 *
 * Reading YouTube used to live inside the chat panel, so it only happened
 * while the teacher had the "Chat" tab on screen — on the Questions or
 * Students tab nobody (teacher or students) got YouTube comments, and
 * answers typed in the YouTube chat were not counted. This renders nothing
 * and just asks the server to read the chat (at most every 20 s — each read
 * costs YouTube quota); the server stores the comments and pushes them to
 * everyone in the room.
 */
export function YoutubeChatPump({ whiteboardSessionId, active }: { whiteboardSessionId: string; active: boolean }) {
  useEffect(() => {
    if (!active || !whiteboardSessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const MIN_INTERVAL_MS = 20_000;
    const FALLBACK_INTERVAL_MS = 30_000;

    async function read() {
      let nextDelay = FALLBACK_INTERVAL_MS;
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/youtube-chat`, { cache: "no-store" });
        const json = await res.json();
        if (json?.success && typeof json.data?.pollingIntervalMillis === "number") {
          nextDelay = Math.max(MIN_INTERVAL_MS, json.data.pollingIntervalMillis);
        }
      } catch {
        // network blip: try again on the next round
      } finally {
        if (!cancelled) timer = setTimeout(read, nextDelay);
      }
    }
    read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [whiteboardSessionId, active]);

  return null;
}
