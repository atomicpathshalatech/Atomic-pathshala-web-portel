"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  BookOpen,
  Download,
  FileText,
  X,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatISTDateTime } from "@/lib/date-utils";

interface UpcomingTestData {
  id: string;
  name: string;
  code?: string | null;
  testType: string;
  examType: string;
  durationMin: number;
  scheduledAt: string | null;
  batchId: string;
  batchName: string;
  chaptersCount: number;
  chapters: Array<{
    id: string;
    subject: string;
    chapterTitle: string;
    isComplete: boolean;
    topics: string[];
    customTopics?: string[];
  }>;
  syllabusPdfUrl: string;
  syllabusPdfDownloadUrl: string;
}

export function StudentUpcomingTestBanner() {
  const [testData, setTestData] = useState<UpcomingTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [syllabusModalOpen, setSyllabusModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  // Load upcoming test for student
  useEffect(() => {
    fetch("/api/student/upcoming-test")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.upcomingTest) {
          setTestData(json.data.upcomingTest);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Live countdown timer ticking every 1s
  useEffect(() => {
    if (!testData?.scheduledAt) {
      setTimeLeft(null);
      return;
    }

    const target = new Date(testData.scheduledAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [testData?.scheduledAt]);

  if (loading || !testData || dismissed) {
    return null;
  }

  const scheduledDateStr = testData.scheduledAt
    ? formatISTDateTime(testData.scheduledAt)
    : "To be announced";

  return (
    <>
      {/* Top Banner Card */}
      <div className="mb-4 relative overflow-hidden rounded-2xl border border-blue-200/90 dark:border-blue-900 bg-gradient-to-r from-blue-900 via-[#0c3ea4] to-indigo-900 text-white p-4 sm:px-6 shadow-md transition-all animate-in fade-in duration-200">
        {/* Subtle Decorative Backdrop Elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Test Details & Schedule */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-400/20 border border-blue-300/30 text-blue-200 text-[10px] font-extrabold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Upcoming Batch Test
              </span>
              <span className="text-xs text-blue-200/80 font-medium">
                {testData.batchName} &middot; {testData.examType}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                {testData.name}
              </h3>
              <span className="text-xs text-blue-300 font-semibold">
                ({testData.durationMin} Mins)
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-blue-100/90 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                <span>{scheduledDateStr}</span>
              </span>

              {testData.chaptersCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{testData.chaptersCount} Chapter(s) in Syllabus</span>
                </span>
              )}
            </div>
          </div>

          {/* Center / Right: Live Countdown Display */}
          {timeLeft && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 px-4 border border-white/15 flex items-center gap-3 shrink-0 self-start lg:self-auto">
              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  {timeLeft.isPast ? "Test In Progress / Live" : "Time Left"}
                </div>
                <div className="font-mono font-extrabold text-sm sm:text-base text-white tracking-wide">
                  {timeLeft.isPast ? (
                    <span className="text-emerald-300">Live Now</span>
                  ) : (
                    <span>
                      {timeLeft.days > 0 && `${timeLeft.days}d `}
                      {String(timeLeft.hours).padStart(2, "0")}h:
                      {String(timeLeft.minutes).padStart(2, "0")}m:
                      {String(timeLeft.seconds).padStart(2, "0")}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setSyllabusModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs shadow transition active:scale-95 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>View Test Syllabus</span>
            </button>

            <a
              href={testData.syllabusPdfDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 border border-white/20 text-white font-bold text-xs transition active:scale-95 flex items-center gap-1.5"
              title="Download Syllabus PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download PDF</span>
            </a>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-blue-300/70 hover:text-white hover:bg-white/10 transition ml-1"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Syllabus Modal Dialog */}
      {syllabusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                    Official Syllabus
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Atomic Pathshala · Learn • Explore • Excel
                  </span>
                </div>
                <h4 className="font-extrabold text-lg text-slate-900 dark:text-white mt-1">
                  {testData.name}
                </h4>
                <p className="text-xs text-slate-500">
                  {testData.batchName} &middot; Scheduled: {scheduledDateStr} &middot; Duration: {testData.durationMin} Mins
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSyllabusModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Scrollable Subject-Wise Chapters List */}
            {(() => {
              const subjectsMap: Record<string, typeof testData.chapters> = {};
              for (const ch of testData.chapters || []) {
                const sub = ch.subject || "General";
                if (!subjectsMap[sub]) subjectsMap[sub] = [];
                subjectsMap[sub].push(ch);
              }

              if (testData.chapters.length === 0) {
                return (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                    Full Syllabus Assessment covering all topics according to the latest {testData.examType} syllabus.
                  </div>
                );
              }

              return (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {Object.entries(subjectsMap).map(([subject, chList]) => (
                    <div
                      key={subject}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden shadow-2xs"
                    >
                      {/* Compact Subject Header */}
                      <div className="bg-slate-50 dark:bg-slate-800/80 px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                          <h5 className="font-extrabold text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                            {subject}
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900">
                          {chList.length} Chapter{chList.length > 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Chapters in this subject box */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {chList.map((ch, idx) => (
                          <div key={ch.id || idx} className="px-3.5 py-2 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                                  {idx + 1}.
                                </span>
                                <span className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                                  {ch.chapterTitle}
                                </span>
                              </div>

                              {ch.isComplete ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Complete Chapter</span>
                                </span>
                              ) : null}
                            </div>

                            {/* Topics if not complete */}
                            {!ch.isComplete && ch.topics && ch.topics.length > 0 && (
                              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4">
                                {ch.topics.map((t, tIdx) => (
                                  <li key={tIdx}>{t}</li>
                                ))}
                              </ul>
                            )}

                            {/* Custom Topics if any */}
                            {ch.customTopics && ch.customTopics.length > 0 && (
                              <div className="pt-0.5 pl-4">
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                                  Special Topics:
                                </span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {ch.customTopics.map((ct, ctIdx) => (
                                    <span
                                      key={ctIdx}
                                      className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-[10px] font-medium border border-amber-200/60"
                                    >
                                      {ct}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <a
                href={testData.syllabusPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Open Printable Page</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSyllabusModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Close
                </button>

                <a
                  href={testData.syllabusPdfDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Syllabus PDF</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
