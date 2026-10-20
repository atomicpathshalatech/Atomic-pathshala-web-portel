"use client";

import { useState } from "react";
import {
  X,
  FileDown,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
} from "lucide-react";

interface ExercisePdfExportModalProps {
  exerciseId: string;
  exerciseTitle: string;
  exerciseCode?: string;
  isOpen: boolean;
  onClose: () => void;
  audit?: {
    totalQuestions: number;
    missingEnglishCount: number;
    missingHindiCount: number;
    chapterMismatchCount: number;
  };
  defaultLanguageMode?: string;
}

export function ExercisePdfExportModal({
  exerciseId,
  exerciseTitle,
  exerciseCode = "EX-01",
  isOpen,
  onClose,
  audit = {
    totalQuestions: 0,
    missingEnglishCount: 0,
    missingHindiCount: 0,
    chapterMismatchCount: 0,
  },
  defaultLanguageMode = "BILINGUAL",
}: ExercisePdfExportModalProps) {
  const [languageMode, setLanguageMode] = useState<"BILINGUAL" | "HINDI_ONLY" | "ENGLISH_ONLY">(
    (defaultLanguageMode === "HINDI_ONLY" || defaultLanguageMode === "ENGLISH_ONLY")
      ? defaultLanguageMode
      : "BILINGUAL"
  );
  const [format, setFormat] = useState<"QUESTION_ONLY" | "WITH_ANSWER_KEY" | "FULL_WITH_SOLUTIONS">("FULL_WITH_SOLUTIONS");
  const [instituteName, setInstituteName] = useState("ATOMIC PATHSHALA");
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  // Translation readiness check
  const hasHindiIssue = languageMode === "HINDI_ONLY" && audit.missingHindiCount > 0;
  const hasEnglishIssue = languageMode === "ENGLISH_ONLY" && audit.missingEnglishCount > 0;
  const hasBilingualIssue = languageMode === "BILINGUAL" && (audit.missingHindiCount > 0 || audit.missingEnglishCount > 0);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageMode,
          format,
          instituteName,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to generate PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exerciseTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_${exerciseCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "PDF generation failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Export Printable Coaching PDF
              </h2>
              <p className="text-xs text-slate-500">
                A4 portrait layout &bull; KaTeX formulas &bull; Answer keys &bull; Solutions
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

        <div className="mt-5 space-y-4">
          {/* Language Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Output Language Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "BILINGUAL", label: "Bilingual (HI + EN)" },
                { id: "HINDI_ONLY", label: "Hindi Only (हिन्दी)" },
                { id: "ENGLISH_ONLY", label: "English Only" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLanguageMode(m.id as any)}
                  className={`rounded-lg border p-2.5 text-center text-xs font-semibold transition-all ${
                    languageMode === m.id
                      ? "border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Pre-export audit warning */}
            {(hasHindiIssue || hasEnglishIssue || hasBilingualIssue) && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold">Translation Coverage Warning:</span>
                  {hasHindiIssue && (
                    <p className="mt-0.5">
                      {audit.missingHindiCount} questions do not have Hindi translations. They will fall back to English.
                    </p>
                  )}
                  {hasEnglishIssue && (
                    <p className="mt-0.5">
                      {audit.missingEnglishCount} questions do not have English translations. They will fall back to Hindi.
                    </p>
                  )}
                  {hasBilingualIssue && !hasHindiIssue && !hasEnglishIssue && (
                    <p className="mt-0.5">
                      Some questions lack either Hindi ({audit.missingHindiCount}) or English ({audit.missingEnglishCount}).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Module Output Format */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Sheet Sections Included
            </label>
            <div className="space-y-2">
              {[
                {
                  id: "FULL_WITH_SOLUTIONS",
                  title: "Complete Module (Recommended)",
                  desc: "Practice Questions + Answer Key Grid + Detailed Step-by-Step Solutions at end",
                },
                {
                  id: "WITH_ANSWER_KEY",
                  title: "Questions + Answer Key",
                  desc: "Practice Questions followed by compact Answer Key grid table",
                },
                {
                  id: "QUESTION_ONLY",
                  title: "Practice Questions Only",
                  desc: "Questions only (ideal for tests or classroom quizzes without solutions)",
                },
              ].map((f) => (
                <label
                  key={f.id}
                  onClick={() => setFormat(f.id as any)}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    format === f.id
                      ? "border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="pdfFormat"
                    checked={format === f.id}
                    onChange={() => setFormat(f.id as any)}
                    className="mt-1 h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {f.title}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {f.desc}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Institute Name Banner */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Institute / Coaching Header Text
            </label>
            <input
              type="text"
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              placeholder="ATOMIC PATHSHALA"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
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
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {isExporting ? "Generating PDF..." : "Download Printable PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
