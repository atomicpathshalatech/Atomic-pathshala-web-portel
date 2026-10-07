"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { canStudentJoinClass, getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import type {
  StudentBatchHomeData,
  BatchClassItem,
  BatchChapterItem,
  BatchTestItem,
  BatchDppItem,
  AcademicEvent,
  BatchPdfItem,
  BatchPdfCategory,
  BatchModuleItem,
  BatchDoubtSlotItem,
  StudentDoubtBookingItem,
} from "@/lib/batch/student-batch-home";
import { CustomPdfReader } from "@/components/ui/CustomPdfReader";

export type BatchTab =
  | "schedule"
  | "recorded"
  | "dpp"
  | "tests"
  | "materials"
  | "mentorship"
  | "notices"
  | "info";

const TABS: { id: BatchTab; label: string; icon: string }[] = [
  { id: "schedule", label: "Schedule", icon: "calendar_month" },
  { id: "recorded", label: "Recorded Class", icon: "smart_display" },
  { id: "dpp", label: "DPP", icon: "assignment" },
  { id: "tests", label: "Test", icon: "quiz" },
  { id: "materials", label: "PDF / Material", icon: "picture_as_pdf" },
  { id: "mentorship", label: "Mentorship", icon: "support_agent" },
  { id: "notices", label: "Notices", icon: "campaign" },
  { id: "info", label: "Batch Info", icon: "info" },
];

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const timeFmt = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const dateFmt = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const sizeFmt = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

function getDateHeading(dateStr: string, todayKey: string, tomorrowKey: string) {
  if (dateStr === todayKey) return "TODAY";
  if (dateStr === tomorrowKey) return "TOMORROW";
  const d = new Date(dateStr);
  const dayName = d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long" }).toUpperCase();
  const dateFormatted = d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" });
  return `${dayName} · ${dateFormatted}`;
}

