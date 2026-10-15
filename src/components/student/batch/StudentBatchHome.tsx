"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  StudentBatchHomeData,
  BatchChapterItem,
  BatchPdfCategory,
  BatchDoubtSlotItem,
  AcademicEvent,
} from "@/lib/batch/student-batch-home";
import { CustomPdfReader } from "@/components/ui/CustomPdfReader";

export type BatchTab =
  | "home"
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
  initialTab = "home",
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
  const [selectedPdfCategory, setSelectedPdfCategory] = useState<BatchPdfCategory | null>(null);

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
  const pushNavState = useCallback(
    (newTab: BatchTab, subjectId?: string | null, chapterId?: string | null, pdfCat?: BatchPdfCategory | null) => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", newTab);
        if (subjectId) url.searchParams.set("subject", subjectId);
        else url.searchParams.delete("subject");
        if (chapterId) url.searchParams.set("chapter", chapterId);
        else url.searchParams.delete("chapter");
        if (pdfCat) url.searchParams.set("category", pdfCat);
        else url.searchParams.delete("category");

        window.history.pushState(
          { tab: newTab, subjectId: subjectId || null, chapterId: chapterId || null, category: pdfCat || null },
          "",
          url.toString()
        );
      } catch {}
    },
    []
  );

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
        setSelectedPdfCategory(state.category || null);
      } else {
        const u = new URL(window.location.href);
        const t = u.searchParams.get("tab") as BatchTab | null;
        if (t) setTab(t);
        setSelectedSubjectId(u.searchParams.get("subject") || null);
        setSelectedChapterId(u.searchParams.get("chapter") || null);
        setSelectedPdfCategory((u.searchParams.get("category") as BatchPdfCategory) || null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activePdf, bookingSlot]);

  // One line under each section box.
  const sectionHint = (id: BatchTab): string => {
    const n = now.getTime();
    switch (id) {
      case "schedule": {
        const today = data.timelineEvents.filter((e) => e.dateKey === todayKey).length;
        const live = data.timelineEvents.some((e) => e.status === "LIVE_NOW");
        if (live) return "Live now";
        return today ? `${today} today` : `${data.timelineEvents.filter((e) => new Date(e.startsAt).getTime() > n).length} upcoming`;
      }
      case "recorded":
        return `${data.chapters.length} chapters`;
      case "dpp":
        return `${data.dpps.length} DPPs`;
      case "tests": {
        const up = data.tests.filter((t) => t.openTime && new Date(t.openTime).getTime() > n).length;
        return up ? `${data.tests.length} tests · ${up} upcoming` : `${data.tests.length} tests`;
      }
      case "materials":
        return `${data.allPdfs.length} PDFs`;
      case "mentorship":
        return data.doubtSlots.length ? `${data.doubtSlots.length} slots open` : "Teachers & availability";
      case "notices":
        return data.notices.length ? `${data.notices.length} notices` : "No notices";
      case "info":
        return `${data.batch.teacherCards.length} teachers`;
      default:
        return "";
    }
  };

  // Tab switcher
  const switchTab = (newTab: BatchTab) => {
    setTab(newTab);
    setSelectedSubjectId(null);
    setSelectedChapterId(null);
    setSelectedPdfCategory(null);
    pushNavState(newTab, null, null, null);
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

  // Group Timeline Events by Date for Schedule (TODAY first, then TOMORROW, then upcoming ascending, then past descending)
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 86_400_000));

  const groupedTimeline = useMemo(() => {
    const map = new Map<string, AcademicEvent[]>();
    for (const ev of data.timelineEvents) {
      if (!map.has(ev.dateKey)) map.set(ev.dateKey, []);
      map.get(ev.dateKey)!.push(ev);
    }

    // Sort events inside each date ascending by scheduled time
    for (const [, list] of map.entries()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    const todayEntries: [string, AcademicEvent[]][] = [];
    const tomorrowEntries: [string, AcademicEvent[]][] = [];
    const upcomingEntries: [string, AcademicEvent[]][] = [];
    const pastEntries: [string, AcademicEvent[]][] = [];

    for (const entry of map.entries()) {
      const dKey = entry[0];
      if (dKey === todayKey) {
        todayEntries.push(entry);
      } else if (dKey === tomorrowKey) {
        tomorrowEntries.push(entry);
      } else if (dKey > todayKey) {
        upcomingEntries.push(entry);
      } else {
        pastEntries.push(entry);
      }
    }

    upcomingEntries.sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
    pastEntries.sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());

    return [...todayEntries, ...tomorrowEntries, ...upcomingEntries, ...pastEntries];
  }, [data.timelineEvents, todayKey, tomorrowKey]);

  // Filtered PDFs by category
  const filteredPdfs = useMemo(() => {
    if (!selectedPdfCategory || selectedPdfCategory === "ALL") return data.allPdfs;
    return data.allPdfs.filter((p) => p.category === selectedPdfCategory);
  }, [data.allPdfs, selectedPdfCategory]);

  // Mentorship Booking Handler
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
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-3 space-y-3">
      {/* ========================================================================= */}
      {/* 1. MINIMAL THIN BATCH HEADER (Requirements 4 & 52)                        */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-sky-200/70 dark:border-sky-900/40 bg-[#f5faff] dark:bg-[#0f1722] shadow-xs px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {data.batch.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.batch.thumbnailUrl}
              alt=""
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shrink-0 border border-sky-200/80 dark:border-sky-800"
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
              {data.batch.name.charAt(0)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {data.batch.name}
              </h1>
              {data.batch.exam && (
                <span className="px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-[9.5px]">
                  {data.batch.exam}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Minimal Back / Navigation Link */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
          <Link
            href="/courses"
            className="text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>All Batches</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SECTION BOXES — like the home page; a box opens its section          */}
      {/* ========================================================================= */}
      {tab === "home" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className="group rounded-2xl bg-white dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 p-3 sm:p-3.5 flex flex-col items-start gap-2 text-left shadow-2xs hover:border-sky-400 hover:shadow-sm transition"
            >
              <span className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center group-hover:scale-105 transition">
                <span className="material-symbols-outlined text-[22px]">{t.icon}</span>
              </span>
              <span className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">{t.label}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{sectionHint(t.id)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => switchTab("home")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-400 transition"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            All sections
          </button>
          <span className="material-symbols-outlined text-[18px] text-sky-600">{TABS.find((t) => t.id === tab)?.icon}</span>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{TABS.find((t) => t.id === tab)?.label}</h2>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SCHEDULE TAB — SLIM 1/3 CARDS CONNECTED VIA VERTICAL TIMELINE LINE    */}
      {/* ========================================================================= */}
      {tab === "schedule" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {groupedTimeline.length === 0 ? (
            <div className="p-10 text-center bg-[#f2f8fe] dark:bg-[#0f1722] rounded-2xl border border-sky-200/70 dark:border-sky-900/40">
              <span className="material-symbols-outlined text-3xl text-sky-300 dark:text-sky-600 mb-1">
                event_busy
              </span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No scheduled classes or tests found
              </p>
            </div>
          ) : (
            groupedTimeline.map(([dKey, events]) => (
              <div key={dKey} className="space-y-2">
                {/* Date Header Badge */}
                <div className="flex items-center gap-2 px-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100/90 dark:bg-sky-950/80 text-[10.5px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    {getDateHeading(dKey, todayKey, tomorrowKey)}
                  </span>
                  <div className="flex-1 h-px bg-sky-200/60 dark:bg-sky-950" />
                  <span className="text-[10px] text-slate-400 font-medium">
                    {events.length} {events.length === 1 ? "class" : "classes"}
                  </span>
                </div>

                {/* Thin rows: teacher photo · class name over teacher name · subject · time and status */}
                <div className="space-y-1.5">
                  {events.map((ev) => {
                    const isLive = ev.status === "LIVE_NOW";
                    const isTest = ev.type === "TEST";
                    const isCompleted = ev.status === "COMPLETED" || ev.status === "SUBMITTED";
                    const chip = isLive
                      ? { label: "LIVE", cls: "bg-red-600 text-white animate-pulse" }
                      : isCompleted
                      ? { label: "Done", cls: "bg-slate-100 dark:bg-slate-800 text-slate-500" }
                      : ev.status === "CANCELLED"
                      ? { label: "Cancelled", cls: "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through" }
                      : ev.status === "UPCOMING"
                      ? { label: "Upcoming", cls: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300" }
                      : ev.status === "ATTEMPTED"
                      ? { label: "In progress", cls: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" }
                      : { label: "Open", cls: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" };
                    const row = (
                      <div
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border bg-white dark:bg-[#111a26] transition ${
                          isLive
                            ? "border-red-300 dark:border-red-800/70"
                            : "border-sky-100 dark:border-sky-900/40 hover:border-sky-300"
                        }`}
                      >
                        {ev.teacherPhotoUrl && !isTest ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ev.teacherPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                              isTest ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                            }`}
                          >
                            {isTest ? <span className="material-symbols-outlined text-[16px]">quiz</span> : (ev.teacherName || "F").charAt(0)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">{ev.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                            {ev.teacherName || (isTest ? "Test" : "Faculty")}
                            {ev.subject ? ` · ${ev.subject}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{timeFmt(ev.startsAt)}</span>
                          <span className={`px-1.5 py-px rounded text-[9.5px] font-bold uppercase tracking-wide ${chip.cls}`}>{chip.label}</span>
                        </div>
                      </div>
                    );
                    return ev.actionHref ? (
                      <Link key={ev.id} href={ev.actionHref} className="block" title={ev.actionLabel}>
                        {row}
                      </Link>
                    ) : (
                      <div key={ev.id}>{row}</div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECORDED CLASSES TAB (Requirements 13, 14, 15)                         */}
      {/* ========================================================================= */}
      {tab === "recorded" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Level 1: Subject Selection */}
          {!selectedSubjectId && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Select Subject
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
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
                      className="p-3.5 rounded-2xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 hover:border-sky-400 text-left transition group shadow-xs flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition">
                        {subj.title.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 transition">
                          {subj.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {subj.chapters.length} Chapters • {totalLectures} Lectures
                        </p>
                      </div>
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
              <div className="flex items-center gap-2 mb-2.5 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(null);
                    pushNavState("recorded", null, null);
                  }}
                  className="font-bold text-sky-600 hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Subjects
                </button>
                <span className="text-slate-400">/</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedSubject.title}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedSubject.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChapterId(ch.id);
                      pushNavState("recorded", selectedSubjectId, ch.id);
                    }}
                    className="p-3 rounded-xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 hover:border-sky-400 text-left transition flex items-center justify-between group shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 transition">
                          {ch.title}
                        </h4>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {ch.lectures} Lectures • {ch.dpps} DPPs • {ch.tests} Tests
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sky-400 group-hover:text-sky-600 group-hover:translate-x-1 transition text-lg">
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
              <div className="flex items-center gap-2 mb-2.5 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterId(null);
                    pushNavState("recorded", selectedSubjectId, null);
                  }}
                  className="font-bold text-sky-600 hover:underline flex items-center gap-0.5"
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
                      className="p-3 rounded-xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 flex items-center justify-between gap-2.5 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-black flex items-center justify-center shrink-0">
                          {lIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {lec.title}
                          </h4>
                          <p className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-2">
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
                                className="text-sky-600 font-bold hover:underline flex items-center gap-0.5"
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
                        className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-xs">play_arrow</span>
                        Play
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#f2f8fe] dark:bg-[#0f1722] rounded-xl border border-sky-200/70 dark:border-sky-900/40">
                  <p className="text-xs text-slate-500">No lectures uploaded for this chapter yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DPP TAB — ATTEMPTED STATE & COMPACT CARDS (Req 16, 17, 18, 19, 20)     */}
      {/* ========================================================================= */}
      {tab === "dpp" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.dpps.map((dpp) => {
              const isAttempted = dpp.isAttempted;
              return (
                <div
                  key={dpp.id}
                  className="p-3 rounded-xl border border-sky-200/70 dark:border-sky-900/40 bg-[#f5faff] dark:bg-[#111a26] shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Top Status & Code */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider bg-sky-100/70 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 truncate">
                        {dpp.subject}
                      </span>

                      {isAttempted ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">check_circle</span>
                          Attempted
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-full bg-sky-100/60 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[9px] font-semibold uppercase">
                          Available
                        </span>
                      )}
                    </div>

                    {/* Title & Chapter */}
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white line-clamp-1">
                      {dpp.title}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {dpp.chapter} • {dpp.questionCount} Questions
                    </p>

                    {/* Attempted Stats Display (Requirement 16 & 17) */}
                    {isAttempted && (
                      <div className="mt-2 p-1.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 grid grid-cols-3 gap-1 text-center">
                        <div>
                          <p className="text-[9.5px] text-slate-500">Score</p>
                          <p className="text-xs font-black text-sky-700 dark:text-sky-300">
                            {dpp.score ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] text-slate-500">Correct</p>
                          <p className="text-xs font-black text-sky-700 dark:text-sky-300">
                            {dpp.correctCount ?? 0}/{dpp.questionCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] text-slate-500">Accuracy</p>
                          <p className="text-xs font-black text-sky-700 dark:text-sky-300">
                            {dpp.accuracy ?? 0}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-sky-100/80 dark:border-sky-950/60">
                    <span className="text-[10px] text-slate-400">
                      {dpp.durationMin} mins
                    </span>

                    <Link
                      href={dpp.href || `/dpp/${dpp.id}/attempt`}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs ${
                        isAttempted
                          ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 hover:bg-sky-200"
                          : "bg-sky-600 hover:bg-sky-700 text-white"
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
      {/* 6. TEST TAB — UPCOMING & COMPLETED (Requirements 23, 24, 25, 26, 27)      */}
      {/* ========================================================================= */}
      {tab === "tests" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.tests.map((test) => {
              const isSubmitted = test.attemptStatus === "SUBMITTED";
              const isUpcoming = test.isUpcoming;

              return (
                <div
                  key={test.id}
                  className="p-3 rounded-xl border border-sky-200/70 dark:border-sky-900/40 bg-[#f5faff] dark:bg-[#111a26] shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Status Pill */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider bg-sky-100/70 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 truncate">
                        {test.subject}
                      </span>

                      {isSubmitted ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold uppercase">
                          Completed
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[9px] font-bold uppercase">
                          Upcoming
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[9px] font-bold uppercase">
                          Live Now
                        </span>
                      )}
                    </div>

                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white line-clamp-1">
                      {test.name}
                    </h4>

                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {test.durationMin} mins • {test.totalMarks} Marks
                    </p>

                    {/* Attempt Results if Completed */}
                    {isSubmitted && (
                      <div className="mt-2 p-1.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 grid grid-cols-2 gap-1 text-center">
                        <div>
                          <p className="text-[9.5px] text-slate-500">Score</p>
                          <p className="text-xs font-black text-sky-700 dark:text-sky-300">
                            {test.score ?? 0} / {test.maxScore}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] text-slate-500">Accuracy</p>
                          <p className="text-xs font-black text-sky-700 dark:text-sky-300">
                            {test.accuracy ?? 0}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-sky-100/80 dark:border-sky-950/60">
                    <span className="text-[10px] text-slate-400">
                      {test.openTime ? dateFmt(test.openTime) : "Test"}
                    </span>

                    {test.actionHref ? (
                      <Link
                        href={test.actionHref}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          isSubmitted
                            ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 hover:bg-sky-200"
                            : "bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                        }`}
                      >
                        {test.actionLabel}
                      </Link>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 italic font-medium">
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
      {/* 7. PDF / MATERIAL TAB (Requirements 28, 29, 30, 31, 32, 33, 34)           */}
      {/* ========================================================================= */}
      {tab === "materials" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Level 1: Category Selector Boxes (Requirement 28) */}
          {!selectedPdfCategory ? (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Select Material Category
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[
                  { id: "ALL", label: "All PDF", icon: "folder", count: data.allPdfs.length },
                  { id: "CLASS_NOTES", label: "Class Notes", icon: "description", count: data.allPdfs.filter((p) => p.category === "CLASS_NOTES").length },
                  { id: "DPP", label: "DPP Sheets", icon: "assignment", count: data.allPdfs.filter((p) => p.category === "DPP").length },
                  { id: "TESTS", label: "Test Papers", icon: "quiz", count: data.allPdfs.filter((p) => p.category === "TESTS").length },
                  { id: "MODULES", label: "Module Notes", icon: "menu_book", count: data.allPdfs.filter((p) => p.category === "MODULES").length },
                  { id: "SYLLABUS", label: "Syllabus", icon: "list_alt", count: data.allPdfs.filter((p) => p.category === "SYLLABUS").length },
                  { id: "PLANNER", label: "Planner", icon: "calendar_today", count: data.allPdfs.filter((p) => p.category === "PLANNER").length },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedPdfCategory(cat.id as BatchPdfCategory);
                      pushNavState("materials", null, null, cat.id as BatchPdfCategory);
                    }}
                    className="p-3 rounded-xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 hover:border-sky-400 text-left transition flex flex-col justify-between gap-2 shadow-xs group"
                  >
                    <span className="material-symbols-outlined text-sky-600 text-xl group-hover:scale-105 transition">
                      {cat.icon}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600 transition">
                        {cat.label}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{cat.count} Files</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Category Breadcrumb */}
              <div className="flex items-center gap-2 mb-2.5 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPdfCategory(null);
                    pushNavState("materials", null, null, null);
                  }}
                  className="font-bold text-sky-600 hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Categories
                </button>
                <span className="text-slate-400">/</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                  {selectedPdfCategory.replace("_", " ")}
                </span>
              </div>

              {/* Filtered File Grid */}
              {filteredPdfs.length === 0 ? (
                <div className="p-10 text-center bg-[#f2f8fe] dark:bg-[#0f1722] rounded-2xl border border-sky-200/70 dark:border-sky-900/40">
                  <span className="material-symbols-outlined text-3xl text-sky-300 mb-1">description</span>
                  <p className="text-xs text-slate-500">No documents available in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredPdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="p-3 rounded-xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 flex items-center justify-between gap-2.5 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {pdf.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {pdf.subject} {pdf.chapter && `• ${pdf.chapter}`} • {sizeFmt(pdf.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActivePdf({
                              title: pdf.title,
                              pdfUrl: pdf.fileUrl,
                              fileName: pdf.fileName,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 text-sky-700 dark:text-sky-300 text-xs font-bold transition"
                        >
                          View
                        </button>

                        <a
                          href={pdf.fileUrl}
                          download={pdf.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-lg hover:bg-sky-100 text-slate-500 flex items-center justify-center transition"
                          title="Download"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MENTORSHIP TAB (Requirement 35)                                        */}
      {/* ========================================================================= */}
      {tab === "mentorship" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Active Bookings Banner if any */}
          {data.studentBookings.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Your Booked Mentorship Sessions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.studentBookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div>
                      <span className="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[9px] font-bold uppercase">
                        {bk.status}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1">
                        Mentor: {bk.teacherName}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {dateFmt(bk.startsAt)} at {timeFmt(bk.startsAt)}
                      </p>
                    </div>

                    {bk.meetingUrl && (
                      <Link
                        href={bk.meetingUrl}
                        className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition shrink-0"
                      >
                        Join
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
              <div className="p-3 rounded-2xl bg-[#f2f8fe] dark:bg-[#0f1722] border border-sky-200/70 dark:border-sky-900/40 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  No 1-on-1 slot is open right now. Your teachers' availability — a slot shows here as soon as a teacher opens one:
                </p>
                {data.batch.teacherCards.length === 0 ? (
                  <p className="text-xs text-slate-400">No teachers are listed for this batch yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {data.batch.teacherCards.map((tc) => (
                      <div key={tc.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111a26] border border-sky-100 dark:border-sky-900/40">
                        {tc.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tc.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs font-bold shrink-0">
                            {tc.name.charAt(0)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">{tc.name}</p>
                          <p className="text-[11px] text-slate-500 truncate leading-tight">{tc.subjects.join(", ") || "Faculty"}</p>
                        </div>
                        <span className="px-1.5 py-px rounded text-[9.5px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          No slot open
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {data.doubtSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3 rounded-xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {slot.teacherPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slot.teacherPhotoUrl}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                            {slot.teacherName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {slot.teacherName}
                          </h4>
                          <p className="text-[10px] text-sky-600">{slot.subject}</p>
                        </div>
                      </div>

                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {dateFmt(slot.startsAt)} • {timeFmt(slot.startsAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBookingSlot(slot)}
                      className="mt-2.5 w-full py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs"
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
      {/* 9. NOTICES TAB (Requirement 36)                                           */}
      {/* ========================================================================= */}
      {tab === "notices" && (
        <div className="space-y-1 animate-in fade-in duration-150">
          {data.notices.length === 0 ? (
            <div className="p-8 text-center bg-[#f2f8fe] dark:bg-[#0f1722] rounded-2xl border border-sky-200/70 dark:border-sky-900/40">
              <span className="material-symbols-outlined text-3xl text-sky-300 mb-1">campaign</span>
              <p className="text-xs text-slate-500">No notices posted yet</p>
            </div>
          ) : (
            // One line per notice; tap it to read the whole notice.
            data.notices.map((nt) => (
              <details
                key={nt.id}
                className="group rounded-lg bg-white dark:bg-[#111a26] border border-sky-100 dark:border-sky-900/40 px-2.5 py-1.5"
              >
                <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="material-symbols-outlined text-[16px] text-sky-600 shrink-0">campaign</span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{nt.title}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                    {new Date(nt.createdAt).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" })}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0 transition group-open:rotate-180">expand_more</span>
                </summary>
                <p className="mt-1.5 pl-6 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{nt.body}</p>
              </details>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. BATCH INFO TAB (Requirement 37)                                       */}
      {/* ========================================================================= */}
      {tab === "info" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Overview & Description */}
          <div className="p-4 rounded-2xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 shadow-xs space-y-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Batch Overview
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {data.batch.description ||
                `${data.batch.name} is a comprehensive preparatory program designed for ${
                  data.batch.exam || "competitive examinations"
                }. The program features structured live lectures, curated DPP practice sets, full syllabus mock tests, class notes, and one-to-one faculty mentorship.`}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-sky-100/80 dark:border-sky-950/60">
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Batch Code</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {data.batch.code}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Target Exam</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {data.batch.exam || "NEET / JEE"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Status</p>
                <p className="text-xs font-bold text-sky-600">Active & Enrolled</p>
              </div>
            </div>
          </div>

          {/* Assigned Educators & Faculty */}
          <div className="p-4 rounded-2xl bg-[#f5faff] dark:bg-[#111a26] border border-sky-200/70 dark:border-sky-900/40 shadow-xs space-y-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Assigned Faculty
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.batch.teacherCards.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-sky-100 dark:border-sky-950 flex items-center gap-2.5 bg-white/70 dark:bg-slate-900/40"
                >
                  {t.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.photoUrl}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-sky-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {t.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {t.name}
                    </h4>
                    <p className="text-[10.5px] text-sky-600 font-medium truncate">
                      {t.subjects.join(", ") || t.department || "Faculty"}
                    </p>
                    {t.experienceYears && (
                      <p className="text-[9.5px] text-slate-400">{t.experienceYears} Exp</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. MODALS (Mentorship Booking & Custom PDF Viewer)                       */}
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
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-600/50 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
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
