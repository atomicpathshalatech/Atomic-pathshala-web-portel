"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MasterChapter } from "@/lib/batch/master-chapters";
import { COMMON_DURATIONS } from "@/lib/batch/schedule-conflict";

export function ChapterImportModal({
  batchId,
  onClose,
}: {
  batchId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [chapters, setChapters] = useState<MasterChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<MasterChapter | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [dailyStartTime, setDailyStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState(60);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function loadChapters() {
      setLoading(true);
      try {
        const res = await fetch(`/api/team/chapters/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success) {
          setChapters(json.data.chapters);
          if (!selectedChapter && json.data.chapters.length > 0) {
            setSelectedChapter(json.data.chapters[0]);
          }
        }
      } catch {
        toast.error("Could not load master chapters library.");
      } finally {
        setLoading(false);
      }
    }
    loadChapters();
  }, [searchQuery]);

  async function handleImport() {
    if (!selectedChapter) {
      toast.error("Please select a Master Chapter to import.");
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
          chapterIdOrCode: selectedChapter.chapterCode,
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
      toast.success(data.data.message || `Successfully imported "${selectedChapter.title}".`);
      onClose();
      router.refresh();
    } catch {
      toast.error("Network error during chapter import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl border border-outline-variant/30 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">download_for_offline</span>
              Import Master Chapter into Batch
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Select a centralized Master Chapter (ID) to auto-generate all lecture schedules without duplicating master content.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Modal Body (Search + 2 Columns) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search by Chapter ID (e.g. CH-BIO-001, CH-CHE-001), Title, or Subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Chapter Selector List */}
            <div className="md:col-span-5 space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              <h4 className="font-bold text-xs uppercase text-on-surface-variant tracking-wider">
                Available Master Chapters ({chapters.length})
              </h4>
              {loading ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">Loading master library...</p>
              ) : chapters.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">No master chapters found.</p>
              ) : (
                chapters.map((c) => {
                  const isSelected = selectedChapter?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChapter(c)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-1 block ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold font-mono text-primary text-[11px]">{c.chapterCode}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
                          {c.subject}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-on-surface line-clamp-1">{c.title}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {c.lectures.length} Lectures &middot; {Math.round(c.totalDurationMinutes / 60)} hrs
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right: Chapter Preview & Delivery Timing */}
            <div className="md:col-span-7 space-y-5">
              {selectedChapter ? (
                <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 space-y-4">
                  {/* Chapter Header */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        {selectedChapter.chapterCode}
                      </span>
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {selectedChapter.subject} &middot; {selectedChapter.targetExam}
                      </span>
                    </div>
                    <h4 className="font-bold text-base text-on-surface mt-1">{selectedChapter.title}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">Faculty: {selectedChapter.facultyName}</p>
                  </div>

                  {/* High-Yield Metrics */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-surface-container-high/40 rounded-xl">
                      <span className="text-[10px] text-on-surface-variant block">Lectures</span>
                      <span className="font-bold text-on-surface">{selectedChapter.lectures.length}</span>
                    </div>
                    <div className="p-2 bg-surface-container-high/40 rounded-xl">
                      <span className="text-[10px] text-on-surface-variant block">DPP Sets</span>
                      <span className="font-bold text-primary">{selectedChapter.dppCount}</span>
                    </div>
                    <div className="p-2 bg-surface-container-high/40 rounded-xl">
                      <span className="text-[10px] text-on-surface-variant block">Tests</span>
                      <span className="font-bold text-secondary">{selectedChapter.testCount}</span>
                    </div>
                    <div className="p-2 bg-surface-container-high/40 rounded-xl">
                      <span className="text-[10px] text-on-surface-variant block">PDF Notes</span>
                      <span className="font-bold text-on-surface">{selectedChapter.pdfNotesCount}</span>
                    </div>
                  </div>

                  {/* Delivery Scheduling Parameters */}
                  <div className="space-y-3 pt-2 border-t border-outline-variant/20">
                    <h5 className="font-bold text-xs text-on-surface">Batch Delivery Schedule Configuration</h5>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface">Daily Class Time</label>
                        <input
                          type="time"
                          value={dailyStartTime}
                          onChange={(e) => setDailyStartTime(e.target.value)}
                          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Duration Chips */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-on-surface block">
                        Lecture Duration (Required)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_DURATIONS.slice(0, 4).map((d) => (
                          <button
                            key={d.minutes}
                            type="button"
                            onClick={() => {
                              setDurationMinutes(d.minutes);
                              setIsCustomDuration(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              !isCustomDuration && durationMinutes === d.minutes
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Lectures Preview */}
                  <div className="space-y-1.5 pt-2 border-t border-outline-variant/20">
                    <span className="text-[11px] font-bold text-on-surface-variant block uppercase">
                      Master Lectures Preview ({selectedChapter.lectures.length})
                    </span>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {selectedChapter.lectures.map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded-xl bg-surface-container-high/30 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-semibold text-on-surface truncate max-w-[280px]">
                            {l.lectureCode}: {l.title}
                          </span>
                          <span className="text-on-surface-variant font-mono shrink-0">{l.durationMinutes}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-on-surface-variant text-xs">
                  Select a chapter from the left to view preview.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer CTA */}
        <div className="p-6 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest">
          <span className="text-xs text-on-surface-variant font-mono">
            Chapter ID will be referenced &middot; Zero duplicate master content
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importing || !selectedChapter}
              onClick={handleImport}
              className="px-7 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {importing ? "Importing & Scheduling..." : "Import Chapter to Batch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
