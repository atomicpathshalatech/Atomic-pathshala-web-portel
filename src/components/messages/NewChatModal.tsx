"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ChatAvatar } from "./ChatAvatar";

export function NewChatModal({
  currentUserId,
  currentUserRole,
  onStartChat,
  onClose,
}: {
  currentUserId: string;
  currentUserRole: string;
  onStartChat: (recipient: {
    type: "TEACHER" | "STUDENT" | "ADMIN" | "BATCH" | "DOUBT";
    recipientId?: string;
    initialMessage?: string;
    batchId?: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"TEACHERS" | "DOUBTS" | "BATCHES" | "ADMIN">("TEACHERS");
  const [search, setSearch] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [admin, setAdmin] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecipients();
  }, [search]);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/messages/recipients", window.location.origin);
      if (search) url.searchParams.set("q", search);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setTeachers(data.data.teachers || []);
          setStudents(data.data.students || []);
          setBatches(data.data.batches || []);
          setAdmin(data.data.admin || null);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedRecipient) return;
    setSubmitting(true);
    try {
      if (selectedRecipient.type === "BATCH") {
        await onStartChat({
          type: "BATCH",
          batchId: selectedRecipient.id,
          initialMessage: firstMessage.trim() || undefined,
        });
      } else if (selectedRecipient.type === "ADMIN") {
        await onStartChat({
          type: "ADMIN",
          initialMessage: firstMessage.trim() || undefined,
        });
      } else if (selectedRecipient.type === "TEACHER") {
        await onStartChat({
          type: "TEACHER",
          recipientId: selectedRecipient.userId || selectedRecipient.id,
          initialMessage: firstMessage.trim() || undefined,
        });
      } else if (selectedRecipient.type === "STUDENT") {
        await onStartChat({
          type: "STUDENT",
          recipientId: selectedRecipient.userId || selectedRecipient.id,
          initialMessage: firstMessage.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to start chat");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Start a New Conversation
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold px-2 bg-slate-50 dark:bg-[#182229]">
          <button
            type="button"
            onClick={() => {
              setTab("TEACHERS");
              setSelectedRecipient(null);
            }}
            className={`py-3 px-4 border-b-2 transition ${
              tab === "TEACHERS"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Teachers & Faculty
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("BATCHES");
              setSelectedRecipient(null);
            }}
            className={`py-3 px-4 border-b-2 transition ${
              tab === "BATCHES"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Batch Cohorts
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("ADMIN");
              setSelectedRecipient(admin);
            }}
            className={`py-3 px-4 border-b-2 transition ${
              tab === "ADMIN"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Admin Desk
          </button>
        </div>

        {/* Search */}
        {tab !== "ADMIN" && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#202c33] px-3 py-1.5 rounded-xl text-sm">
              <span className="material-symbols-outlined text-slate-400">search</span>
              <input
                type="text"
                placeholder={tab === "TEACHERS" ? "Search faculty..." : "Search batches..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none flex-1 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Recipient List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600">progress_activity</span>
            </div>
          ) : tab === "TEACHERS" ? (
            teachers.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">No teachers found</p>
            ) : (
              teachers.map((t) => {
                const isSel = selectedRecipient?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedRecipient(t)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition ${
                      isSel
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChatAvatar name={t.name} photoUrl={t.photoUrl} size={42} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.subtitle || t.email}</p>
                      </div>
                    </div>
                    {isSel && <span className="material-symbols-outlined text-emerald-600">check_circle</span>}
                  </button>
                );
              })
            )
          ) : tab === "BATCHES" ? (
            batches.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">No batches available</p>
            ) : (
              batches.map((b) => {
                const isSel = selectedRecipient?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedRecipient(b)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition ${
                      isSel
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChatAvatar name={b.name} type="BATCH" size={42} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{b.name}</p>
                        <p className="text-xs text-slate-400">{b.subtitle}</p>
                      </div>
                    </div>
                    {isSel && <span className="material-symbols-outlined text-emerald-600">check_circle</span>}
                  </button>
                );
              })
            )
          ) : (
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-center">
              <span className="material-symbols-outlined text-4xl text-purple-600 mb-2">support_agent</span>
              <h4 className="font-bold text-slate-900 dark:text-white">Admin & Support Desk</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Need help with admissions, subscriptions, batch schedules or technical doubts? Send a message directly to administration.
              </p>
            </div>
          )}
        </div>

        {/* Message Input & Send */}
        {selectedRecipient && (
          <div className="p-3 bg-slate-50 dark:bg-[#182229] border-t border-slate-200 dark:border-slate-800 space-y-2">
            <input
              type="text"
              placeholder={`Say something to ${selectedRecipient.name || "recipient"}... (optional)`}
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#202c33] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleStart}
                className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined text-sm ${submitting ? "animate-spin" : ""}`}>
                  {submitting ? "progress_activity" : "chat"}
                </span>
                Start Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
