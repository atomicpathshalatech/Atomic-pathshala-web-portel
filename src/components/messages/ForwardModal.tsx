"use client";

import React, { useState } from "react";
import type { ConversationSummary, MessageItem } from "@/lib/messages/messaging-service";
import { ChatAvatar } from "./ChatAvatar";

export function ForwardModal({
  messagesToForward,
  conversations,
  onForward,
  onClose,
}: {
  messagesToForward: MessageItem[];
  conversations: ConversationSummary[];
  onForward: (targetConvIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filtered = conversations.filter((c) => {
    const name = c.title || c.otherParticipant?.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSend = async () => {
    if (selectedConvIds.length === 0) return;
    setForwarding(true);
    try {
      await onForward(selectedConvIds);
      onClose();
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Forward {messagesToForward.length} message{messagesToForward.length > 1 ? "s" : ""} to
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#202c33] px-3 py-1.5 rounded-xl text-sm">
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">No chats found</p>
          ) : (
            filtered.map((c) => {
              const isSel = selectedConvIds.includes(c.id);
              const name = c.title || c.otherParticipant?.name || "Chat";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleSelect(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                    isSel
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChatAvatar
                      name={name}
                      photoUrl={c.iconUrl || c.otherParticipant?.photoUrl}
                      size={40}
                      type={c.type}
                    />
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.otherParticipant?.role || "Member"}</p>
                    </div>
                  </div>

                  <span className={`material-symbols-outlined text-xl ${isSel ? "text-emerald-600" : "text-slate-300"}`}>
                    {isSel ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-[#182229] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {selectedConvIds.length} chat{selectedConvIds.length === 1 ? "" : "s"} selected
          </span>

          <button
            type="button"
            disabled={selectedConvIds.length === 0 || forwarding}
            onClick={handleSend}
            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-sm font-semibold flex items-center gap-1.5 shadow-md transition"
          >
            <span className={`material-symbols-outlined text-base ${forwarding ? "animate-spin" : ""}`}>
              {forwarding ? "progress_activity" : "send"}
            </span>
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}
