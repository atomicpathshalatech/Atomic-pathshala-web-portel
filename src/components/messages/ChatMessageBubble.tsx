"use client";

import React, { useState, useRef } from "react";
import type { MessageItem } from "@/lib/messages/messaging-service";
import { toneFor } from "./ChatAvatar";

const clock = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function ChatMessageBubble({
  message,
  currentUserId,
  showSenderName = false,
  firstOfRun = false,
  isSelectMode = false,
  isSelected = false,
  onSelect,
  onReply,
  onReact,
  onStar,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onJumpToReply,
  onOpenMedia,
}: {
  message: MessageItem;
  currentUserId: string;
  showSenderName?: boolean;
  firstOfRun?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (msgId: string) => void;
  onReply?: (msg: MessageItem) => void;
  onReact?: (msgId: string, emoji: string) => void;
  onStar?: (msgId: string) => void;
  onPin?: (msgId: string) => void;
  onForward?: (msg: MessageItem) => void;
  onEdit?: (msg: MessageItem) => void;
  onDelete?: (msgId: string, mode: "ME" | "EVERYONE") => void;
  onJumpToReply?: (replyToId: string) => void;
  onOpenMedia?: (mediaUrl: string, mediaType: string, mediaName?: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<1 | 1.5 | 2>(1);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const mine = message.isSelf || message.senderUserId === currentUserId;
  const isDeleted = message.isDeleted;

  // Toggle voice playback
  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.playbackRate = audioSpeed;
      audioRef.current.play();
      setAudioPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = audioSpeed === 1 ? 1.5 : audioSpeed === 1.5 ? 2 : 1;
    setAudioSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Status icon
  const renderStatus = () => {
    if (!mine) return null;
    if (message.pending || message.status === "sending") {
      return <span className="material-symbols-outlined text-[14px] text-slate-400" title="Sending">schedule</span>;
    }
    if (message.status === "read" || message.readAt) {
      return <span className="material-symbols-outlined text-[15px] text-sky-500 font-bold" title="Read">done_all</span>;
    }
    if (message.status === "delivered" || message.deliveredAt) {
      return <span className="material-symbols-outlined text-[15px] text-slate-400 font-semibold" title="Delivered">done_all</span>;
    }
    return <span className="material-symbols-outlined text-[14px] text-slate-400" title="Sent">done</span>;
  };

  // Reactions summary list
  const reactionEntries = Object.entries(message.reactions || {}).filter(([_, users]) => users && users.length > 0);

  return (
    <div
      id={`msg-${message.id}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowMenu(false);
        setShowEmojiPicker(false);
      }}
      className={`group relative flex items-center gap-2 transition-colors ${
        mine ? "justify-end" : "justify-start"
      } ${firstOfRun ? "mt-2" : "mt-0.5"} ${isSelected ? "bg-emerald-500/10 py-1 rounded-lg" : ""}`}
    >
      {/* Select Mode Checkbox */}
      {isSelectMode && (
        <button
          type="button"
          onClick={() => onSelect?.(message.id)}
          className="shrink-0 p-1 text-emerald-600 hover:scale-110 transition"
        >
          <span className="material-symbols-outlined text-xl">
            {isSelected ? "check_circle" : "radio_button_unchecked"}
          </span>
        </button>
      )}

      {/* Hover Quick Reaction & Actions Trigger (For Left messages, actions on Right; for Right messages, actions on Left) */}
      {showActions && !isSelectMode && (
        <div
          className={`absolute top-0 z-20 flex items-center gap-1 bg-white dark:bg-[#202c33] shadow-md rounded-full px-2 py-1 border border-slate-200 dark:border-slate-700 animate-in fade-in duration-100 ${
            mine ? "right-full mr-2" : "left-full ml-2"
          }`}
        >
          {/* Quick Emoji Bar */}
          <div className="flex items-center gap-0.5">
            {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message.id, emoji)}
                className="hover:scale-125 transition text-base p-1"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-0.5"
              title="Add reaction"
            >
              <span className="material-symbols-outlined text-base">add_reaction</span>
            </button>
          </div>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Reply Button */}
          <button
            type="button"
            onClick={() => onReply?.(message)}
            className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full"
            title="Reply"
          >
            <span className="material-symbols-outlined text-[17px]">reply</span>
          </button>

          {/* Options Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full"
            title="More"
          >
            <span className="material-symbols-outlined text-[17px]">expand_more</span>
          </button>
        </div>
      )}

      {/* Expanded Emoji Picker */}
      {showEmojiPicker && (
        <div
          className={`absolute z-30 top-8 bg-white dark:bg-[#202c33] shadow-xl border border-slate-200 dark:border-slate-700 p-2 rounded-2xl flex gap-1 ${
            mine ? "right-full mr-2" : "left-full ml-2"
          }`}
        >
          {["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "💯", "🤔", "✅"].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onReact?.(message.id, e);
                setShowEmojiPicker(false);
              }}
              className="hover:scale-125 transition text-xl p-1"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* More Options Dropdown */}
      {showMenu && (
        <div
          className={`absolute z-30 top-8 w-44 bg-white dark:bg-[#233138] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in duration-100 ${
            mine ? "right-full mr-2" : "left-full ml-2"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onReply?.(message);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">reply</span>
            Reply
          </button>

          <button
            type="button"
            onClick={() => {
              onForward?.(message);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">forward</span>
            Forward
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(message.body);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            Copy text
          </button>

          <button
            type="button"
            onClick={() => {
              onStar?.(message.id);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">{message.isStarred ? "star" : "star_border"}</span>
            {message.isStarred ? "Unstar message" : "Star message"}
          </button>

          <button
            type="button"
            onClick={() => {
              onPin?.(message.id);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">push_pin</span>
            {message.pinnedAt ? "Unpin message" : "Pin message"}
          </button>

          {mine && !isDeleted && (
            <button
              type="button"
              onClick={() => {
                onEdit?.(message);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit message
            </button>
          )}

          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

          <button
            type="button"
            onClick={() => {
              onDelete?.(message.id, "ME");
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Delete for me
          </button>

          {mine && (
            <button
              type="button"
              onClick={() => {
                onDelete?.(message.id, "EVERYONE");
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">delete_forever</span>
              Delete for everyone
            </button>
          )}
        </div>
      )}

      {/* Main Message Bubble */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] px-3 pt-2 pb-1.5 rounded-2xl shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
          mine
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white"
            : "bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100"
        } ${firstOfRun ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""} ${
          message.pending ? "opacity-75" : ""
        }`}
      >
        {/* Signature Tail */}
        {firstOfRun && (
          <span
            aria-hidden
            className={`absolute top-0 w-2.5 h-3 ${
              mine ? "-right-2.5 bg-[#d9fdd3] dark:bg-[#005c4b]" : "-left-2.5 bg-white dark:bg-[#202c33]"
            }`}
            style={{ clipPath: mine ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        )}

        {/* Pinned Marker */}
        {message.pinnedAt && (
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
            <span className="material-symbols-outlined text-xs -rotate-45">push_pin</span>
            Pinned message
          </div>
        )}

        {/* Forwarded Header */}
        {message.isForwarded && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-400 italic mb-1">
            <span className="material-symbols-outlined text-xs">forward</span>
            Forwarded
          </div>
        )}

        {/* Sender Name in Group / Desk Thread */}
        {!mine && showSenderName && firstOfRun && (
          <p className={`text-[12px] font-bold mb-1 bg-gradient-to-r ${toneFor(message.senderName)} bg-clip-text text-transparent`}>
            {message.senderName}
            {message.senderRole && (
              <span className="text-slate-400 font-normal text-[11px]"> · {message.senderRole.toLowerCase()}</span>
            )}
          </p>
        )}

        {/* Quoted Message Snippet */}
        {message.replyToMessage && (
          <div
            onClick={() => message.replyToId && onJumpToReply?.(message.replyToId)}
            className="mb-1.5 p-2 rounded-lg bg-black/5 dark:bg-black/20 border-l-4 border-emerald-500 cursor-pointer hover:bg-black/10 transition text-left"
          >
            <p className="text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
              {message.replyToMessage.senderName}
            </p>
            <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
              {message.replyToMessage.mediaType && `[${message.replyToMessage.mediaType}] `}
              {message.replyToMessage.body}
            </p>
          </div>
        )}

        {/* Deleted Message State */}
        {isDeleted ? (
          <p className="text-[13.5px] italic text-slate-400 dark:text-slate-400 flex items-center gap-1.5 py-1">
            <span className="material-symbols-outlined text-base">block</span>
            This message was deleted
          </p>
        ) : (
          <>
            {/* Media: Image */}
            {message.mediaType === "IMAGE" && message.mediaUrl && (
              <div
                onClick={() => onOpenMedia?.(message.mediaUrl!, "IMAGE", message.mediaName || undefined)}
                className="mb-1.5 rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition max-w-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.mediaUrl}
                  alt={message.mediaName || "Image"}
                  className="w-full max-h-72 object-cover rounded-xl"
                  loading="lazy"
                />
              </div>
            )}

            {/* Media: Video */}
            {message.mediaType === "VIDEO" && message.mediaUrl && (
              <div className="mb-1.5 rounded-xl overflow-hidden max-w-sm">
                <video
                  src={message.mediaUrl}
                  controls
                  className="w-full max-h-72 rounded-xl bg-black"
                  preload="metadata"
                />
              </div>
            )}

            {/* Media: Document / PDF */}
            {message.mediaType === "DOCUMENT" && message.mediaUrl && (
              <div className="mb-1.5 flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-black/25 border border-slate-200/50 dark:border-slate-700/50">
                <span className="material-symbols-outlined text-3xl text-red-500 shrink-0">picture_as_pdf</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {message.mediaName || "Document.pdf"}
                  </p>
                  {message.mediaSize && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(message.mediaSize / (1024 * 1024)).toFixed(1)} MB • Document
                    </p>
                  )}
                </div>
                <a
                  href={message.mediaUrl}
                  download={message.mediaName || "document"}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                </a>
              </div>
            )}

            {/* Media: Audio / Voice Note */}
            {message.mediaType === "VOICE" && message.mediaUrl && (
              <div className="mb-1.5 flex items-center gap-2 p-2 rounded-xl bg-black/5 dark:bg-black/20 min-w-[220px]">
                <audio
                  ref={audioRef}
                  src={message.mediaUrl}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (el.duration) setAudioProgress((el.currentTime / el.duration) * 100);
                  }}
                  onEnded={() => {
                    setAudioPlaying(false);
                    setAudioProgress(0);
                  }}
                  preload="none"
                />

                <button
                  type="button"
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 transition"
                >
                  <span className="material-symbols-outlined text-xl">
                    {audioPlaying ? "pause" : "play_arrow"}
                  </span>
                </button>

                {/* Progress Bar & Waveform Fake Bar */}
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-slate-300 dark:bg-slate-600 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${audioProgress}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Voice note</span>
                    <button
                      type="button"
                      onClick={cycleSpeed}
                      className="font-bold hover:text-emerald-500 transition px-1 rounded bg-black/5 dark:bg-black/20"
                    >
                      {audioSpeed}x
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Text Message Body */}
            {message.body && (
              <p className="text-[14.5px] leading-[1.35] whitespace-pre-wrap break-words">
                {message.body}
                {/* Spacing for time sticker */}
                <span className="inline-block w-[68px]" aria-hidden />
              </p>
            )}
          </>
        )}

        {/* Time + Status + Edited Sticker */}
        <span className="absolute right-2 bottom-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 select-none">
          {message.isStarred && (
            <span className="material-symbols-outlined text-[13px] text-amber-500">star</span>
          )}
          {message.isEdited && <span>edited</span>}
          <span>{clock(message.createdAt)}</span>
          {renderStatus()}
        </span>

        {/* Reaction Badges Row */}
        {reactionEntries.length > 0 && (
          <div className="absolute -bottom-2.5 left-2 flex items-center gap-0.5 z-10 bg-white dark:bg-[#202c33] rounded-full px-1.5 py-0.5 shadow-md border border-slate-200/60 dark:border-slate-700/60 text-[12px]">
            {reactionEntries.map(([emoji, userIds]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message.id, emoji)}
                className="flex items-center gap-0.5 hover:scale-110 transition"
              >
                <span>{emoji}</span>
                {userIds.length > 1 && (
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {userIds.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
