"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/events";
import { getJson, postJson } from "./lib";

export type ClassroomChatMessage = {
  id: string;
  authorRole: "TEACHER" | "STUDENT";
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
  pinnedAt?: string | null;
};

/** Classroom's own chat — independent of Whiteboard's MessagesPanel/WhiteboardMessage, and never YouTube's live chat. */
export function ChatPanel({
  classroomSessionId,
  currentUserId,
  role,
}: {
  classroomSessionId: string;
  currentUserId: string;
  role: "TEACHER" | "STUDENT";
}) {
  const [messages, setMessages] = useState<ClassroomChatMessage[]>([]);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getJson(`/api/classroom/sessions/${classroomSessionId}/messages`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setChatEnabled(data.chatEnabled);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classroomSessionId]);

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(classroomChannel(classroomSessionId));
    const onMessage = (payload: ClassroomChatMessage) => setMessages((prev) => [...prev, payload]);
    channel.bind(CLASSROOM_EVENTS.MESSAGE_SENT, onMessage);
    return () => {
      channel.unbind(CLASSROOM_EVENTS.MESSAGE_SENT, onMessage);
      client.unsubscribe(classroomChannel(classroomSessionId));
    };
  }, [classroomSessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    try {
      await postJson(`/api/classroom/sessions/${classroomSessionId}/messages`, { body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading && <p className="text-xs text-gray-500 text-center py-4">Loading chat...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No messages yet — say hello!</p>
        )}
        {messages.map((m) => {
          const mine = m.authorUserId === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-gray-500 px-1">
                {m.authorName} {m.authorRole === "TEACHER" && "· Teacher"}
              </span>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-blue-600 text-white" : "bg-[#1e1f2b] border border-[#2d2e3b] text-gray-200"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400 px-3 py-1">{error}</p>}
      {chatEnabled ? (
        <div className="flex items-center gap-2 border-t border-[#2d2e3b] p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-[#2d2e3b] bg-[#10131b] text-white placeholder:text-gray-500 px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 border-t border-[#2d2e3b] px-3 py-2 text-center">
          {role === "TEACHER" ? "Chat is turned off." : "The teacher has turned off chat for this class."}
        </p>
      )}
    </div>
  );
}
