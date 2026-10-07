"use client";

import React, { useState } from "react";
import type { ConversationSummary, MessageItem } from "@/lib/messages/messaging-service";
import { ChatAvatar } from "./ChatAvatar";

export function ChatInfoDrawer({
  conversation,
  messages,
  currentUserId,
  currentUserRole,
  onClose,
  onMuteToggle,
  onGroupSettingsUpdate,
  onJumpToMessage,
}: {
  conversation: ConversationSummary;
  messages: MessageItem[];
  currentUserId: string;
  currentUserRole: string;
  onClose: () => void;
  onMuteToggle: (muted: boolean) => void;
  onGroupSettingsUpdate?: (updates: { onlyAdminsCanPost?: boolean; title?: string }) => void;
  onJumpToMessage?: (msgId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"MEDIA" | "DOCS" | "STARRED" | "MEMBERS">("MEDIA");

  const isAdmin =
    currentUserRole === "SUPER_ADMIN" ||
    currentUserRole === "ADMIN" ||
    currentUserRole === "FOUNDER" ||
    currentUserRole === "SUB_ADMIN" ||
    currentUserRole === "TEACHER";

  const isGroup = conversation.type === "BATCH_GROUP" || conversation.type === "ANNOUNCEMENT";

  // Filter media & docs from messages
  const mediaList = messages.filter((m) => m.mediaUrl && (m.mediaType === "IMAGE" || m.mediaType === "VIDEO") && !m.isDeleted);
  const docsList = messages.filter((m) => m.mediaUrl && m.mediaType === "DOCUMENT" && !m.isDeleted);
  const starredList = messages.filter((m) => m.isStarred && !m.isDeleted);

  const displayName =
    conversation.title ||
    conversation.otherParticipant?.name ||
    (conversation.type === "STUDENT_ADMIN" ? "Admin Support Desk" : "Conversation");

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-[#111b21] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <span className="font-semibold text-slate-900 dark:text-white text-base">
            {isGroup ? "Group Info" : "Contact Info"}
          </span>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        <div className="flex flex-col items-center text-center p-4 bg-slate-50 dark:bg-[#182229] rounded-2xl border border-slate-100 dark:border-slate-800">
          <ChatAvatar
            name={displayName}
            photoUrl={conversation.iconUrl || conversation.otherParticipant?.photoUrl}
            size={84}
            type={conversation.type}
            isOnline={conversation.otherParticipant?.isOnline}
          />
          <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
            {displayName}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {conversation.otherParticipant?.email || "Atomic Pathshala Community"}
          </p>
          {conversation.otherParticipant?.phone && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {conversation.otherParticipant.phone}
            </p>
          )}
          {conversation.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic max-w-xs">
              "{conversation.description}"
            </p>
          )}
        </div>

        {/* Quick Settings */}
        <div className="p-3 bg-slate-50 dark:bg-[#182229] rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-lg text-slate-500">volume_off</span>
              <span>Mute notifications</span>
            </div>
            <input
              type="checkbox"
              checked={conversation.isMuted}
              onChange={(e) => onMuteToggle(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
          </div>

          {isGroup && isAdmin && (
            <div className="flex items-center justify-between py-1 border-t border-slate-200 dark:border-slate-800 pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="material-symbols-outlined text-lg text-amber-500">lock_person</span>
                <span>Only Admins Can Post</span>
              </div>
              <input
                type="checkbox"
                checked={conversation.onlyAdminsCanPost}
                onChange={(e) => onGroupSettingsUpdate?.({ onlyAdminsCanPost: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Tabs: Media / Docs / Starred */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("MEDIA")}
            className={`flex-1 py-2 text-center border-b-2 transition ${
              activeTab === "MEDIA"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Media ({mediaList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DOCS")}
            className={`flex-1 py-2 text-center border-b-2 transition ${
              activeTab === "DOCS"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Docs ({docsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("STARRED")}
            className={`flex-1 py-2 text-center border-b-2 transition ${
              activeTab === "STARRED"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Starred ({starredList.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "MEDIA" && (
          <div className="grid grid-cols-3 gap-2 py-2">
            {mediaList.length === 0 ? (
              <p className="col-span-3 text-center py-6 text-xs text-slate-400">No media shared yet</p>
            ) : (
              mediaList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onJumpToMessage?.(m.id)}
                  className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition bg-slate-100 dark:bg-slate-800 relative group"
                >
                  {m.mediaType === "VIDEO" ? (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-2xl">play_circle</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.mediaUrl!} alt="Media" className="w-full h-full object-cover" />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "DOCS" && (
          <div className="space-y-2 py-2">
            {docsList.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">No documents shared yet</p>
            ) : (
              docsList.map((d) => (
                <div
                  key={d.id}
                  onClick={() => onJumpToMessage?.(d.id)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#182229] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition border border-slate-100 dark:border-slate-800"
                >
                  <span className="material-symbols-outlined text-2xl text-red-500">picture_as_pdf</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {d.mediaName || "Document.pdf"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "STARRED" && (
          <div className="space-y-2 py-2">
            {starredList.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">No starred messages</p>
            ) : (
              starredList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onJumpToMessage?.(s.id)}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182229] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition border border-slate-100 dark:border-slate-800 text-left"
                >
                  <div className="flex justify-between items-center text-[10.5px] text-slate-400 mb-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.senderName}</span>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">{s.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
