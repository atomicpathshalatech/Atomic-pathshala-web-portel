"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import type { MessageItem } from "@/lib/messages/messaging-service";
import { VoiceRecorder } from "./VoiceRecorder";

const EMOJIS = [
  "👍", "🙏", "😊", "😂", "❤️", "👌", "🔥", "🤔", "😅", "✅", "📚", "🎯", "💯", "👏", "😢", "😮",
  "🎉", "🚀", "💡", "🙌", "✨", "💪", "🤩", "📖", "🎓", "⚡", "🤝", "🥳", "😇", "🏆", "🌟", "✍️",
];

export function ChatComposer({
  value,
  onChange,
  onSend,
  onSendMedia,
  onTyping,
  sending = false,
  replyingTo = null,
  onCancelReply,
  editingMessage = null,
  onCancelEdit,
  placeholder = "Type a message...",
  disabled = false,
  disabledReason,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onSendMedia: (file: File, type: "IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE") => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  sending?: boolean;
  replyingTo?: MessageItem | null;
  onCancelReply?: () => void;
  editingMessage?: MessageItem | null;
  onCancelEdit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<"IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE">("IMAGE");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const typingTimer = useRef<any>(null);

  // Grow with text up to ~140px
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight > 0 ? `${Math.min(el.scrollHeight, 140)}px` : "";
  }, [value]);

  const handleTextChange = (text: string) => {
    onChange(text);
    if (onTyping) {
      onTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        onTyping(false);
      }, 2500);
    }
  };

  const insertEmoji = (e: string) => {
    const el = ta.current;
    if (!el) return handleTextChange(value + e);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    handleTextChange(value.slice(0, start) + e + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + e.length;
    });
  };

  const handleFileClick = (type: "IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE") => {
    setSelectedMediaType(type);
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      if (type === "IMAGE") fileInputRef.current.accept = "image/*";
      else if (type === "VIDEO") fileInputRef.current.accept = "video/*";
      else if (type === "DOCUMENT") fileInputRef.current.accept = ".pdf,.doc,.docx,.ppt,.pptx,.txt";
      else if (type === "VOICE") fileInputRef.current.accept = "audio/*";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onSendMedia(file, selectedMediaType);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVoiceNote = async (audioBlob: Blob, durationSec: number) => {
    const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
    await onSendMedia(file, "VOICE");
    setIsRecordingVoice(false);
  };

  const canSend = (value.trim().length > 0 || !!editingMessage) && !sending;

  if (disabled) {
    return (
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined text-sm align-middle mr-1">lock</span>
        {disabledReason || "Only administrators can send messages in this group."}
      </div>
    );
  }

  if (isRecordingVoice) {
    return (
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <VoiceRecorder onSendVoice={handleVoiceNote} onCancel={() => setIsRecordingVoice(false)} />
      </div>
    );
  }

  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-200/60 dark:border-slate-800">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Replying Banner */}
      {replyingTo && (
        <div className="max-w-4xl mx-auto mb-2 p-2 rounded-xl bg-white dark:bg-[#111b21] border-l-4 border-emerald-500 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-1 duration-150">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[11.5px] font-bold text-emerald-600 dark:text-emerald-400">
              Replying to {replyingTo.senderName}
            </p>
            <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
              {replyingTo.mediaType && `[${replyingTo.mediaType}] `}
              {replyingTo.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="max-w-4xl mx-auto mb-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-1 duration-150">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[11.5px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">edit</span> Editing Message
            </p>
            <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
              {editingMessage.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-7 h-7 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center justify-center text-amber-600"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Emoji Palette */}
      {showEmoji && (
        <div className="max-w-4xl mx-auto mb-2 grid grid-cols-8 sm:grid-cols-16 gap-1 p-2 rounded-2xl bg-white dark:bg-[#111b21] shadow-lg border border-slate-200 dark:border-slate-800">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="text-xl h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachMenu && (
        <div className="max-w-4xl mx-auto mb-2 p-3 rounded-2xl bg-white dark:bg-[#233138] shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-150">
          <button
            type="button"
            onClick={() => handleFileClick("IMAGE")}
            className="flex flex-col items-center gap-1 group text-slate-700 dark:text-slate-200"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500 group-hover:scale-110 text-white flex items-center justify-center shadow-md transition">
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
            </div>
            <span className="text-[11px] font-medium">Photos</span>
          </button>

          <button
            type="button"
            onClick={() => handleFileClick("VIDEO")}
            className="flex flex-col items-center gap-1 group text-slate-700 dark:text-slate-200"
          >
            <div className="w-12 h-12 rounded-full bg-pink-500 group-hover:scale-110 text-white flex items-center justify-center shadow-md transition">
              <span className="material-symbols-outlined text-2xl">videocam</span>
            </div>
            <span className="text-[11px] font-medium">Video</span>
          </button>

          <button
            type="button"
            onClick={() => handleFileClick("DOCUMENT")}
            className="flex flex-col items-center gap-1 group text-slate-700 dark:text-slate-200"
          >
            <div className="w-12 h-12 rounded-full bg-purple-600 group-hover:scale-110 text-white flex items-center justify-center shadow-md transition">
              <span className="material-symbols-outlined text-2xl">description</span>
            </div>
            <span className="text-[11px] font-medium">Document</span>
          </button>

          <button
            type="button"
            onClick={() => handleFileClick("VOICE")}
            className="flex flex-col items-center gap-1 group text-slate-700 dark:text-slate-200"
          >
            <div className="w-12 h-12 rounded-full bg-orange-500 group-hover:scale-110 text-white flex items-center justify-center shadow-md transition">
              <span className="material-symbols-outlined text-2xl">audio_file</span>
            </div>
            <span className="text-[11px] font-medium">Audio</span>
          </button>
        </div>
      )}

      {/* Main Composer Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
        className="max-w-4xl mx-auto flex items-end gap-2"
      >
        <div className="flex-1 flex items-end gap-1 rounded-3xl bg-white dark:bg-[#2a3942] px-2 py-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition ${
              showEmoji ? "text-emerald-600" : "text-slate-500 dark:text-slate-300 hover:text-slate-800"
            }`}
            title="Emoji"
          >
            <span className="material-symbols-outlined text-xl">{showEmoji ? "keyboard" : "mood"}</span>
          </button>

          {/* Attach Button */}
          <button
            type="button"
            onClick={() => setShowAttachMenu((v) => !v)}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition ${
              showAttachMenu ? "text-emerald-600 rotate-45" : "text-slate-500 dark:text-slate-300 hover:text-slate-800"
            }`}
            title="Attach file"
          >
            <span className="material-symbols-outlined text-xl">attach_file</span>
          </button>

          {/* Auto-sizing Text Input */}
          <textarea
            ref={ta}
            rows={1}
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder={placeholder}
            className="flex-1 min-w-0 min-h-[36px] resize-none border-0 shadow-none focus:ring-0 bg-transparent px-1 py-2 text-[15px] leading-5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Action Button: Send or Voice Recorder */}
        {value.trim().length > 0 || editingMessage ? (
          <button
            type="submit"
            disabled={!canSend}
            className="w-11 h-11 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white flex items-center justify-center shadow-md transition active:scale-95"
            title="Send"
          >
            <span className={`material-symbols-outlined text-xl ${sending ? "animate-spin" : ""}`}>
              {sending ? "progress_activity" : editingMessage ? "check" : "send"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(true)}
            className="w-11 h-11 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition active:scale-95"
            title="Hold/Click to record voice"
          >
            <span className="material-symbols-outlined text-xl">mic</span>
          </button>
        )}
      </form>
    </div>
  );
}
