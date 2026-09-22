"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Clock, X, Loader2 } from "lucide-react";

interface RescheduleTestModalProps {
  testId: string;
  testName: string;
  initialOpenTime?: string | null;
  initialCloseTime?: string | null;
  initialDurationMin?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function RescheduleTestModal({
  testId,
  testName,
  initialOpenTime,
  initialCloseTime,
  initialDurationMin = 180,
  isOpen,
  onClose,
}: RescheduleTestModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Format to YYYY-MM-DDTHH:mm for datetime-local input
  const formatForInput = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  };

  const [openTimeInput, setOpenTimeInput] = useState(() => formatForInput(initialOpenTime));
  const [closeTimeInput, setCloseTimeInput] = useState(() => formatForInput(initialCloseTime));
  const [durationMin, setDurationMin] = useState(initialDurationMin);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openTimeInput) {
      toast.error("Please specify test start date and time.");
      return;
    }

    const openDate = new Date(openTimeInput);
    const closeDate = closeTimeInput ? new Date(closeTimeInput) : null;

    if (closeDate && closeDate <= openDate) {
      toast.error("Close time must be strictly after start time.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/team/tests/${testId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openTime: openDate.toISOString(),
          closeTime: closeDate ? closeDate.toISOString() : null,
          durationMin: Number(durationMin) || 180,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to reschedule test.");
        return;
      }

      toast.success("Test rescheduled successfully!");
      onClose();
      router.refresh();
    } catch {
      toast.error("Network error while rescheduling test.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Reschedule Test</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{testName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Start Date &amp; Time (Open Time) <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={openTimeInput}
              onChange={(e) => setOpenTimeInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Test will show as &quot;Upcoming&quot; for students until this exact time.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              End Date &amp; Time (Close Time - Optional)
            </label>
            <input
              type="datetime-local"
              value={closeTimeInput}
              onChange={(e) => setCloseTimeInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              After this time, the test closes and students can download the question paper PDF.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Duration (Minutes)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="600"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? "Saving..." : "Save Schedule"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