export function StudentBatchHome({
  data,
  initialTab = "schedule",
}: {
  data: StudentBatchHomeData;
  initialTab?: BatchTab;
}) {
  const [tab, setTab] = useState<BatchTab>(() => {
    if (initialTab === ("timeline" as any) || initialTab === ("classes" as any)) return "schedule";
    if (initialTab === ("pdfs" as any) || initialTab === ("modules" as any)) return "materials";
    if (initialTab === ("faculty" as any)) return "mentorship";
    return initialTab;
  });

  const [now, setNow] = useState(() => new Date());

  // Nested Navigation States (Synchronized with browser history for native back)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedPdfCategory, setSelectedPdfCategory] = useState<BatchPdfCategory>("ALL");

  // Mentorship booking modal state
  const [bookingSlot, setBookingSlot] = useState<BatchDoubtSlotItem | null>(null);
  const [bookingTopic, setBookingTopic] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // PDF Viewer Modal
  const [activePdf, setActivePdf] = useState<{
    title: string;
    pdfUrl: string;
    fileName?: string;
    allowDownload?: boolean;
    totalPages?: number | null;
  } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Update browser history for native back button support
  const pushNavState = useCallback((newTab: BatchTab, subjectId?: string | null, chapterId?: string | null, pdfCat?: BatchPdfCategory) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      if (subjectId) url.searchParams.set("subject", subjectId);
      else url.searchParams.delete("subject");
      if (chapterId) url.searchParams.set("chapter", chapterId);
      else url.searchParams.delete("chapter");
      if (pdfCat && pdfCat !== "ALL") url.searchParams.set("category", pdfCat);
      else url.searchParams.delete("category");

      window.history.pushState(
        { tab: newTab, subjectId: subjectId || null, chapterId: chapterId || null, category: pdfCat || "ALL" },
        "",
        url.toString()
      );
    } catch {}
  }, []);

  // Listen to popstate (browser/mobile native back button)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (activePdf) {
        setActivePdf(null);
        return;
      }
      if (bookingSlot) {
        setBookingSlot(null);
        return;
      }

      const state = e.state;
      if (state) {
        if (state.tab) setTab(state.tab);
        setSelectedSubjectId(state.subjectId || null);
        setSelectedChapterId(state.chapterId || null);
        setSelectedPdfCategory(state.category || "ALL");
      } else {
        // Parse from current URL
        const u = new URL(window.location.href);
        const t = u.searchParams.get("tab") as BatchTab | null;
        if (t) setTab(t);
        setSelectedSubjectId(u.searchParams.get("subject") || null);
        setSelectedChapterId(u.searchParams.get("chapter") || null);
        setSelectedPdfCategory((u.searchParams.get("category") as BatchPdfCategory) || "ALL");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activePdf, bookingSlot]);

  // Tab switcher
  const switchTab = (newTab: BatchTab) => {
    setTab(newTab);
    setSelectedSubjectId(null);
    setSelectedChapterId(null);
    pushNavState(newTab, null, null, selectedPdfCategory);
  };

  // Group Subjects for Recorded Classes
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; chapters: BatchChapterItem[] }>();
    for (const ch of data.chapters) {
      if (!map.has(ch.subjectId)) {
        map.set(ch.subjectId, { id: ch.subjectId, title: ch.subject, chapters: [] });
      }
      map.get(ch.subjectId)!.chapters.push(ch);
    }
    return Array.from(map.values());
  }, [data.chapters]);

  const selectedSubject = useMemo(
    () => subjectGroups.find((s) => s.id === selectedSubjectId) || null,
    [subjectGroups, selectedSubjectId]
  );

  const selectedChapter = useMemo(
    () => selectedSubject?.chapters.find((c) => c.id === selectedChapterId) || null,
    [selectedSubject, selectedChapterId]
  );

  // Group Timeline Events by Date for Schedule
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 86_400_000));

  const groupedTimeline = useMemo(() => {
    const map = new Map<string, AcademicEvent[]>();
    for (const ev of data.timelineEvents) {
      if (!map.has(ev.dateKey)) map.set(ev.dateKey, []);
      map.get(ev.dateKey)!.push(ev);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [data.timelineEvents]);

  // Filtered PDFs by category
  const filteredPdfs = useMemo(() => {
    if (selectedPdfCategory === "ALL") return data.allPdfs;
    return data.allPdfs.filter((p) => p.category === selectedPdfCategory);
  }, [data.allPdfs, selectedPdfCategory]);

  // Book Mentorship Slot Handler
  const handleConfirmBooking = async () => {
    if (!bookingSlot) return;
    setIsSubmittingBooking(true);
    try {
      const res = await fetch(`/api/doubt-booking/slots/${bookingSlot.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: bookingTopic }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to book slot");
      }
      toast.success("Mentorship session booked successfully!");
      setBookingSlot(null);
      setBookingTopic("");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to book mentorship session");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4 space-y-3">
      {/* ========================================================================= */}
      {/* 1. MINIMAL THIN BATCH HEADER (Requirements 1 & 2)                         */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111b21] shadow-xs px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {data.batch.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.batch.thumbnailUrl}
              alt=""
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0 border border-slate-200/80 dark:border-slate-700"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-inner">
              {data.batch.name.charAt(0)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {data.batch.name}
              </h1>
              {data.batch.exam && (
                <span className="hidden sm:inline-block px-2 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                  {data.batch.exam}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {data.batch.code} {data.batch.teachers.length > 0 && `• ${data.batch.teachers[0]}`}
            </p>
          </div>
        </div>

        {/* Desktop Minimal Navigation Link */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/courses"
            className="text-slate-500 hover:text-emerald-600 transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>All Batches</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB NAVIGATION BAR (Requirement 3: "Live" Tab Removed)                 */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-xs">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm font-bold"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. SCHEDULE TAB — COMPACT CLASS CARDS + UPCOMING TESTS (Req 4, 5, 10)     */}
      {/* ========================================================================= */}
      {tab === "schedule" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {groupedTimeline.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
                event_busy
              </span>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No scheduled classes or tests yet
              </p>
            </div>
          ) : (
            groupedTimeline.map(([dKey, events]) => (
              <div key={dKey} className="space-y-2">
                {/* Date Header Badge */}
                <div className="flex items-center gap-2 px-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {getDateHeading(dKey, todayKey, tomorrowKey)}
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60 dark:border-slate-800" />
                </div>

                {/* Compact 1/3-width Grid Layout (Requirement 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {events.map((ev) => {
                    const isLive = ev.status === "LIVE_NOW";
                    const isTest = ev.type === "TEST";
                    const isCompleted = ev.status === "COMPLETED" || ev.status === "SUBMITTED";

                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between bg-white dark:bg-[#111b21] ${
                          isLive
                            ? "border-red-400 dark:border-red-800/80 ring-2 ring-red-500/20 shadow-sm"
                            : isTest
                            ? "border-purple-200 dark:border-purple-900/60 hover:border-purple-300"
                            : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          {/* Top Row: Subject Tag + Status Badge */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[60%]">
                              {ev.subject}
                            </span>

                            {isLive ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                LIVE
                              </span>
                            ) : isTest ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9.5px] font-bold uppercase">
                                Scheduled Test
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-semibold ${
                                  isCompleted ? "text-slate-400" : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {isCompleted ? "Completed" : timeFmt(ev.startsAt)}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white line-clamp-1 leading-snug">
                            {ev.title}
                          </h4>

                          {/* Faculty & Chapter */}
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {ev.teacherName || ev.chapter || "Academic Session"}
                          </p>
                        </div>

                        {/* Bottom Row: Time & Action Button */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <span className="text-[10.5px] text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            {timeFmt(ev.startsAt)}
                          </span>

                          {ev.actionHref ? (
                            <Link
                              href={ev.actionHref}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                isLive
                                  ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                  : isTest
                                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                  : isCompleted
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              }`}
                            >
                              {ev.actionLabel}
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-medium">
                              {ev.actionLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECORDED CLASS NAVIGATION (Requirement 6)                              */}
      {/* ========================================================================= */}
      {tab === "recorded" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Level 1: Subject Selection */}
          {!selectedSubjectId && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Select Subject
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {subjectGroups.map((subj) => {
                  const totalLectures = subj.chapters.reduce((s, c) => s + c.lectures, 0);
                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(subj.id);
                        pushNavState("recorded", subj.id, null);
                      }}
                      className="p-4 rounded-2xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-base mb-3 group-hover:scale-105 transition">
                        {subj.title.charAt(0)}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                        {subj.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {subj.chapters.length} Chapters • {totalLectures} Lectures
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Level 2: Chapter Selection */}
          {selectedSubjectId && !selectedChapterId && selectedSubject && (
            <div>
              {/* Breadcrumb Header */}
              <div className="flex items-center gap-2 mb-3 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(null);
                    pushNavState("recorded", null, null);
                  }}
                  className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Subjects
                </button>
                <span className="text-slate-400">/</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedSubject.title}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {selectedSubject.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChapterId(ch.id);
                      pushNavState("recorded", selectedSubjectId, ch.id);
                    }}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 text-left transition flex items-center justify-between group shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                          {ch.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {ch.lectures} Lectures • {ch.dpps} DPPs • {ch.tests} Tests
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level 3: Lecture List in Chapter */}
          {selectedSubjectId && selectedChapterId && selectedChapter && (
            <div>
              {/* Breadcrumb Header */}
              <div className="flex items-center gap-2 mb-3 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterId(null);
                    pushNavState("recorded", selectedSubjectId, null);
                  }}
                  className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  {selectedSubject?.title}
                </button>
                <span className="text-slate-400">/</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {selectedChapter.title}
                </span>
              </div>

              {selectedChapter.lectureList && selectedChapter.lectureList.length > 0 ? (
                <div className="space-y-2">
                  {selectedChapter.lectureList.map((lec, lIdx) => (
                    <div
                      key={lec.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-center shrink-0">
                          {lIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {lec.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{lec.duration || 45} mins</span>
                            {lec.slidesUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActivePdf({
                                    title: `${lec.title} (Notes)`,
                                    pdfUrl: lec.slidesUrl!,
                                    fileName: `${lec.title}-Notes.pdf`,
                                  })
                                }
                                className="text-emerald-600 font-bold hover:underline flex items-center gap-0.5"
                              >
                                <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
                                Class Notes
                              </button>
                            )}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/watch/${lec.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                        Play
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">No lectures uploaded for this chapter yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DPP TAB — ATTEMPTED DATA PRESERVED + 1/3 WIDTH CARDS (Req 7 & 8)       */}
      {/* ========================================================================= */}
      {tab === "dpp" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.dpps.map((dpp) => {
              const isAttempted = dpp.isAttempted;
              return (
                <div
                  key={dpp.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between bg-white dark:bg-[#111b21] ${
                    isAttempted
                      ? "border-emerald-300 dark:border-emerald-900/60"
                      : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div>
                    {/* Top Status & Code */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate">
                        {dpp.subject}
                      </span>

                      {isAttempted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-extrabold uppercase tracking-wide flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          Attempted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9.5px] font-semibold uppercase">
                          Available
                        </span>
                      )}
                    </div>

                    {/* Title & Chapter */}
                    <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white line-clamp-1">
                      {dpp.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {dpp.chapter} • {dpp.questionCount} Questions
                    </p>

                    {/* Attempted Stats Banner (Requirement 7) */}
                    {isAttempted && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 grid grid-cols-3 gap-1 text-center">
                        <div>
                          <p className="text-[10px] text-slate-500">Score</p>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {dpp.score ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Correct</p>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {dpp.correctCount ?? 0}/{dpp.questionCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Accuracy</p>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {dpp.accuracy ?? 0}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10.5px] text-slate-400">
                      {dpp.durationMin} mins
                    </span>

                    <Link
                      href={dpp.href || `/dpp/${dpp.id}/attempt`}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs ${
                        isAttempted
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {dpp.actionLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TEST TAB — COMPLETED & UPCOMING TESTS (Req 9 & 10)                     */}
      {/* ========================================================================= */}
      {tab === "tests" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.tests.map((test) => {
              const isSubmitted = test.attemptStatus === "SUBMITTED";
              const isUpcoming = test.isUpcoming;

              return (
                <div
                  key={test.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between bg-white dark:bg-[#111b21] ${
                    isSubmitted
                      ? "border-emerald-300 dark:border-emerald-900/60"
                      : isUpcoming
                      ? "border-purple-200 dark:border-purple-900/60"
                      : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div>
                    {/* Status Pill */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate">
                        {test.subject}
                      </span>

                      {isSubmitted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-extrabold uppercase">
                          Completed
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[9.5px] font-bold uppercase">
                          Upcoming
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9.5px] font-bold uppercase">
                          Live Now
                        </span>
                      )}
                    </div>

                    <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white line-clamp-1">
                      {test.name}
                    </h4>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {test.durationMin} mins • {test.totalMarks} Marks
                    </p>

                    {/* Attempt Results if Completed */}
                    {isSubmitted && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 grid grid-cols-2 gap-1 text-center">
                        <div>
                          <p className="text-[10px] text-slate-500">Score</p>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {test.score ?? 0} / {test.maxScore}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Accuracy</p>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {test.accuracy ?? 0}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10.5px] text-slate-400">
                      {test.openTime ? dateFmt(test.openTime) : "Test"}
                    </span>

                    {test.actionHref ? (
                      <Link
                        href={test.actionHref}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          isSubmitted
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                            : "bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                        }`}
                      >
                        {test.actionLabel}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic font-medium">
                        {test.actionLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PDF / STUDY MATERIAL TAB — CATEGORY SELECTOR FIRST (Req 11 & 12)       */}
      {/* ========================================================================= */}
      {tab === "materials" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Category Filter Pills on Top */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "ALL", label: "All PDF" },
              { id: "CLASS_NOTES", label: "Class Notes" },
              { id: "DPP", label: "DPP Sheets" },
              { id: "TESTS", label: "Test Papers" },
              { id: "MODULES", label: "Module Notes" },
              { id: "SYLLABUS", label: "Syllabus" },
              { id: "PLANNER", label: "Planner" },
            ].map((cat) => {
              const isSel = selectedPdfCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedPdfCategory(cat.id as BatchPdfCategory);
                    pushNavState("materials", null, null, cat.id as BatchPdfCategory);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isSel
                      ? "bg-emerald-600 text-white shadow-xs font-bold"
                      : "bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Filtered File Grid */}
          {filteredPdfs.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">description</span>
              <p className="text-xs text-slate-500">No documents in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredPdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {pdf.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {pdf.subject} {pdf.chapter && `• ${pdf.chapter}`} • {sizeFmt(pdf.sizeBytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePdf({
                          title: pdf.title,
                          pdfUrl: pdf.fileUrl,
                          fileName: pdf.fileName,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition"
                    >
                      View
                    </button>

                    <a
                      href={pdf.fileUrl}
                      download={pdf.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center transition"
                      title="Download"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. ONE-TO-ONE MENTORSHIP SESSION TAB (Requirement 13)                     */}
      {/* ========================================================================= */}
      {tab === "mentorship" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Active Bookings Banner if any */}
          {data.studentBookings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Your Booked Mentorship Sessions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.studentBookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9.5px] font-bold uppercase">
                        {bk.status}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        Mentor: {bk.teacherName}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {dateFmt(bk.startsAt)} at {timeFmt(bk.startsAt)}
                      </p>
                    </div>

                    {bk.meetingUrl && (
                      <Link
                        href={bk.meetingUrl}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                      >
                        Join Room
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Slots */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Available Mentorship Slots
            </h3>
            {data.doubtSlots.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                  calendar_today
                </span>
                <p className="text-xs text-slate-500">No open mentorship slots available today</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {data.doubtSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        {slot.teacherPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slot.teacherPhotoUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                            {slot.teacherName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {slot.teacherName}
                          </h4>
                          <p className="text-[10.5px] text-slate-400">{slot.subject}</p>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {dateFmt(slot.startsAt)} • {timeFmt(slot.startsAt)}
                      </p>
                      <p className="text-[11px] text-slate-400">Duration: {slot.durationMinutes} mins</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBookingSlot(slot)}
                      className="mt-3 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      Book 1-on-1 Session
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. NOTICES TAB (Requirement 14)                                           */}
      {/* ========================================================================= */}
      {tab === "notices" && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          {data.notices.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">campaign</span>
              <p className="text-xs text-slate-500">No notices posted yet</p>
            </div>
          ) : (
            data.notices.map((nt) => (
              <div
                key={nt.id}
                className="p-4 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-bold text-emerald-600 uppercase tracking-wider">
                    Official Notice
                  </span>
                  <span>{new Date(nt.createdAt).toLocaleDateString("en-IN", { timeZone: IST })}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{nt.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{nt.body}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. BATCH INFO TAB — CLEAN TEXT + NO AI VISUAL ICONS (Req 15, 16 & 17)    */}
      {/* ========================================================================= */}
      {tab === "info" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Overview & Description */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Batch Overview & Curriculum
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {data.batch.description ||
                `${data.batch.name} is a comprehensive preparatory program designed for ${
                  data.batch.exam || "competitive examinations"
                }. The program features structured live lectures, curated DPP practice sets, full syllabus mock tests, class notes, and one-to-one faculty mentorship.`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Batch Code</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {data.batch.code}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Target Examination</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {data.batch.exam || "National Level"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Access Status</p>
                <p className="text-xs font-bold text-emerald-600">Active & Enrolled</p>
              </div>
            </div>
          </div>

          {/* Assigned Educators & Faculty (Dynamically Resolved) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Assigned Educators
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.batch.teacherCards.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/40"
                >
                  {t.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.photoUrl}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {t.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {t.name}
                    </h4>
                    <p className="text-[11px] text-emerald-600 font-semibold truncate">
                      {t.subjects.join(", ") || t.department || "Faculty"}
                    </p>
                    {t.experienceYears && (
                      <p className="text-[10px] text-slate-400">{t.experienceYears} Experience</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. MODALS (Mentorship Booking & PDF Viewer)                              */}
      {/* ========================================================================= */}

      {/* Mentorship Booking Modal */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Book Mentorship Session
              </h3>
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">Mentor:</strong> {bookingSlot.teacherName} (
                {bookingSlot.subject})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">Time:</strong> {dateFmt(bookingSlot.startsAt)} at{" "}
                {timeFmt(bookingSlot.startsAt)} ({bookingSlot.durationMinutes} mins)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Discussion Topic / Doubt (Optional)
              </label>
              <textarea
                rows={3}
                value={bookingTopic}
                onChange={(e) => setBookingTopic(e.target.value)}
                placeholder="What topics or questions would you like guidance on?"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBooking}
                onClick={handleConfirmBooking}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined text-sm ${isSubmittingBooking ? "animate-spin" : ""}`}>
                  {isSubmittingBooking ? "progress_activity" : "check"}
                </span>
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Reader Modal */}
      {activePdf && (
        <CustomPdfReader
          isOpen={true}
          title={activePdf.title}
          pdfUrl={activePdf.pdfUrl}
          fileName={activePdf.fileName}
          allowDownload={activePdf.allowDownload ?? true}
          totalPages={activePdf.totalPages}
          onClose={() => setActivePdf(null)}
        />
      )}
    </div>
  );
}
