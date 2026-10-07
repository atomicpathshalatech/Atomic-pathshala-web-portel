"use client";

import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import type { MessageItem } from "@/lib/messages/messaging-service";
import { ChatMessageBubble } from "./ChatMessageBubble";

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });

function dayLabel(d: string | Date) {
  const k = dayKey(d);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  const date = new Date(d);
  if (Date.now() - date.getTime() < 6 * 86_400_000)
    return date.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long" });
  return date.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "long", year: "numeric" });
}

/** Signature WhatsApp doodle wallpaper as high-efficiency data URI */
const WALLPAPER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='%2394a3b8' stroke-opacity='0.16' stroke-width='1.4'><circle cx='18' cy='20' r='6'/><path d='M60 14l6 10H54z'/><rect x='92' y='14' width='12' height='12' rx='3'/><path d='M14 70c6-8 14-8 20 0'/><circle cx='64' cy='66' r='3'/><path d='M90 60l12 12M102 60L90 72'/><path d='M20 104h14M27 97v14'/><path d='M56 100q8-10 16 0'/><circle cx='98' cy='102' r='5'/></g></svg>\")";

export function ChatStream({
  messages,
  currentUserId,
  loading = false,
  hasMore = false,
  showSenderNames = false,
  emptyHint,
  onLoadMore,
  onReply,
  onReact,
  onStar,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onOpenMedia,
  selectedMsgIds = [],
  isSelectMode = false,
  onToggleSelect,
}: {
  messages: MessageItem[];
  currentUserId: string;
  loading?: boolean;
  hasMore?: boolean;
  showSenderNames?: boolean;
  emptyHint?: string;
  onLoadMore?: () => void;
  onReply?: (msg: MessageItem) => void;
  onReact?: (msgId: string, emoji: string) => void;
  onStar?: (msgId: string) => void;
  onPin?: (msgId: string) => void;
  onForward?: (msg: MessageItem) => void;
  onEdit?: (msg: MessageItem) => void;
  onDelete?: (msgId: string, mode: "ME" | "EVERYONE") => void;
  onOpenMedia?: (mediaUrl: string, mediaType: string, mediaName?: string) => void;
  selectedMsgIds?: string[];
  isSelectMode?: boolean;
  onToggleSelect?: (msgId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [unreadCountBelow, setUnreadCountBelow] = useState(0);

  // Smooth jump to reply quote or pinned message
  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-500", "rounded-xl");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500", "rounded-xl");
      }, 1500);
    }
  };

  // Find pinned message if any
  const pinnedMessage = messages.find((m) => !!m.pinnedAt && !m.isDeleted);

  // Auto-scroll to bottom on incoming messages if pinned to bottom
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = atBottom;
    setShowJump(!atBottom);

    // Infinite scroll to top
    if (el.scrollTop < 60 && hasMore && onLoadMore && !loading) {
      onLoadMore();
    }
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Pinned Message Header Banner */}
      {pinnedMessage && (
        <div
          onClick={() => jumpToMessage(pinnedMessage.id)}
          className="z-20 bg-white/95 dark:bg-[#1f2c34]/95 backdrop-blur-md px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition shadow-sm"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-amber-500 text-lg -rotate-45">push_pin</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Pinned Message</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 truncate">
                {pinnedMessage.body || "Media attachment"}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-sm text-slate-400">arrow_downward</span>
        </div>
      )}

      {/* Message Stream */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-[#efeae2] dark:bg-[#0b141a] transition-colors"
        style={{ backgroundImage: WALLPAPER }}
      >
        {loading && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600">progress_activity</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-xs text-center rounded-2xl bg-[#fff8c4] dark:bg-[#182229] text-[12px] text-slate-700 dark:text-slate-300 px-4 py-3 shadow-md border border-amber-200/50 dark:border-amber-900/30">
              <span className="material-symbols-outlined text-lg align-middle mr-1 text-amber-600">lock</span>
              {emptyHint ?? "Say hi! Messages in this chat are secure."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px] max-w-4xl mx-auto pb-4">
            {/* Top Load More Indicator */}
            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="px-3 py-1 text-xs font-semibold rounded-full bg-white dark:bg-[#182229] shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  {loading ? "Loading older messages..." : "Load older messages"}
                </button>
              </div>
            )}

            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const firstOfRun = newDay || !prev || prev.senderUserId !== m.senderUserId;

              return (
                <React.Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center my-3 sticky top-2 z-10">
                      <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-[#182229]/95 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/60 dark:border-slate-800">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}

                  <ChatMessageBubble
                    message={m}
                    currentUserId={currentUserId}
                    showSenderName={showSenderNames}
                    firstOfRun={firstOfRun}
                    isSelectMode={isSelectMode}
                    isSelected={selectedMsgIds.includes(m.id)}
                    onSelect={onToggleSelect}
                    onReply={onReply}
                    onReact={onReact}
                    onStar={onStar}
                    onPin={onPin}
                    onForward={onForward}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onJumpToReply={jumpToMessage}
                    onOpenMedia={onOpenMedia}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Jump to Latest Floating Button */}
      {showJump && (
        <button
          type="button"
          onClick={() => {
            const el = containerRef.current;
            if (el) {
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              stickToBottom.current = true;
            }
          }}
          className="absolute right-5 bottom-4 w-11 h-11 rounded-full bg-white dark:bg-[#202c33] shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-110 active:scale-95 transition z-20"
          aria-label="Jump to latest"
        >
          <span className="material-symbols-outlined text-2xl">keyboard_double_arrow_down</span>
        </button>
      )}
    </div>
  );
}
