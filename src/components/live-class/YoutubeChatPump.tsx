"use client";

import { useEffect } from "react";
import { getDesktopBridge, type DesktopChatMessage } from "@/lib/desktop/bridge";

/**
 * Keeps the class's YouTube comments flowing while the teacher's room is open.
 *
 * Reading YouTube used to live inside the chat panel, so it only happened
 * while the teacher had the "Chat" tab on screen — on the Questions or
 * Students tab nobody (teacher or students) got YouTube comments, and
 * answers typed in the YouTube chat were not counted. This renders nothing.
 *
 * In the Atomic Pathshala Windows app the chat is read by the app itself from
 * YouTube's own pop-out chat, about once a second and without API quota (see
 * desktop/teacher/src/youtube-chat.js); what it reads is posted to the server,
 * which stores it, pushes it to everyone in the room and counts poll answers.
 * In a plain browser the server reads the chat through the YouTube API
 * instead (at most every 20 s — each read costs quota).
 */
export function YoutubeChatPump({
  whiteboardSessionId,
  active,
  youtubeVideoId,
}: {
  whiteboardSessionId: string;
  active: boolean;
  youtubeVideoId?: string | null;
}) {
  const desktopChat = typeof window !== "undefined" ? getDesktopBridge()?.youtubeChat ?? null : null;
  const useDesktop = Boolean(desktopChat && youtubeVideoId);

  // Desktop app: real-time chat from the app.
  useEffect(() => {
    if (!active || !whiteboardSessionId || !youtubeVideoId) return;
    const chat = getDesktopBridge()?.youtubeChat;
    if (!chat) return;
    let cancelled = false;
    let pending: DesktopChatMessage[] = [];
    let sending = false;
    const flush = async () => {
      if (sending || pending.length === 0 || cancelled) return;
      sending = true;
      const batch = pending.slice(0, 200);
      pending = pending.slice(batch.length);
      try {
        const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}/youtube-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: batch }),
        });
        if (!res.ok && res.status >= 500) pending = batch.concat(pending).slice(0, 1000); // retry on the next tick
      } catch {
        pending = batch.concat(pending).slice(0, 1000);
      } finally {
        sending = false;
      }
    };
    const off = chat.onMessages((messages) => {
      if (Array.isArray(messages) && messages.length) pending.push(...messages);
    });
    const timer = window.setInterval(() => void flush(), 700);
    chat.watch(youtubeVideoId).catch((err) => console.warn("[youtube_chat_desktop_watch]", err));
    return () => {
      cancelled = true;
      off();
      window.clearInterval(timer);
      void chat.stop().catch(() => undefined);
    };
  }, [whiteboardSessionId, active, youtubeVideoId]);

  // Browser: the server reads the chat through the YouTube API.
  useEffect(() => {
    if (!active || !whiteboardSessionId || useDesktop) return;
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
  }, [whiteboardSessionId, active, useDesktop]);

  return null;
}
