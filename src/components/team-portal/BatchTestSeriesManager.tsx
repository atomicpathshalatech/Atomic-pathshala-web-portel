"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Download,
  Plus,
  Trash2,
  ExternalLink,
  BookOpen,
  Calendar,
  Clock,
  HelpCircle,
  FileText,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { formatISTDateTime } from "@/lib/date-utils";

interface BatchTestSeriesManagerProps {
  batchId: string;
  batchName: string;
  canManage: boolean;
}

export function BatchTestSeriesManager({
  batchId,
  batchName,
  canManage,
}: BatchTestSeriesManagerProps) {
  const [loading, setLoading] = useState(true);
  const [importedList, setImportedList] = useState<any[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [testSeriesIdOrCode, setTestSeriesIdOrCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Available test series for quick selection
  const [availableSeries, setAvailableSeries] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/batches/${batchId}/test-series`);
      const json = await res.json();
      if (json.success) {
        setImportedList(json.data.testSeries || []);
      }
    } catch {
      toast.error("Failed to load batch test series");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSeries = async () => {
    try {
      setLoadingAvailable(true);
      const res = await fetch("/api/team/test-series");
      const json = await res.json();
      if (json.success) {
        setAvailableSeries(json.data?.series || json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAvailable(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  useEffect(() => {
    if (importModalOpen) {
      loadAvailableSeries();
    }
  }, [importModalOpen]);

  const handleImport = async (codeToImport?: string) => {
    const target = (codeToImport || testSeriesIdOrCode).trim();
    if (!target) {
      toast.error("Please enter a Test Series Unique Code or ID.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/test-series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testSeriesIdOrCode: target }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Test Series imported successfully! Syllabus synced to batch.");
        setImportModalOpen(false);
        setTestSeriesIdOrCode("");
        loadData();
      } else {
        toast.error(json.error || "Failed to import Test Series.");
      }
    } catch {
      toast.error("Error importing Test Series.");
    } finally {
      setImporting(false);
    }
  };

  const handleUnlink = async (testSeriesId: string, seriesName: string) => {
    if (
      !confirm(
        `Are you sure you want to unlink "${seriesName}" from this batch? The master test series will remain untouched.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/team/batches/${batchId}/test-series`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testSeriesId }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Test Series unlinked from this batch.");
        loadData();
      } else {
        toast.error(json.error || "Failed to unlink Test Series.");
      }
    } catch {
      toast.error("Error unlinking Test Series.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalTestsCount = importedList.reduce(
    (sum, item) => sum + (item.testSeries?.tests?.length || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
            <span>Imported Test Series</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold">
              {importedList.length} Series &middot; {totalTestsCount} Tests
            </span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Tests are mapped directly from master Test Series. Any test or syllabus change synchronizes automatically across all imported batches.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Import Test Series</span>
            </button>
          </div>
        )}
      </div>

      {/* Blueprint Info Banner */}
      <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
        <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5">
          hub
        </span>
        <div className="leading-relaxed">
          <p className="font-bold">Master Blueprint Architecture</p>
          <p className="text-blue-800/90 dark:text-blue-300/80 text-[11px] mt-0.5">
            When you import a Test Series by its unique ID, you don&apos;t create detached copies. Whenever faculty authors questions, updates the schedule, or modifies the syllabus in the master series, every batch instantly receives those updates.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          Loading imported test series...
        </div>
      )}

      {/* Empty State */}
      {!loading && importedList.length === 0 && (
        <div className="glass-card rounded-3xl p-8 sm:p-12 text-center text-on-surface-variant space-y-3 border border-dashed border-outline-variant/30">
          <span className="material-symbols-outlined text-4xl text-primary opacity-60">
            assignment_turned_in
          </span>
          <h4 className="font-bold text-sm text-on-surface">No Test Series Imported Yet</h4>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Import a Test Series using its Unique ID to bring all its scheduled tests, question blueprints, and downloadable syllabus PDFs into this batch.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 transition-all inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Import Test Series Now</span>
            </button>
          )}
        </div>
      )}

      {/* Test Series List */}
      {!loading && importedList.length > 0 && (
        <div className="space-y-6">
          {importedList.map((item) => {
            const series = item.testSeries;
            const tests = series?.tests || [];

            return (
              <div
                key={item.importId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs"
              >
                {/* Series Header Bar */}
                <div className="p-4 sm:px-6 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {series.name}
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <span>{series.code}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(series.code)}
                          title="Copy Unique Code"
                          className="hover:opacity-75"
                        >
                          {copiedCode === series.code ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {series.examType || "Comprehensive"} &middot; {tests.length} Test{tests.length === 1 ? "" : "s"} &middot; Imported on{" "}
                      {new Date(item.importedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/team/test-series/${series.id}`}
                      target="_blank"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Master Series</span>
                    </Link>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleUnlink(series.id, series.name)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Unlink Series from Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tests Table / List */}
                {tests.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No tests created in this series yet. Add tests from the master series to show them here.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tests.map((test: any) => {
                      const testScheduleStr = test.openTime
                        ? formatISTDateTime(test.openTime)
                        : "Schedule pending";

                      // Check syllabus chapters
                      let chaptersCount = 0;
                      let isCompleteAll = false;
                      if (test.syllabus) {
                        try {
                          const raw =
                            typeof test.syllabus === "string"
                              ? JSON.parse(test.syllabus)
                              : test.syllabus;
                          const chs = raw?.chapters || raw || [];
                          chaptersCount = chs.length;
                          isCompleteAll = chs.every((c: any) => c.isComplete);
                        } catch {}
                      }

                      return (
                        <div
                          key={test.id}
                          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold uppercase">
                                {test.testType || "Test"}
                              </span>
                              <h5 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                {test.name}
                              </h5>
                              <span className="text-xs font-mono text-slate-400">
                                {test.code || ""}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                <span>{testScheduleStr}</span>
                              </span>
                              <span>&middot;</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{test.durationMin} Mins</span>
                              </span>
                              <span>&middot;</span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  {chaptersCount > 0
                                    ? `${chaptersCount} Chapter${chaptersCount === 1 ? "" : "s"} ${
                                        isCompleteAll ? "(Complete)" : "(Custom Topics)"
                                      }`
                                    : "Full Syllabus"}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                            {/* Syllabus PDF Viewer */}
                            <a
                              href={`/api/tests/${test.id}/syllabus-pdf?batchId=${batchId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/40 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Syllabus PDF</span>
                            </a>

                            {/* Author Questions link */}
                            <Link
                              href={`/team/tests/${test.id}/author`}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition flex items-center gap-1"
                            >
                              <span>Questions</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Import Test Series into Batch
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Enter Test Series Unique Code or ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. TS-NEET-2027 or ID..."
                    value={testSeriesIdOrCode}
                    onChange={(e) => setTestSeriesIdOrCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleImport();
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-xs text-slate-900 dark:text-white outline-none font-mono"
                  />
                  <button
                    type="button"
                    disabled={importing || !testSeriesIdOrCode.trim()}
                    onClick={() => handleImport()}
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:opacity-90 transition disabled:opacity-50"
                  >
                    {importing ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>

              {/* Quick Select Available Test Series */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Or select from existing Test Series:
                </label>

                {loadingAvailable ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    Loading test series...
                  </div>
                ) : availableSeries.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    No other test series found.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {availableSeries.map((s) => {
                      const alreadyImported = importedList.some(
                        (item) => item.testSeries?.id === s.id
                      );
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {s.name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {s.code} &middot; {s.examType || "General"}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyImported || importing}
                            onClick={() => handleImport(s.code || s.id)}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            {alreadyImported ? "Imported" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
