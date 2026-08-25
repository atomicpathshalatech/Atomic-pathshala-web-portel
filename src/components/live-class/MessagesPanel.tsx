"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";

export type ChatMessage = {
  id: string;
  authorRole: "TEACHER" | "STUDENT";
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
  // Server-generated announcements ("X has joined the class") — rendered as
  // a centered note rather than a chat bubble. See .../join/route.ts.
  isSystemMessage?: boolean;
};

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

// The "dark" palette matches the live-class whiteboard's dedicated dark
// theme (see TeacherLiveClassRoom.tsx) exactly, rather than the app's
// shared design tokens — those are tuned for the rest of the (light) app
// and don't have a real dark mapping. "light" keeps using the shared
// tokens unchanged, which is what StudentLiveClassRoom (still light-themed)
// relies on.
const THEME = {
  light: {
    toggleOn: "border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
    toggleOff: "border-error/40 text-error bg-error/5",
    loading: "text-on-surface-variant",
    empty: "text-on-surface-variant",
    authorLabel: "text-on-surface-variant",
    bubbleMine: "bg-primary text-on-primary",
    bubbleTheirs: "bg-surface-container-high text-on-surface",
    error: "text-error",
    inputRow: "border-outline-variant/20",
    input: "border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant",
    sendBtn: "bg-primary text-on-primary disabled:opacity-40",
    quickBtn: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
    disabledNotice: "text-on-surface-variant border-outline-variant/20",
  },
  dark: {
    toggleOn: "border-[#2d2e3b] text-gray-400 hover:bg-[#2d2e3b]",
    toggleOff: "border-red-900/50 text-red-400 bg-red-900/10",
    loading: "text-gray-500",
    empty: "text-gray-500",
    authorLabel: "text-gray-500",
    bubbleMine: "bg-blue-600 text-white",
    bubbleTheirs: "bg-[#1e1f2b] border border-[#2d2e3b] text-gray-200",
    error: "text-red-400",
    inputRow: "border-[#2d2e3b]",
    input: "border-[#2d2e3b] bg-[#10131b] text-white placeholder:text-gray-500",
    sendBtn: "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40",
    quickBtn: "text-gray-400 hover:text-white hover:bg-[#2d2e3b]",
    disabledNotice: "text-gray-500 border-[#2d2e3b]",
  },
} as const;

/**
 * Live class chat — shared by TeacherLiveClassRoom and StudentLiveClassRoom.
 * Mounted only while its tab/panel is open; each mount re-fetches recent
 * history (see HISTORY_LIMIT on the API route) so re-opening the tab always
 * catches up on anything missed while it was closed, rather than needing an
 * always-mounted background subscription just for this one feature.
 */
export function MessagesPanel({
  whiteboardSessionId,
  currentUserId,
  role,
  theme = "light",
  showOwnToggle = true,
}: {
  whiteboardSessionId: string;
  currentUserId: string;
  role: "TEACHER" | "STUDENT";
  theme?: "light" | "dark";
  // When the parent owns a single source of truth for chatEnabled elsewhere
  // (TeacherLiveClassRoom's Class Settings → Chat & Poll controls does this,
  // reading straight off wbSession.chatEnabled), set this false so this
  // panel doesn't also render its own toggle — two toggle controls for the
  // same server state would just drift out of sync with each other.
  showOwnToggle?: boolean;
}) {
  const t = THEME[theme];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingChat, setTogglingChat] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJson(`/api/whiteboard/sessions/${whiteboardSessionId}/messages`);
        if (cancelled) return;
        setMessages(data.messages);
        setChatEnabled(data.chatEnabled);
      } catch {
        if (!cancelled) setError("Could not load chat history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [whiteboardSessionId]);

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(sessionChannel(whiteboardSessionId));
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    channel.bind(WB_EVENTS.MESSAGE_SENT, handler);
    return () => {
      channel.unbind(WB_EVENTS.MESSAGE_SENT, handler);
    };
  }, [whiteboardSessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await postJson(`/api/whiteboard/sessions/${whiteboardSessionId}/messages`, { body });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleChat() {
    setTogglingChat(true);
    try {
      await patchJson(`/api/whiteboard/sessions/${whiteboardSessionId}`, { chatEnabled: !chatEnabled });
      setChatEnabled((v) => !v);
    } catch {
      // leave state as-is on failure — the button just won't visibly toggle
    } finally {
      setTogglingChat(false);
    }
  }

  const canSend = role === "TEACHER" || chatEnabled;

  return (
    <div className="flex flex-col h-full">
      {role === "TEACHER" && showOwnToggle && (
        <button
          type="button"
          onClick={handleToggleChat}
          disabled={togglingChat}
          className={`self-end mb-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-60 ${
            chatEnabled ? t.toggleOn : t.toggleOff
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">chat</span>
          {chatEnabled ? "Student chat on" : "Student chat off"}
        </button>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        {loading ? (
          <p className={`text-sm text-center mt-8 ${t.loading}`}>Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className={`text-sm text-center mt-8 ${t.empty}`}>No messages yet.</p>
        ) : (
          messages.map((m) => {
            if (m.isSystemMessage) {
              return (
                <div key={m.id} className="text-center">
                  <span className={`text-xs italic ${t.authorLabel}`}>{m.body}</span>
                </div>
              );
            }
            const mine = m.authorUserId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className={`text-[10px] mb-0.5 ${t.authorLabel}`}>
                  {m.authorName}
                  {m.authorRole === "TEACHER" ? " · Teacher" : ""}
                </span>
                <span
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm break-words ${
                    mine ? t.bubbleMine : t.bubbleTheirs
                  }`}
                >
                  {m.body}
                </span>
              </div>
            );
          })
        )}
      </div>

      {error && <p className={`text-sm mt-1.5 ${t.error}`}>{error}</p>}

      {canSend ? (
        <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${t.inputRow}`}>
          {theme === "dark" && (
            <div className="flex items-center gap-1">
              <button type="button" className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${t.quickBtn}`} title="Thumbs up">
                <span className="material-symbols-outlined text-base">thumb_up</span>
              </button>
              <button type="button" className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${t.quickBtn}`} title="Thumbs down">
                <span className="material-symbols-outlined text-base">thumb_down</span>
              </button>
            </div>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your comment here…"
            maxLength={2000}
            className={`flex-1 rounded-lg border py-1.5 px-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${t.input}`}
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            onClick={handleSend}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${t.sendBtn}`}
            title="Send"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      ) : (
        <p className={`text-sm text-center mt-2 pt-2 border-t ${t.disabledNotice}`}>
          The teacher has turned off chat.
        </p>
      )}
    </div>
  );
}
