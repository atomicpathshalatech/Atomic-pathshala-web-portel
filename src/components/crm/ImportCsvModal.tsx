"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { X, Upload, FileText, CheckCircle2 } from "lucide-react";

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportCsvModal({ isOpen, onClose, onImportComplete }: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a CSV file to upload");
      return;
    }
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/crm/leads/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message);
        setResult(json.data);
        onImportComplete();
      } else {
        toast.error(json.error || "Import failed");
      }
    } catch {
      toast.error("Error uploading file");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl max-w-lg w-full shadow-2xl border border-outline-variant/20 overflow-hidden">
        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-on-surface">Import Leads via CSV</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-on-surface-variant hover:bg-surface-container">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-5 space-y-4 text-xs">
          <p className="text-on-surface-variant leading-relaxed">
            Upload an Excel/Google Sheets export (.csv). The file should have columns such as:
            <b> name, phone (or mobile), email, exam, class, city</b>.
          </p>

          <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 text-center hover:border-primary/60 transition bg-surface-container-lowest">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
              <FileText className="w-8 h-8 text-primary mx-auto" />
              <div className="font-semibold text-on-surface">
                {file ? file.name : "Click to select CSV file"}
              </div>
              <p className="text-[10px] text-on-surface-variant">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports UTF-8 CSV exports up to 10MB"}
              </p>
            </label>
          </div>

          {result && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-300 rounded-xl space-y-1 text-emerald-900">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Successfully imported {result.importedCount} leads!</span>
              </div>
              {result.errors.length > 0 && (
                <div className="text-[10px] text-amber-800 pt-1">
                  Note: {result.errors.length} rows had missing or invalid numbers.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-outline-variant/30 font-medium hover:bg-surface-container"
            >
              {result ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={importing || !file}
              className="px-5 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
            >
              {importing ? "Importing..." : "Start Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
