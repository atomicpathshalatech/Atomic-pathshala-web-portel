"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Sparkles, X, CheckCircle2, AlertCircle, RefreshCw, Hash, ShieldCheck } from "lucide-react";

interface CanonicalIdMigratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CanonicalIdMigratorModal({
  isOpen,
  onClose,
  onSuccess,
}: CanonicalIdMigratorModalProps) {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("ALL");
  const [limit, setLimit] = useState(1000);
  const [summary, setSummary] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleRunMigration = async (dryRun = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/questions/migrate-canonical-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject === "ALL" ? undefined : subject,
          limit,
          dryRun,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
        if (!dryRun) {
          toast.success(`Successfully assigned canonical IDs to ${json.data.migratedCount} questions!`);
          onSuccess();
        } else {
          toast.info(`Dry run complete: ${json.data.migratedCount} questions need canonical IDs.`);
        }
      } else {
        toast.error(json.error || "Migration failed");
      }
    } catch {
      toast.error("Network error during canonical ID migration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Canonical Question ID Standardizer (10-Digit)
              </h3>
              <p className="text-xs text-slate-500">
                Formats: Physics (P26), Chemistry (C25), Biology (B24), Math (M23), Science (S22).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300">
            <p className="font-semibold">
              This tool scans existing questions in your repository and assigns official 10-character canonical IDs (e.g. <code>P260000001</code>, <code>C250000001</code>) to any questions that have legacy or unassigned IDs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Filter Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              >
                <option value="ALL">All Subjects</option>
                <option value="Physics">Physics (P26)</option>
                <option value="Chemistry">Chemistry (C25)</option>
                <option value="Biology">Biology (B24)</option>
                <option value="Mathematics">Mathematics (M23)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Max Batch Size
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              >
                <option value={100}>100 Questions</option>
                <option value={500}>500 Questions</option>
                <option value={1000}>1,000 Questions</option>
                <option value={5000}>5,000 Questions</option>
              </select>
            </div>
          </div>

          {summary && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total Inspected:</span>
                <span className="font-mono font-bold">{summary.totalQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Already Canonical (10-char):</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{summary.alreadyCanonical}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-600 dark:text-blue-400">Migrated / Updated:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{summary.migratedCount}</span>
              </div>
              {summary.failedCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-600">Failed:</span>
                  <span className="font-mono font-bold text-rose-600">{summary.failedCount}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleRunMigration(true)}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold transition disabled:opacity-50"
            >
              Test Scan (Dry Run)
            </button>
            <button
              type="button"
              onClick={() => handleRunMigration(false)}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Assign Canonical IDs Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
