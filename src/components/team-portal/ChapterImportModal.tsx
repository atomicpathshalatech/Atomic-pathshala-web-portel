"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MasterChapter } from "@/lib/batch/master-chapters";
import { COMMON_DURATIONS } from "@/lib/batch/schedule-conflict";

export function ChapterImportModal({
  batchId,
  existingChapterIds = [],
  onClose,
}: {
  batchId: string;
  existingChapterIds?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [chapterInputId, setChapterInputId] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundChapter, setFoundChapter] = useState<MasterChapter | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [dailyStartTime, setDailyStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState(60);
  const [importing, setImporting] = useState(false);

  // Check if found chapter is already imported into this batch
  const isDuplicate = Boolean(
    foundChapter &&
      existingChapterIds.some(
        (id) =>
          id === foundChapter.id ||
          (foundChapter.chapterCode && id.toLowerCase() === foundChapter.chapterCode.toLowerCase())
      )
  );

  async function handleSearch(overrideQuery?: string) {
    const query = (overrideQuery ?? chapterInputId).trim();
    if (!query) {
      toast.error("Please enter or paste a Chapter ID or Code.");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchAttempted(true);
    setFoundChapter(null);

    try {
      const res = await fetch(`/api/team/chapters/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data.chapters) && json.data.chapters.length > 0) {
        // Find exact match first if available, else first relevant match
        const exact = json.data.chapters.find(
          (c: MasterChapter) =>
            c.chapterCode.toLowerCase() === query.toLowerCase() ||
            c.id.toLowerCase() === query.toLowerCase() ||
            c.title.toLowerCase() === query.toLowerCase()
        );
        const match = exact || json.data.chapters[0];
        setFoundChapter(match);
      } else {
        setSearchError(`No chapter found with ID or code "${query}". Please verify the Chapter Code.`);
      }
    } catch {
      setSearchError("Network error while searching for chapter.");
    } finally {
      setSearching(false);
    }
  }

  async function handlePasteFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setChapterInputId(text.trim());
          handleSearch(text.trim());
        }
      }
    } catch {
      // ignore
    }
  }

  async function handleImport() {
    if (!foundChapter) {
      toast.error("Please search and verify a Chapter first.");
      return;
    }

    if (isDuplicate) {
      toast.error(`"${foundChapter.title}" is already imported into this batch. Duplicate import is not allowed.`);
      return;
    }

    const duration = isCustomDuration ? customDuration : durationMinutes;
    if (!duration || duration <= 0) {
      toast.error("Duration must be a positive number of minutes.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterIdOrCode: foundChapter.chapterCode || foundChapter.id,
          startDate,
          dailyStartTime,
          durationMinutes: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to import chapter.");
        return;
      }
      toast.success(data.data?.message || `Successfully imported "${foundChapter.title}".`);
      onClose();
      router.refresh();
    } catch {
      toast.error("Network error during chapter import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">download_for_offline</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Import Chapter by ID
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste or enter the Chapter ID / Code to verify and import into batch timetable.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. ID / Code Input & Lookup */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Chapter ID / Code
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  key
                </span>
                <input
                  type="text"
                  placeholder="Paste Chapter ID or Code (e.g. cuid, code)..."
                  value={chapterInputId}
                  onChange={(e) => {
                    setChapterInputId(e.target.value);
                    setSearchAttempted(false);
                    setSearchError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-20 py-3 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition shadow-inner"
                />
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 rounded-lg transition"
                >
                  Paste
                </button>
              </div>

              <button
                type="button"
                disabled={searching || !chapterInputId.trim()}
                onClick={() => handleSearch()}
                className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 shrink-0"
              >
                {searching ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">search</span>
                    <span>Find Chapter</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Error Message */}
          {searchError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-rose-500">error</span>
              <span>{searchError}</span>
            </div>
          )}

          {/* 3. Verified Chapter Preview Card */}
          {foundChapter && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isDuplicate
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                  : "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-600 text-white">
                      {foundChapter.subject}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      {foundChapter.chapterCode}
                    </span>
                    {!isDuplicate && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        Verified
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {foundChapter.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Course: <span className="font-semibold text-slate-700 dark:text-slate-300">{foundChapter.courseTitle}</span>
                  </p>
                </div>
              </div>

              {/* Duplicate Warning */}
              {isDuplicate && (
                <div className="mt-3 p-3 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 border border-amber-300 text-xs text-amber-800 dark:text-amber-200 font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-600">warning</span>
                  <span>Duplicate Detected: This chapter is already imported into this batch.</span>
                </div>
              )}

              {/* Content Metrics */}
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 font-sans uppercase font-bold">Lectures</span>
                  <span className="font-black text-slate-900 dark:text-white">{foundChapter.lectures.length}</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 font-sans uppercase font-bold">DPPs</span>
                  <span className="font-black text-slate-900 dark:text-white">{foundChapter.dppCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 font-sans uppercase font-bold">Tests</span>
                  <span className="font-black text-slate-900 dark:text-white">{foundChapter.testCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Scheduling Options (Only shown when chapter is found and not duplicate) */}
          {foundChapter && !isDuplicate && (
            <div className="space-y-4 pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Timetable &amp; Schedule Settings
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    First Lecture Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Daily Start Time (IST)
                  </label>
                  <input
                    type="time"
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Lecture Duration
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COMMON_DURATIONS.map((dur) => (
                    <button
                      key={dur.minutes}
                      type="button"
                      onClick={() => {
                        setIsCustomDuration(false);
                        setDurationMinutes(dur.minutes);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        !isCustomDuration && durationMinutes === dur.minutes
                          ? "bg-[#031635] text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomDuration(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isCustomDuration
                        ? "bg-[#031635] text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {isCustomDuration && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={15}
                      max={300}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(parseInt(e.target.value) || 60)}
                      className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    />
                    <span className="text-xs text-slate-500">Minutes</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!foundChapter || isDuplicate || importing}
            onClick={handleImport}
            className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition active:scale-95 flex items-center gap-2"
          >
            {importing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Importing Chapter...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Confirm &amp; Import Chapter</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
