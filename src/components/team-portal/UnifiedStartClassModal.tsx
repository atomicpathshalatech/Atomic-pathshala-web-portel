"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  Play,
  Layers,
  Calendar,
  Clock,
} from "lucide-react";
import { extractYouTubeVideoId } from "@/lib/live-class/youtube";

export interface UnifiedStartClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  title: string;
  subjectName?: string | null;
  assignedBatches?: { id: string; name: string }[];
  dateStr?: string | null;
  timeStr?: string | null;
  isLive?: boolean;
  initialTransport?: "LIVEKIT" | "YOUTUBE";
  initialYoutubeId?: string | null;
  onSuccess?: () => void;
}

export function UnifiedStartClassModal({
  isOpen,
  onClose,
  scheduleId,
  title,
  subjectName,
  assignedBatches = [],
  dateStr,
  timeStr,
  isLive = false,
  initialTransport = "LIVEKIT",
  initialYoutubeId = "",
  onSuccess,
}: UnifiedStartClassModalProps) {
  const router = useRouter();

  const [deliveryMode, setDeliveryMode] = useState<"LIVEKIT" | "YOUTUBE">(
    initialTransport === "YOUTUBE" ? "YOUTUBE" : "LIVEKIT"
  );
  const [youtubeUrl, setYoutubeUrl] = useState<string>(initialYoutubeId || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunch = async () => {
    setSubmitting(true);
    setError(null);

    let parsedYtId: string | null = null;
    if (deliveryMode === "YOUTUBE") {
      const trimmed = youtubeUrl.trim();
      if (trimmed) {
        parsedYtId = extractYouTubeVideoId(trimmed);
        if (!parsedYtId && trimmed.length > 0) {
          setError("Please enter a valid YouTube Live URL or 11-character Video ID, or leave it blank to connect OBS inside studio.");
          setSubmitting(false);
          return;
        }
      }
    }

    try {
      // Call preflight to persist the chosen delivery mode
      const res = await fetch(`/api/team/live-class/${scheduleId}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTransport: deliveryMode,
          youtubeVideoId: parsedYtId || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.success && data.error && !isLive) {
        if (data.code !== "ENTRY_TOO_EARLY") {
          toast.info(data.error || "Opening live studio...");
        }
      }

      toast.success(isLive ? "Resuming live session..." : "Opening live studio...");
      if (onSuccess) onSuccess();
      onClose();
      router.push(`/team/live-class/${scheduleId}`);
    } catch (err: any) {
      console.error("Failed to launch live classroom:", err);
      // Fallback: direct navigation even if preflight has minor network glitch
      router.push(`/team/live-class/${scheduleId}`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {isLive ? "Class is Live" : "Start Live Class"}
              </span>
              {subjectName && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {subjectName}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
              {title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-0.5">
              {dateStr && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {dateStr}
                </span>
              )}
              {timeStr && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {timeStr}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Batches badge list */}
          {assignedBatches.length > 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Scheduled in ({assignedBatches.length} batch{assignedBatches.length > 1 ? "es" : ""}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedBatches.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
              Scheduled across all enrolled batches for this chapter.
            </div>
          )}

          {/* Delivery Mode Selection - EXACT 2 OPTIONS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Class Delivery Mode
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: App Class */}
              <div
                onClick={() => setDeliveryMode("LIVEKIT")}
                className={`relative flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition text-left ${
                  deliveryMode === "LIVEKIT"
                    ? "border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <span className="material-symbols-outlined text-base">draw</span>
                    1. App Class
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      deliveryMode === "LIVEKIT"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {deliveryMode === "LIVEKIT" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  Private in-app live class with interactive whiteboard, live chat, doubt solving, and polls.
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  <span className="material-symbols-outlined text-xs">shield_lock</span>
                  <span>Unlisted & Private</span>
                </div>
              </div>

              {/* Option 2: YouTube + App Class */}
              <div
                onClick={() => setDeliveryMode("YOUTUBE")}
                className={`relative flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition text-left ${
                  deliveryMode === "YOUTUBE"
                    ? "border-red-600 dark:border-red-500 bg-red-50/50 dark:bg-red-950/30 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-base">smart_display</span>
                    2. YouTube + App Class
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      deliveryMode === "YOUTUBE"
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {deliveryMode === "YOUTUBE" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  Broadcast live on YouTube channel with synced chat and interactive features in Atomic Pathshala app.
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-semibold">
                  <span className="material-symbols-outlined text-xs">sensors</span>
                  <span>Dual Public + App Stream</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional YouTube Link Input */}
          {deliveryMode === "YOUTUBE" && (
            <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-2 animate-in fade-in duration-200">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                YouTube Live Stream Link or Video ID <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => {
                  setYoutubeUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://youtube.com/live/xxxx or Video ID"
                className="w-full px-3 py-2 text-xs rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Paste scheduled YouTube live link or leave empty to connect via OBS stream key inside the studio.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={submitting}
            className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-md transition active:scale-95 flex items-center gap-1.5 ${
              deliveryMode === "YOUTUBE"
                ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>
              {submitting
                ? "Opening Classroom..."
                : isLive
                ? "Resume Live Class →"
                : "Launch Live Classroom →"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
