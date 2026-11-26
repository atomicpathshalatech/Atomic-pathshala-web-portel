"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { CamDrawRenderer } from "@/components/camdraw/CamDrawRenderer";
import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";
import {
  buildSlidePlan,
  DEFAULT_PPT_SETTINGS,
  generateQuestionsPptx,
  validateSlidesBeforeExport,
  type PptExportSettings,
  type PptFontMode,
  type PptLanguageMode,
} from "@/lib/questions/question-ppt-generator";

interface ExportHistoryEntry {
  id: string;
  exportedAt: string;
  userName: string;
  questionCount: number;
  slideCount: number;
  questionIds: string[];
  filename: string;
  status: "SUCCESS";
}

const HISTORY_KEY = "ap:question-ppt-export-history";

export function QuestionPptExporterClient({ userName }: { userName: string }) {
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [questions, setQuestions] = useState<PptQuestionItem[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [settings, setSettings] = useState<PptExportSettings>(DEFAULT_PPT_SETTINGS);
  const [filename, setFilename] = useState("Atomic_Pathshala_Practice_Slides");
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);
  const [zoomPercent, setZoomPercent] = useState<75 | 100 | 125>(100);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as ExportHistoryEntry[]);
    } catch {
      // ignore
    }
  }, []);

  const activeQuestions = useMemo(
    () => questions.filter((q) => !excludedIds.has(q.id)),
    [questions, excludedIds]
  );

  const slides = useMemo(
    () => buildSlidePlan(activeQuestions, settings),
    [activeQuestions, settings]
  );

  const validation = useMemo(
    () => validateSlidesBeforeExport(slides),
    [slides]
  );

  useEffect(() => {
    if (previewSlideIdx >= slides.length && slides.length > 0) {
      setPreviewSlideIdx(slides.length - 1);
    } else if (slides.length === 0) {
      setPreviewSlideIdx(0);
    }
  }, [slides.length, previewSlideIdx]);

  const currentSlide = slides[previewSlideIdx] ?? null;

  const warningCount = useMemo(
    () => activeQuestions.filter((q) => q.warnings.length > 0).length,
    [activeQuestions]
  );

  const handleLookup = async (overrideInput?: string) => {
    const input = typeof overrideInput === "string" ? overrideInput : rawInput;
    if (!input.trim()) {
      toast.error("Please paste at least one Question ID.");
      return;
    }
    setLoading(true);
    setPreviewConfirmed(false);
    try {
      const res = await fetch("/api/team/questions/export-ppt/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: input }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Failed to fetch questions.");
        return;
      }
      const d = json.data as {
        questions: PptQuestionItem[];
        missing: string[];
        duplicates: string[];
        invalid: string[];
      };
      setQuestions(d.questions);
      setExcludedIds(new Set());
      setMissingIds(d.missing);
      setDuplicateIds(d.duplicates);
      setInvalidIds(d.invalid);
      setHasLoadedOnce(true);
      setPreviewSlideIdx(0);

      if (d.questions.length === 0) {
        toast.warning("No matching questions found in the database.");
      } else {
        toast.success(`Loaded ${d.questions.length} question${d.questions.length === 1 ? "" : "s"} for PPT preview.`);
      }
    } catch {
      toast.error("Network error while fetching questions.");
    } finally {
      setLoading(false);
    }
  };

  const moveQuestion = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= questions.length || fromIdx === toIdx) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      if (moved) copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadPpt = async () => {
    if (activeQuestions.length === 0) {
      toast.error("No active questions selected to export.");
      return;
    }
    if (!previewConfirmed) {
      toast.warning("Please verify the slide preview and check the confirmation box before downloading.");
      return;
    }
    setExporting(true);
    try {
      const result = await generateQuestionsPptx(activeQuestions, settings, filename);
      toast.success(`Downloaded ${result.filename} (${result.slideCount} slides)`);

      const entry: ExportHistoryEntry = {
        id: `${Date.now()}`,
        exportedAt: new Date().toISOString(),
        userName,
        questionCount: activeQuestions.length,
        slideCount: result.slideCount,
        questionIds: activeQuestions.map((q) => q.questionCode || q.id),
        filename: result.filename,
        status: "SUCCESS",
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } catch (err) {
      console.error("PPT export failed:", err);
      toast.error("Failed to generate PowerPoint file. Please check images/structures and retry.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-2xl">slideshow</span>
            <span>Question ID to Classroom PPT</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Paste Question IDs, verify the 16:9 slide preview, and export ready-to-teach PowerPoint (.pptx) slides.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">history</span>
          <span>Export History ({history.length})</span>
        </button>
      </div>

      {/* Export History Drawer/Panel */}
      {showHistory && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Recent PPT Exports (This Browser)</h2>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No PPT exports recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.filename}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(item.exportedAt).toLocaleString()} • {item.userName} • {item.questionCount} Qs ({item.slideCount} slides)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const joined = item.questionIds.join("\n");
                      setRawInput(joined);
                      setShowHistory(false);
                      void handleLookup(joined);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-[11px] hover:bg-blue-100 cursor-pointer"
                  >
                    Load &amp; Re-export
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (4 cols): Question ID Input + Validation + Sequence + Settings */}
        <div className="lg:col-span-4 space-y-5">
          {/* Step 1: ID Input */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="ppt-qid-input" className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                1. Paste Question IDs
              </label>
              <span className="text-[10px] font-medium text-slate-400">Line, comma, or space separated</span>
            </div>

            <textarea
              id="ppt-qid-input"
              rows={6}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"QID-1021\nQID-1022\nQID-1023\n(or paste comma-separated IDs)"}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || !rawInput.trim()}
                onClick={() => void handleLookup()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">
                  {loading ? "hourglass_top" : "search"}
                </span>
                <span>{loading ? "Fetching Questions..." : "Fetch & Preview Slides"}</span>
              </button>
              {rawInput && (
                <button
                  type="button"
                  onClick={() => {
                    setRawInput("");
                    setQuestions([]);
                    setMissingIds([]);
                    setDuplicateIds([]);
                    setInvalidIds([]);
                    setHasLoadedOnce(false);
                    setPreviewConfirmed(false);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Validation Summary */}
          {hasLoadedOnce && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-sm text-xs">
              <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Input Validation Report
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                  Found: {questions.length}
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold">
                  Duplicates: {duplicateIds.length}
                </div>
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold">
                  Missing: {missingIds.length}
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  Invalid: {invalidIds.length}
                </div>
              </div>

              {missingIds.length > 0 && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  <strong>Missing IDs:</strong> {missingIds.join(", ")}
                </p>
              )}
              {duplicateIds.length > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  <strong>Duplicate IDs skipped:</strong> {duplicateIds.join(", ")}
                </p>
              )}
              {invalidIds.length > 0 && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  <strong>Invalid format:</strong> {invalidIds.join(", ")}
                </p>
              )}
              {warningCount > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                  ⚠ {warningCount} question{warningCount === 1 ? "" : "s"} have missing answer/option warnings below. Review before exporting.
                </p>
              )}
            </div>
          )}

          {/* Question Order & Warnings List */}
          {questions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Question Sequence ({activeQuestions.length} active)
                </h3>
                <span className="text-[10px] text-slate-400">Drag or use arrows</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isExcluded = excludedIds.has(q.id);
                  const code = q.questionCode || q.id;
                  return (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) moveQuestion(dragIndex, idx);
                        setDragIndex(null);
                      }}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
                        isExcluded
                          ? "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-50"
                          : q.warnings.length > 0
                          ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100">
                          <span className="text-blue-600">#{idx + 1}</span>
                          <span className="truncate">{code}</span>
                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {q.subject}
                          </span>
                        </div>
                        {q.warnings.length > 0 && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                            ⚠ {q.warnings.join(" • ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveQuestion(idx, idx - 1)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          disabled={idx === questions.length - 1}
                          onClick={() => moveQuestion(idx, idx + 1)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExclude(q.id)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold cursor-pointer"
                          title={isExcluded ? "Include in export" : "Exclude from export"}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isExcluded ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-red-600 cursor-pointer"
                          title="Remove"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm text-xs">
            <h3 className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 text-[11px]">
              PPT Export Settings (16:9 Black &amp; Orange)
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value as PptLanguageMode })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ENGLISH">English</option>
                  <option value="HINDI">Hindi (हिंदी)</option>
                  <option value="BILINGUAL">Bilingual (EN + HI)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Font Sizing</label>
                <select
                  value={settings.fontSizeMode}
                  onChange={(e) => setSettings({ ...settings, fontSizeMode: e.target.value as PptFontMode })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="auto">Auto-fit (Recommended)</option>
                  <option value="large">Large Classroom</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">PPT Filename</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <div className="space-y-2 pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeSourceBadge}
                  onChange={(e) => setSettings({ ...settings, includeSourceBadge: e.target.checked })}
                />
                <span>Show Question Source Badge (only if saved in DB)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.splitLongQuestions}
                  onChange={(e) => setSettings({ ...settings, splitLongQuestions: e.target.checked })}
                />
                <span>Auto-split very long questions to preserve solution space</span>
              </label>
            </div>
            <p className="text-[10px] text-slate-400">
              Pure Black (#000000) + Orange (#F97316) editable PPTX with blank lower area for live pen-tab solutions.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN (8 cols): Live 16:9 Slide Preview + Download */}
        <div className="lg:col-span-8 space-y-4">
          {/* Preview Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={previewSlideIdx <= 0}
                onClick={() => setPreviewSlideIdx((i) => Math.max(0, i - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                ← Prev
              </button>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 px-2">
                {slides.length > 0 ? `Slide ${previewSlideIdx + 1} / ${slides.length}` : "0 Slides"}
              </span>
              <button
                type="button"
                disabled={previewSlideIdx >= slides.length - 1}
                onClick={() => setPreviewSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                Next →
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
                {([75, 100, 125] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomPercent(z)}
                    className={`px-2 py-1 rounded-lg cursor-pointer ${
                      zoomPercent === z ? "bg-white dark:bg-slate-700 shadow-2xs text-orange-600" : "text-slate-500"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPreviewSlideIdx(0)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                title="Refresh Preview"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* 16:9 Pure Black + Orange Slide Canvas */}
          <div className="bg-slate-200/70 dark:bg-slate-950 rounded-2xl p-3 sm:p-6 border border-slate-300 dark:border-slate-800 overflow-x-auto flex justify-center">
            {!currentSlide ? (
              <div className="w-full aspect-video bg-black rounded-xl border border-dashed border-zinc-700 flex flex-col items-center justify-center text-center p-8 space-y-2">
                <span className="material-symbols-outlined text-4xl text-orange-500">slideshow</span>
                <p className="text-sm font-bold text-white">
                  No Slide Preview Yet
                </p>
                <p className="text-xs text-zinc-400 max-w-md">
                  Paste Question IDs on the left and click &ldquo;Fetch &amp; Preview Slides&rdquo; to inspect the exact 16:9 Atomic Pathshala Black &amp; Orange slides.
                </p>
              </div>
            ) : (
              <div
                style={{ width: `${zoomPercent}%`, maxWidth: "100%" }}
                className="transition-all"
              >
                <div className="w-full aspect-video bg-black text-white rounded-xl shadow-2xl border border-zinc-800 p-4 sm:p-6 flex flex-col justify-between overflow-hidden relative">
                  {/* UPPER PORTION: Header + Logo + Question + Source Badge + Options */}
                  <div className="space-y-2.5">
                    {/* Top Row: Orange Pill Header (Left) + Original Atomic Pathshala Logo (Right) */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="inline-flex items-center px-4 py-1 rounded-full bg-orange-500 text-black font-extrabold text-xs sm:text-sm tracking-tight shrink-0">
                        {currentSlide.headerTitle}
                      </div>

                      <img
                        src="/brand/logo.png"
                        alt="Atomic Pathshala Logo"
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                      />
                    </div>

                    {/* Question Statement + Right-side Diagram */}
                    {currentSlide.kind !== "OPTIONS_ONLY" && (
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="flex-1 min-w-0 space-y-1.5 text-xs sm:text-sm text-white leading-snug">
                          {currentSlide.statementEn && (
                            <FormulaText text={currentSlide.statementEn} className="block text-white" />
                          )}
                          {currentSlide.statementHi && (
                            <FormulaText text={currentSlide.statementHi} className="block text-zinc-100 pt-1" />
                          )}
                        </div>

                        {currentSlide.question.camDrawData ? (
                          <div className="w-full sm:w-48 shrink-0 p-1.5 rounded bg-white flex justify-center">
                            <CamDrawRenderer
                              document={currentSlide.question.camDrawData as Parameters<typeof CamDrawRenderer>[0]["document"]}
                              theme="light"
                              maxWidth={190}
                              className="w-full max-w-full"
                            />
                          </div>
                        ) : currentSlide.question.imageUrl ? (
                          <div className="w-full sm:w-48 shrink-0 flex justify-center">
                            <img
                              src={currentSlide.question.imageUrl}
                              alt="Question Diagram"
                              className="max-h-32 max-w-full object-contain"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Dynamic Source Badge (Yellow text, thin yellow outline, black bg; hidden if unavailable) */}
                    {currentSlide.sourceLabel && (
                      <div>
                        <span className="inline-block px-3 py-0.5 rounded-full bg-black border border-yellow-400 text-yellow-400 text-[10px] sm:text-[11px] font-bold">
                          {currentSlide.sourceLabel}
                        </span>
                      </div>
                    )}

                    {/* Options: Vertically aligned 1, 2, 3, 4 with orange circle markers & white text (no boxes/borders) */}
                    {currentSlide.kind !== "STATEMENT_ONLY" && (
                      <div className="space-y-1.5 pt-0.5">
                        {(currentSlide.optionsEn.length > 0
                          ? currentSlide.optionsEn
                          : currentSlide.optionsHi
                        ).map((opt, idx) => {
                          const hiText =
                            settings.language === "BILINGUAL" ? currentSlide.optionsHi[idx]?.text : null;
                          return (
                            <div key={opt.marker} className="flex items-start gap-2.5 text-xs sm:text-sm text-white">
                              <span className="w-5 h-5 rounded-full bg-orange-500 text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                {opt.marker}
                              </span>
                              <div className="flex-1 min-w-0 leading-snug">
                                <FormulaText text={opt.text} className="inline text-white" />
                                {hiText && (
                                  <span className="text-zinc-300 ml-2">
                                    | <FormulaText text={hiText} className="inline text-zinc-200" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* LOWER PORTION: Pure Blank Black Area for Live Pen-Tab / Whiteboard Solution */}
                  <div className="flex-1 min-h-[28%]" />
                </div>
              </div>
            )}
          </div>

          {/* Automatic Pre-Export Validation Checklist */}
          {slides.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Pre-Export Validation
                </h4>
                <span className={`text-[11px] font-bold ${validation.valid ? "text-emerald-600" : "text-red-600"}`}>
                  {validation.valid ? "All checks passed" : "Action required"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                {validation.checks.map((chk) => (
                  <div key={chk.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className={chk.passed ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                      {chk.passed ? "✓" : "✗"}
                    </span>
                    <span>{chk.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Confirmation & Download Bar */}
          {slides.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewConfirmed}
                  onChange={(e) => setPreviewConfirmed(e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span>
                  I have verified the slide preview ({activeQuestions.length} questions, {slides.length} slides)
                </span>
              </label>

              <button
                type="button"
                disabled={exporting || !previewConfirmed || !validation.valid || activeQuestions.length === 0}
                onClick={() => void handleDownloadPpt()}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>{exporting ? "Generating Editable .pptx..." : "Download Editable PPTX"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
