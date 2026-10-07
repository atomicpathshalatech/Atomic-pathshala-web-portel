"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatAvatar } from "./ChatAvatar";
import type { ConversationSummary } from "@/lib/messages/messaging-service";

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
export const clock = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });

export function listTime(d: string | Date) {
  const k = dayKey(d);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (k === today) return clock(d);
  if (k === yesterday) return "Yesterday";
  const date = new Date(d);
  if (Date.now() - date.getTime() < 6 * 86_400_000)
    return date.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" });
  return date.toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ChatRow({
  conversation,
  active,
  currentUserId,
  isTyping,
  onClick,
  onPin,
  onMute,
  onArchive,
}: {
  conversation: ConversationSummary;
  active: boolean;
  currentUserId: string;
  isTyping?: boolean;
  onClick: () => void;
  onPin?: (convId: string, pinned: boolean) => void;
  onMute?: (convId: string, muted: boolean) => void;
  onArchive?: (convId: string, archived: boolean) => void;
}) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);

  const {
    id,
    type,
    title,
    otherParticipant,
    lastMessage,
    unreadCount,
    updatedAt,
    isPinned,
    isMuted,
    isArchived,
  } = conversation;

  const displayName =
    title ||
    otherParticipant?.name ||
    (type === "STUDENT_ADMIN" || type === "TEACHER_ADMIN" ? "Admin Support Desk" : "Conversation");

  const lastMsgIsMine = lastMessage?.senderUserId === currentUserId;
  const isRead = !!lastMessage?.readAt;

  // Format badge tag
  let badge: { label: string; cls: string } | null = null;
  if (type === "BATCH_GROUP") {
    badge = { label: "Batch", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" };
  } else if (type === "DOUBT_EXPERT") {
    badge = { label: "Doubt", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" };
  } else if (otherParticipant.role === "TEACHER") {
    badge = { label: "Teacher", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" };
  } else if (otherParticipant.role === "ADMIN") {
    badge = { label: "Admin", cls: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" };
  }

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  useEffect(() => {
    const close = () => setContextMenuOpen(false);
    if (contextMenuOpen) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [contextMenuOpen]);

  // Last message snippet text
  const renderPreview = () => {
    if (isTyping) {
      return (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 italic animate-pulse">
          <span className="material-symbols-outlined text-[14px]">edit</span>
          typing...
        </span>
      );
    }

    if (!lastMessage) {
      return <span className="text-slate-400 italic">No messages yet</span>;
    }

    return (
      <div className="flex items-center gap-1 truncate">
        {lastMsgIsMine && (
          <span
            className={`material-symbols-outlined text-[15px] shrink-0 ${
              isRead ? "text-sky-500" : "text-slate-400"
            }`}
          >
            done_all
          </span>
        )}
        {lastMessage.mediaType === "IMAGE" && (
          <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">photo_camera</span>
        )}
        {lastMessage.mediaType === "VIDEO" && (
          <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">videocam</span>
        )}
        {lastMessage.mediaType === "VOICE" && (
          <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">mic</span>
        )}
        {lastMessage.mediaType === "DOCUMENT" && (
          <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">description</span>
        )}
        <span className="truncate">
          {lastMessage.body ||
            (lastMessage.mediaType === "IMAGE"
              ? "Photo"
              : lastMessage.mediaType === "VIDEO"
              ? "Video"
              : lastMessage.mediaType === "VOICE"
              ? "Voice message"
              : lastMessage.mediaType === "DOCUMENT"
              ? lastMessage.mediaName || "Document"
              : "Message")}
        </span>
      </div>
    );
  };

  return (
    <div ref={rowRef} onContextMenu={handleContextMenu} className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors border-l-[3px] ${
          active
            ? "bg-[#f0f2f5] dark:bg-[#202c33] border-emerald-600 shadow-sm"
            : "border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/40"
        }`}
      >
        <ChatAvatar
          name={displayName}
          photoUrl={conversation.iconUrl || otherParticipant.photoUrl}
          size={48}
          type={type}
          isOnline={otherParticipant.isOnline}
        />

        <div className="flex-1 min-w-0 border-b border-slate-100 dark:border-slate-800/80 pb-2.5 -mb-2.5">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </span>
              {badge && (
                <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
            </div>

            <span
              className={`text-[11.5px] shrink-0 ${
                unreadCount > 0
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {listTime(updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <div
              className={`text-[13px] truncate flex-1 min-w-0 ${
                unreadCount > 0
                  ? "text-slate-900 dark:text-white font-semibold"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {renderPreview()}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isMuted && (
                <span className="material-symbols-outlined text-[15px] text-slate-400" title="Muted">
                  volume_off
                </span>
              )}
              {isPinned && (
                <span className="material-symbols-outlined text-[15px] text-slate-400 -rotate-45" title="Pinned">
                  push_pin
                </span>
              )}
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Context Menu */}
      {contextMenuOpen && (
        <div
          style={{ top: Math.min(menuPos.y, window.innerHeight - 200), left: Math.min(menuPos.x, window.innerWidth - 200) }}
          className="fixed z-50 w-48 rounded-xl bg-white dark:bg-[#233138] shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 text-sm text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onPin?.(id, !isPinned);
              setContextMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
          >
            <span className="material-symbols-outlined text-base">{isPinned ? "keep_off" : "push_pin"}</span>
            {isPinned ? "Unpin chat" : "Pin chat"}
          </button>

          <button
            type="button"
            onClick={() => {
              onMute?.(id, !isMuted);
              setContextMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
          >
            <span className="material-symbols-outlined text-base">{isMuted ? "volume_up" : "volume_off"}</span>
            {isMuted ? "Unmute notifications" : "Mute notifications"}
          </button>

          <button
            type="button"
            onClick={() => {
              onArchive?.(id, !isArchived);
              setContextMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
          >
            <span className="material-symbols-outlined text-base">{isArchived ? "unarchive" : "archive"}</span>
            {isArchived ? "Unarchive chat" : "Archive chat"}
          </button>
        </div>
      )}
    </div>
  );
}
