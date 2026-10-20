"use client";

import { useState } from "react";
import {
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface SectionOption {
  id: string;
  title: string;
}

interface ImportResult {
  success: boolean;
  totalParsed: number;
  importedCount: number;
  alreadyIncludedCount: number;
  invalidCount: number;
  importedIds: string[];
  alreadyIncludedIds: string[];
  invalidIds: string[];
  warnings: {
    questionId: string;
    questionCode: string | null;
    codeOrId: string;
    type: string;
    message: string;
  }[];
}

interface ExerciseImportModalProps {
  exerciseId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sections: SectionOption[];
  defaultSectionId?: string;
  defaultSectionTitle?: string;
}

export function ExerciseImportModal({
  exerciseId,
  isOpen,
  onClose,
  onSuccess,
  sections,
  defaultSectionId,
  defaultSectionTitle,
}: ExerciseImportModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [targetSectionId, setTargetSectionId] = useState(defaultSectionId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  // Sync defaultSectionId whenever modal is opened
  useState(() => {
    if (defaultSectionId) {
      setTargetSectionId(defaultSectionId);
    }
  });

  if (!isOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) {
      setErrorMsg("Please enter at least one Question ID or Code.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/import-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: rawInput.trim(),
          targetSectionId: targetSectionId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to import questions.");
      }

      setResult(json.data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process import.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Import Questions by ID
              </h2>
              <p className="text-xs text-slate-500">
                Single or batch import using existing Question Bank IDs or Codes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
            {errorMsg}
          </div>
        )}

        {targetSectionId && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3.5 py-2 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300">
            <span>
              Direct Destination: <strong>{sections.find((s) => s.id === targetSectionId)?.title || defaultSectionTitle || "Target Section"}</strong>
            </span>
            <button
              type="button"
              onClick={() => setTargetSectionId("")}
              className="text-[11px] underline font-bold hover:text-amber-950 dark:hover:text-amber-200"
            >
              Switch to Auto-Sort by Topic/Year
            </button>
          </div>
        )}

        {/* Import Form */}
        {!result ? (
          <form onSubmit={handleImport} className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Question IDs or Question Codes *
                </label>
                <span className="text-[11px] text-slate-400">
                  Delimited by commas, spaces, or newlines
                </span>
              </div>
              <textarea
                rows={6}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Paste IDs or Codes here:
C250000130, C250000131
chem_001
cmue46mix001o3hu7061wlnk4
C250000363 C250000364"
                className="w-full font-mono text-xs rounded-xl border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* Target Section (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Section Destination
              </label>
              <select
                value={targetSectionId}
                onChange={(e) => setTargetSectionId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Auto-sort by Canonical Topic (Recommended)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !rawInput.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-500 disabled:opacity-50"
              >
                {isSubmitting ? "Validating & Importing..." : "Validate & Import Questions"}
              </button>
            </div>
          </form>
        ) : (
          /* Result Summary & Warnings Review */
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 p-3 text-center border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
                <span className="block text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {result.importedCount}
                </span>
                <span className="block text-[11px] text-emerald-600 dark:text-emerald-400">
                  Newly Imported
                </span>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
                <span className="block text-lg font-bold text-amber-700 dark:text-amber-300">
                  {result.alreadyIncludedCount}
                </span>
                <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                  Already in Exercise
                </span>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center border border-red-200 dark:bg-red-950/40 dark:border-red-800">
                <span className="block text-lg font-bold text-red-700 dark:text-red-300">
                  {result.invalidCount}
                </span>
                <span className="block text-[11px] text-red-600 dark:text-red-400">
                  Invalid / Not Found
                </span>
              </div>
            </div>

            {/* Invalid IDs details */}
            {result.invalidIds.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/30">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300 mb-1">
                  <XCircle className="h-4 w-4" />
                  Unknown or Non-existent IDs:
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {result.invalidIds.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-red-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-800 dark:bg-red-900/60 dark:text-red-200"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Already Included details */}
            {result.alreadyIncludedIds.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Skipped (Duplicate within this exercise):
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {result.alreadyIncludedIds.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings list (translations, chapter mismatch) */}
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Validation Audit Warnings ({result.warnings.length}):
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {result.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded bg-white p-2 text-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                    >
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {w.codeOrId}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">{w.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finish action */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setRawInput("");
                }}
                className="text-xs text-amber-600 hover:underline font-semibold"
              >
                Import More Questions
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
