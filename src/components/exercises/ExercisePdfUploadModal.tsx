"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, X, Loader2, ArrowRight } from "lucide-react";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

interface Props {
  exerciseId: string;
  exerciseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  sections: { id: string; title: string }[];
  defaultSectionId?: string;
}

/**
 * "Upload PDF" in an exercise: the whole PDF is extracted (question-extract
 * pipeline — figures, answer key, solutions, checks). Its verified questions
 * are added to the Question Bank and to this exercise automatically; any that
 * need a look wait on the job page, and importing them there adds them too.
 */
export function ExercisePdfUploadModal({ exerciseId, exerciseTitle, isOpen, onClose, sections, defaultSectionId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [sectionId, setSectionId] = useState(defaultSectionId ?? "");
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(100);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  if (!isOpen) return null;

  const start = async () => {
    if (!file) return setError("Please choose a PDF.");
    if (file.type && file.type !== "application/pdf") return setError("Please choose a PDF file.");
    setBusy(true);
    setError(null);
    try {
      setStatus("Uploading PDF…");
      const uploaded = await uploadFileToR2(file, {
        prefix: "pdf",
        fileType: "PDF",
        visibility: "PUBLIC",
        onProgress: (p) => setStatus(`Uploading PDF… ${p}%`),
      });
      setStatus("Starting extraction…");
      const res = await fetch("/api/team/question-extract/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileAssetId: uploaded.fileAssetId,
          startNumber,
          endNumber: Math.max(startNumber, endNumber),
          exerciseId,
          exerciseSectionId: sectionId || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Could not start the extraction (error ${res.status}).`);
      setJobId(json.data.job.id);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Upload PDF to {exerciseTitle}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Questions are read from the PDF and checked. Verified ones are added to this exercise automatically.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {jobId ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              Extraction started. It takes a few minutes for a full PDF. When it finishes, the verified questions appear in this
              exercise by themselves. Questions that need a check wait on the job page; import them from there and they are added
              here too.
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Close
              </button>
              <Link
                href={`/team/question-extract/${jobId}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500"
              >
                Open job page <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-amber-400 dark:border-slate-700">
              <FileUp className="h-7 w-7 text-amber-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{file ? file.name : "Choose a PDF"}</span>
              {file && <span className="text-[11px] text-slate-400">{(file.size / 1048576).toFixed(1)} MB</span>}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>

            {sections.length > 0 && (
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Add to
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Auto (each question by its topic)</option>
                  {sections.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Part {i + 1}: {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                First question no.
                <input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Last question no.
                <input
                  type="number"
                  min={1}
                  value={endNumber}
                  onChange={(e) => setEndNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </div>

            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            {status && <p className="text-xs text-slate-500">{status}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Cancel
              </button>
              <button
                type="button"
                onClick={start}
                disabled={busy || !file}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Upload &amp; Extract
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
