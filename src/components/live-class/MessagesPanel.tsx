"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";

export type ChatMessage = {
  id: string;
  authorRole: "TEACHER" | "STUDENT";
  authorUserId: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  body: string;
  createdAt: string;
  // Server-generated announcements ("X has joined the class") — rendered as
  // a centered note rather than a chat bubble. See .../join/route.ts.
  isSystemMessage?: boolean;
  // Teacher-pinned to the top of the chat for the whole class. Null/absent
  // means not pinned.
  pinnedAt?: string | null;
  source?: "APP" | "YOUTUBE";
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
    sendBtn: "bg-[#a33900] text-white disabled:opacity-40",
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
  currentUserName,
  currentUserPhotoUrl,
  theme = "light",
  showOwnToggle = true,
}: {
  whiteboardSessionId: string;
  currentUserId: string;
  role: "TEACHER" | "STUDENT";
  currentUserName?: string;
  currentUserPhotoUrl?: string | null;
  theme?: "light" | "dark";
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
      setMessages((prev) => {
        // If this message already exists (either by real ID or matching optimistic content), replace or keep
        const existingIdx = prev.findIndex(
          (m) => m.id === msg.id || (m.id.startsWith("opt_") && m.authorUserId === msg.authorUserId && m.body === msg.body)
        );
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = msg;
          return next;
        }
        return [...prev, msg];
      });
    };
    channel.bind(WB_EVENTS.MESSAGE_SENT, handler);

    const pinnedHandler = (data: { id: string; pinnedAt: string | null }) => {
      setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, pinnedAt: data.pinnedAt } : m)));
    };
    channel.bind(WB_EVENTS.MESSAGE_PINNED, pinnedHandler);

    const configHandler = (cfg: { chatEnabled?: boolean }) => {
      if (typeof cfg?.chatEnabled === "boolean") {
        setChatEnabled(cfg.chatEnabled);
      }
    };
    channel.bind(WB_EVENTS.CONFIG_UPDATED, configHandler);

    return () => {
      channel.unbind(WB_EVENTS.MESSAGE_SENT, handler);
      channel.unbind(WB_EVENTS.MESSAGE_PINNED, pinnedHandler);
      channel.unbind(WB_EVENTS.CONFIG_UPDATED, configHandler);
    };
  }, [whiteboardSessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Periodic YouTube Live Chat polling & merger (every 4s)
  useEffect(() => {
    let cancelled = false;
    let pageToken: string | undefined = undefined;

    async function pollYouTube() {
      try {
        const url = pageToken
          ? `/api/whiteboard/sessions/${whiteboardSessionId}/youtube-chat?pageToken=${encodeURIComponent(pageToken)}`
          : `/api/whiteboard/sessions/${whiteboardSessionId}/youtube-chat`;
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data?.messages?.length > 0) {
          pageToken = json.data.nextPageToken;
          const newYtMsgs: ChatMessage[] = json.data.messages;
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const fresh = newYtMsgs.filter((m) => !existingIds.has(m.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        }
      } catch {
        // silent fallback
      }
    }

    const interval = setInterval(pollYouTube, 4000);
    pollYouTube();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [whiteboardSessionId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;

    // 1. Instant optimistic clear & local message insertion (0ms delay)
    const optId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optMessage: ChatMessage = {
      id: optId,
      authorRole: role,
      authorUserId: currentUserId,
      authorName: currentUserName || (role === "TEACHER" ? "You (Teacher)" : "You"),
      authorPhotoUrl: currentUserPhotoUrl || null,
      body,
      createdAt: new Date().toISOString(),
    };

    setDraft("");
    setMessages((prev) => [...prev, optMessage]);
    setSending(true);
    setError(null);

    try {
      const data = await postJson(`/api/whiteboard/sessions/${whiteboardSessionId}/messages`, { body });
      if (data?.message) {
        // Replace optimistic message with the server-persisted message
        setMessages((prev) =>
          prev.map((m) => (m.id === optId ? { ...data.message, createdAt: new Date(data.message.createdAt).toISOString() } : m))
        );
      }
    } catch (err) {
      // Revert optimistic message if send failed
      setMessages((prev) => prev.filter((m) => m.id !== optId));
      setDraft(body);
      setError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleTogglePin(messageId: string, currentlyPinned: boolean) {
    // Optimistic — the server-authoritative MESSAGE_PINNED broadcast
    // (including back to this same client) is a no-op re-merge if it
    // arrives after this, so no risk of incorrect state.
    const prevMessages = messages;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pinnedAt: currentlyPinned ? null : new Date().toISOString() } : m))
    );
    try {
      await patchJson(`/api/whiteboard/sessions/${whiteboardSessionId}/messages/${messageId}`, {
        pinned: !currentlyPinned,
      });
    } catch (err) {
      setMessages(prevMessages);
      setError(err instanceof Error ? err.message : "Could not pin that message.");
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
  const pinnedMessages = messages.filter((m) => m.pinnedAt && !m.isSystemMessage);

  return (
    <div className="flex flex-col h-full">
      {pinnedMessages.length > 0 && (
        <div className={`mb-2 rounded-lg border overflow-hidden shrink-0 ${theme === "dark" ? "border-amber-700/50 bg-amber-950/20" : "border-amber-300 bg-amber-50"}`}>
          {pinnedMessages.map((m) => (
            <div key={m.id} className={`flex items-start gap-2 px-2.5 py-1.5 text-xs ${theme === "dark" ? "text-amber-200" : "text-amber-900"}`}>
              <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">push_pin</span>
              <div className="min-w-0 flex-1">
                <span className="font-bold">{m.authorName}: </span>
                <span className="break-words">{m.body}</span>
              </div>
              {role === "TEACHER" && (
                <button
                  type="button"
                  onClick={() => handleTogglePin(m.id, true)}
                  title="Unpin"
                  className="shrink-0 opacity-70 hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
        {loading ? (
          <p className={`text-sm text-center mt-8 ${t.loading}`}>Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className={`text-sm text-center mt-8 ${t.empty}`}>No messages yet.</p>
        ) : (
          messages.map((m) => {
            if (m.isSystemMessage) {
              const isJoin = m.body.toLowerCase().includes("joined");
              const initial = (m.authorName || "S").trim().charAt(0).toUpperCase();

              return (
                <div key={m.id} className="flex justify-center my-2">
                  {isJoin ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300 shadow-2xs">
                      {m.authorPhotoUrl ? (
                        <img
                          src={m.authorPhotoUrl}
                          alt={m.authorName}
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {initial}
                        </div>
                      )}
                      <span>{m.body}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      <span>{m.body}</span>
                    </div>
                  )}
                </div>
              );
            }
            const mine = m.authorUserId === currentUserId;
            const isTeacher = m.authorRole === "TEACHER";
            const initial = (m.authorName || "S").trim().charAt(0).toUpperCase();

            // Avatar color hash for students
            const avatarBgColors = [
              "bg-blue-500",
              "bg-emerald-600",
              "bg-amber-600",
              "bg-cyan-600",
              "bg-rose-500",
              "bg-blue-600",
              "bg-teal-600",
            ];
            let hash = 0;
            for (let i = 0; i < (m.authorUserId || "").length; i++) {
              hash = (hash + m.authorUserId.charCodeAt(i)) % avatarBgColors.length;
            }
            const avatarBg = isTeacher ? "bg-[#a33900]" : mine ? "bg-blue-600" : avatarBgColors[hash];

            const timeStr = m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div key={m.id} className="flex items-start gap-2.5 my-2.5 group">
                {/* 1. Student / Educator Profile Photo */}
                <div className="shrink-0 pt-0.5">
                  {m.authorPhotoUrl ? (
                    <img
                      src={m.authorPhotoUrl}
                      alt={m.authorName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs select-none ${avatarBg}`}
                    >
                      {initial}
                    </div>
                  )}
                </div>

                {/* 2. Beside photo: Student name on top, message box underneath */}
                <div className="flex-1 min-w-0">
                  {/* Name line with WCAG high contrast */}
                  <div className="flex items-center gap-1.5 leading-none">
                    <span
                      className={`text-xs font-bold truncate ${
                        isTeacher
                          ? "text-[#992600] dark:text-orange-400"
                          : mine
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {m.authorName}
                    </span>

                    {isTeacher && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/70 text-[#a33900] dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 uppercase tracking-wider">
                        Educator
                      </span>
                    )}

                    {m.source === "YOUTUBE" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600/15 text-red-500 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        YouTube
                      </span>
                    )}

                    {mine && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        (You)
                      </span>
                    )}

                    {timeStr && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto tabular-nums">
                        {timeStr}
                      </span>
                    )}

                    {role === "TEACHER" && !m.id.startsWith("opt_") && (
                      <button
                        type="button"
                        onClick={() => handleTogglePin(m.id, Boolean(m.pinnedAt))}
                        title={m.pinnedAt ? "Unpin this message" : "Pin this message"}
                        className={`transition-opacity shrink-0 ${
                          m.pinnedAt ? "text-amber-500" : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-500"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">push_pin</span>
                      </button>
                    )}
                  </div>

                  {/* 3. Message box underneath the name */}
                  <div
                    className={`mt-1.5 rounded-2xl px-3.5 py-2 text-xs sm:text-sm break-words leading-relaxed shadow-xs ${
                      isTeacher
                        ? "bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 text-slate-900 dark:text-slate-100 rounded-tl-sm"
                        : mine
                        ? "bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-slate-900 dark:text-slate-100 rounded-tl-sm"
                        : theme === "dark"
                        ? "bg-[#181a24] border border-[#2d2e3b] text-slate-200 rounded-tl-sm"
                        : "bg-slate-100/90 border border-slate-200/90 text-slate-800 rounded-tl-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
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
