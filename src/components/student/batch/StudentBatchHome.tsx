"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  | "timeline"
  | "classes"
  | "recorded"
  | "dpp"
  | "tests"
  | "pdfs"
  | "modules"
  | "faculty"
  | "notices";

const TABS: { id: BatchTab; label: string; icon: string }[] = [
  { id: "timeline", label: "Schedule", icon: "calendar_month" },
  { id: "classes", label: "Live", icon: "sensors" },
  { id: "recorded", label: "Recorded", icon: "smart_display" },
  { id: "dpp", label: "DPP", icon: "assignment" },
  { id: "tests", label: "Tests", icon: "quiz" },
  { id: "pdfs", label: "All PDFs", icon: "picture_as_pdf" },
  { id: "modules", label: "Modules", icon: "menu_book" },
  { id: "faculty", label: "Faculty & Doubt", icon: "support_agent" },
  { id: "notices", label: "Notices", icon: "campaign" },
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
  initialTab = "timeline",
}: {
  data: StudentBatchHomeData;
  initialTab?: BatchTab;
}) {
  const [tab, setTab] = useState<BatchTab>(initialTab);
  const [now, setNow] = useState(() => new Date());
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

  const switchTab = (t: BatchTab) => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", t);
      window.history.replaceState(null, "", u.toString());
    } catch {}
  };

  const liveClasses = useMemo(
    () => data.classes.filter((c) => getEffectiveScheduleStatus(c, now) === "LIVE"),
    [data.classes, now]
  );

  const todayDateKey = dayKey(now);
  const counts = {
    timeline: data.timelineEvents.filter((e) => e.dateKey === todayDateKey).length,
    classes: data.classes.filter((c) => dayKey(c.startsAt) === todayDateKey).length,
    recorded: data.classes.filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED").length,
    dpp: data.dpps.filter((d) => d.status === "AVAILABLE" || d.status === "IN_PROGRESS").length,
    tests: data.tests.filter((t) => t.attemptStatus !== "SUBMITTED").length,
    pdfs: data.allPdfs.length,
    modules: data.modules.length,
    faculty: data.doubtSlots.length,
    notices: data.notices.length,
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* 1. BATCH HEADER & QUICK BANNER */}
      <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {data.batch.thumbnailUrl ? (
              <img
                src={data.batch.thumbnailUrl}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-slate-800"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xl font-black shrink-0 shadow-md">
                {data.batch.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Link href="/courses" className="hover:text-blue-600 transition">
                  My Batches
                </Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="truncate">{data.batch.code}</span>
              </p>
              <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                {data.batch.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
                {data.batch.exam && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                    {data.batch.exam}
                  </span>
                )}
                {data.batch.teachers.length > 0 && (
                  <span className="truncate">Faculty: {data.batch.teachers.join(", ")}</span>
                )}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Batch
            </span>
          </div>
        </div>

        {/* Live Class Alert Bar */}
        {liveClasses.length > 0 && (
          <Link
            href={`/live-class/${liveClasses[0]!.id}`}
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-gradient-to-r from-rose-600 to-red-600 text-white transition hover:opacity-95 shadow-inner"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
              <span className="font-black text-sm truncate">
                🔴 LIVE NOW · {liveClasses[0]!.title}
              </span>
            </span>
            <span className="text-xs font-black bg-white text-rose-600 px-3.5 py-1.5 rounded-full shrink-0 shadow">
              Join Classroom
            </span>
          </Link>
        )}

        {/* Unified Responsive Navigation Tabs */}
        <div className="flex overflow-x-auto border-t border-slate-200 dark:border-slate-800 no-scrollbar">
          {TABS.map((t) => {
            const active = tab === t.id;
            const n = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={`relative px-3.5 sm:px-4 py-3 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap transition shrink-0 ${
                  active
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 font-extrabold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                <span>{t.label}</span>
                {n > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {n}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TAB VIEWS */}
      {tab === "timeline" && (
        <TimelineTab events={data.timelineEvents} now={now} onOpenPdf={(p) => setActivePdf(p)} />
      )}
      {tab === "classes" && <ClassesTab data={data} now={now} onOpenPdf={(p) => setActivePdf(p)} />}
      {tab === "recorded" && <RecordedTab data={data} now={now} onOpenPdf={(p) => setActivePdf(p)} />}
      {tab === "dpp" && (
        <DppTab dpps={data.dpps} chapters={data.chapters} onOpenPdf={(p) => setActivePdf(p)} />
      )}
      {tab === "tests" && (
        <TestsTab tests={data.tests} now={now} onOpenPdf={(p) => setActivePdf(p)} />
      )}
      {tab === "pdfs" && (
        <AllPdfsTab allPdfs={data.allPdfs} onOpenPdf={(p) => setActivePdf(p)} />
      )}
      {tab === "modules" && (
        <ModulesTab modules={data.modules} onOpenPdf={(p) => setActivePdf(p)} />
      )}
      {tab === "faculty" && (
        <FacultyTab
          teachers={data.batch.teacherCards}
          doubtSlots={data.doubtSlots}
          bookings={data.studentBookings}
        />
      )}
      {tab === "notices" && <NoticesTab notices={data.notices} />}

      {/* 3. ATOMIC PATHSHALA CUSTOM PDF READER MODAL */}
      {activePdf && (
        <CustomPdfReader
          isOpen={Boolean(activePdf)}
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

// ----------------------------------------------------------------------------
// SECTION / EMPTY REUSABLE COMPONENTS
// ----------------------------------------------------------------------------

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ text, icon = "inbox" }: { text: string; icon?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-2 bg-white/50 dark:bg-slate-900/50">
      <span className="material-symbols-outlined text-3xl text-slate-400">{icon}</span>
      <p className="text-xs font-semibold text-slate-500">{text}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 1. VERTICAL TIMELINE TAB (TODAY & UPCOMING SCHEDULE)
// ----------------------------------------------------------------------------

function TimelineTab({
  events,
  now,
  onOpenPdf,
}: {
  events: AcademicEvent[];
  now: Date;
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const todayDateKey = dayKey(now);
  const tomorrowDateKey = dayKey(new Date(now.getTime() + 86400000));

  // Group events by dateKey
  const groupedEvents = useMemo(() => {
    const groups: { dateKey: string; heading: string; items: AcademicEvent[] }[] = [];
    const map = new Map<string, AcademicEvent[]>();

    for (const ev of events) {
      if (!map.has(ev.dateKey)) map.set(ev.dateKey, []);
      map.get(ev.dateKey)!.push(ev);
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    for (const d of sortedDates) {
      groups.push({
        dateKey: d,
        heading: getDateHeading(d, todayDateKey, tomorrowDateKey),
        items: map.get(d)!,
      });
    }
    return groups;
  }, [events, todayDateKey, tomorrowDateKey]);

  if (groupedEvents.length === 0) {
    return <Empty text="No classes, tests or DPPs scheduled for this batch yet." icon="event_busy" />;
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => {
        const isToday = group.dateKey === todayDateKey;
        return (
          <div key={group.dateKey} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span
                className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                  isToday
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {group.heading}
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-2">
              {group.items.map((ev) => (
                <TimelineEventCard key={ev.id} ev={ev} onOpenPdf={onOpenPdf} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineEventCard({
  ev,
  onOpenPdf,
}: {
  ev: AcademicEvent;
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const isLive = ev.status === "LIVE_NOW";
  const isClass = ev.type === "LIVE_CLASS";
  const isTest = ev.type === "TEST";
  const isDpp = ev.type === "DPP";

  const isCompletedClass = isClass && ev.status === "COMPLETED";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
        isLive
          ? "border-rose-500 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/30"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {/* Left: Time & Educator Photo / Type Icon */}
        <div className="text-center shrink-0 pt-0.5 flex flex-col items-center">
          <span className="text-[10px] font-bold text-slate-500 block uppercase mb-1">
            {timeFmt(ev.startsAt)}
          </span>

          {isClass ? (
            ev.teacherPhotoUrl ? (
              <img
                src={ev.teacherPhotoUrl}
                alt={ev.teacherName || "Educator"}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-xs">
                {(ev.teacherName || "E").charAt(0)}
              </div>
            )
          ) : (
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                isTest
                  ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                  : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{isTest ? "quiz" : "assignment"}</span>
            </span>
          )}
        </div>

        {/* Center: Metadata, Title, Educator info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {ev.subject}
            </span>
            {isLive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Live Now
              </span>
            )}
            {isCompletedClass && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                Completed
              </span>
            )}
            {ev.score != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                Score: {ev.score}
              </span>
            )}
          </div>

          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate">
            {ev.title}
          </h3>

          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {[
              ev.teacherName ? `${ev.teacherName}` : null,
              ev.chapter,
              ev.durationMin ? `${ev.durationMin} mins` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* Right: Class Notes & Action Buttons */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {/* Class Notes PDF button */}
        {(ev.notesPdfUrl || (isClass && ev.pdfUrl)) && (
          <button
            type="button"
            onClick={() =>
              onOpenPdf({
                title: `${ev.title} (Class Notes)`,
                pdfUrl: (ev.notesPdfUrl || ev.pdfUrl)!,
                fileName: `${ev.title}-Notes.pdf`,
              })
            }
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Open Class Notes PDF"
          >
            <span className="material-symbols-outlined text-base text-rose-500">description</span>
            <span>Class Notes</span>
          </button>
        )}

        {/* Non-class PDFs (DPP/Test) */}
        {!isClass && ev.pdfUrl && (
          <button
            type="button"
            onClick={() => onOpenPdf({ title: ev.title, pdfUrl: ev.pdfUrl! })}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
            title="Open Attached PDF"
          >
            <span className="material-symbols-outlined text-base text-rose-500">picture_as_pdf</span>
            <span className="hidden sm:inline">PDF</span>
          </button>
        )}

        {ev.actionHref ? (
          <Link
            href={ev.actionHref}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
              isLive
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : isCompletedClass
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : ev.status === "SUBMITTED" || ev.status === "COMPLETED"
                ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>Join Live Class</span>
              </>
            ) : isCompletedClass ? (
              <>
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                <span>Play Class</span>
              </>
            ) : (
              ev.actionLabel
            )}
          </Link>
        ) : (
          <span className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            {ev.actionLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 2. LIVE & UPCOMING CLASSES TAB
// ----------------------------------------------------------------------------

function ClassesTab({
  data,
  now,
  onOpenPdf,
}: {
  data: StudentBatchHomeData;
  now: Date;
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const today = dayKey(now);
  const weekAhead = now.getTime() + 7 * 86_400_000;
  const todays = data.classes.filter((c) => dayKey(c.startsAt) === today);
  const upcoming = data.classes.filter(
    (c) => dayKey(c.startsAt) > today && new Date(c.startsAt).getTime() <= weekAhead
  );

  return (
    <div className="space-y-5">
      <Section title="Today's Classes">
        {todays.length ? (
          <div className="space-y-2">
            {todays.map((c) => (
              <ClassRow key={c.id} c={c} now={now} onOpenPdf={onOpenPdf} />
            ))}
          </div>
        ) : (
          <Empty text="No live classes scheduled for today." icon="event_available" />
        )}
      </Section>

      <Section title="Upcoming Classes (Next 7 Days)">
        {upcoming.length ? (
          <div className="space-y-2">
            {upcoming.map((c) => (
              <ClassRow key={c.id} c={c} now={now} onOpenPdf={onOpenPdf} />
            ))}
          </div>
        ) : (
          <Empty text="No upcoming classes in the next 7 days." icon="calendar_today" />
        )}
      </Section>
    </div>
  );
}

function ClassRow({
  c,
  now,
  onOpenPdf,
}: {
  c: BatchClassItem;
  now: Date;
  onOpenPdf?: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const status = getEffectiveScheduleStatus(c, now);
  const join = canStudentJoinClass(c, now);

  let action: React.ReactNode;
  if (status === "LIVE") {
    action = (
      <Link
        href={`/live-class/${c.id}`}
        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>Join Live Class</span>
      </Link>
    );
  } else if (status === "COMPLETED") {
    action = (
      <Link
        href={`/watch/${c.id}`}
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
      >
        <span className="material-symbols-outlined text-sm">play_arrow</span>
        <span>Play Class</span>
      </Link>
    );
  } else if (status === "CANCELLED") {
    action = <span className="text-[11px] font-bold text-rose-500">Cancelled</span>;
  } else if (join.allowed) {
    action = (
      <Link
        href={`/live-class/${c.id}`}
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
      >
        Enter Class
      </Link>
    );
  } else {
    action = <span className="text-[11px] font-semibold text-slate-500">{timeFmt(c.startsAt)}</span>;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition">
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Left: Educator Photo / Avatar */}
        {c.teacherPhotoUrl ? (
          <img
            src={c.teacherPhotoUrl}
            alt={c.teacherName || "Educator"}
            className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
            {(c.teacherName || "E").charAt(0)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {c.subjectName}
            </span>
            {status === "LIVE" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Live Now
              </span>
            )}
            {status === "COMPLETED" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                Completed
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">{c.title}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {[c.teacherName, `${timeFmt(c.startsAt)} – ${timeFmt(c.endsAt)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {c.notesPdfUrl && onOpenPdf && (
          <button
            type="button"
            onClick={() =>
              onOpenPdf({
                title: `${c.title} (Class Notes)`,
                pdfUrl: c.notesPdfUrl!,
                fileName: `${c.title}-Notes.pdf`,
              })
            }
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Open Class Notes PDF"
          >
            <span className="material-symbols-outlined text-base text-rose-500">description</span>
            <span>Class Notes</span>
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. RECORDED LECTURES (SUBJECT -> CHAPTER HIERARCHY)
// ----------------------------------------------------------------------------

function RecordedTab({
  data,
  now,
  onOpenPdf,
}: {
  data: StudentBatchHomeData;
  now: Date;
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);

  const recorded = data.classes
    .filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED")
    .slice()
    .reverse();

  const subjects = Array.from(
    new Set([...recorded.map((c) => c.subjectName), ...data.chapters.map((c) => c.subject)])
  ).sort();

  if (recorded.length === 0 && data.chapters.length === 0) {
    return <Empty text="Recorded classes will appear here once live sessions complete." icon="smart_display" />;
  }

  // Level 1: Subject Cards
  if (subject === null) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-500">Select a Subject</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {subjects.map((s) => {
            const count = recorded.filter((c) => c.subjectName === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-sm shrink-0">
                  {s.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                    {s}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {count} recorded class{count === 1 ? "" : "es"}
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const inSubject = recorded.filter((c) => c.subjectName === subject);
  const chapters = data.chapters.filter((c) => c.subject === subject);

  // Level 2: Chapters
  if (chapter === null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button type="button" onClick={() => setSubject(null)} className="text-blue-600 hover:underline">
            All Subjects
          </button>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-slate-900 dark:text-white">{subject}</span>
        </div>

        <div className="space-y-2">
          {chapters.map((ch) => {
            const count = inSubject.filter((c) => c.chapterId === ch.id).length;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChapter(ch.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition text-left"
              >
                <span className="material-symbols-outlined text-amber-500">folder</span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                    {ch.title}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {count} recorded lecture{count === 1 ? "" : "s"} · {ch.dpps} DPPs
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
              </button>
            );
          })}
          {chapters.length === 0 && <Empty text="No chapters found in this subject." />}
        </div>
      </div>
    );
  }

  // Level 3: Lectures in chapter
  const ch = chapters.find((c) => c.id === chapter);
  const list = inSubject.filter((c) => c.chapterId === chapter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setSubject(null);
            setChapter(null);
          }}
          className="text-blue-600 hover:underline"
        >
          All Subjects
        </button>
        <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
        <button type="button" onClick={() => setChapter(null)} className="text-blue-600 hover:underline">
          {subject}
        </button>
        <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
        <span className="text-slate-900 dark:text-white">{ch?.title ?? "Lectures"}</span>
      </div>

      {list.length ? (
        <div className="space-y-2">
          {list.map((c) => (
            <ClassRow key={c.id} c={c} now={now} onOpenPdf={onOpenPdf} />
          ))}
        </div>
      ) : (
        <Empty text="No recorded classes in this chapter yet." />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 4. DPP TAB (DIRECT ATTEMPT & RESULT WORKSPACE)
// ----------------------------------------------------------------------------

function DppTab({
  dpps,
  chapters,
  onOpenPdf,
}: {
  dpps: BatchDppItem[];
  chapters: BatchChapterItem[];
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  const subjects = useMemo(() => {
    return Array.from(new Set(dpps.map((d) => d.subject).filter(Boolean))).sort();
  }, [dpps]);

  const filteredDpps = useMemo(() => {
    if (selectedSubject === "ALL") return dpps;
    return dpps.filter((d) => d.subject === selectedSubject);
  }, [dpps, selectedSubject]);

  if (dpps.length === 0) {
    return <Empty text="DPPs for this batch and its assigned chapters will appear here." icon="assignment" />;
  }

  return (
    <div className="space-y-4">
      {/* Subject Filter Pills */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedSubject("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
              selectedSubject === "ALL"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            All Subjects ({dpps.length})
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSubject(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedSubject === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {s} ({dpps.filter((d) => d.subject === s).length})
            </button>
          ))}
        </div>
      )}

      {/* DPP Cards Grid */}
      <div className="space-y-2.5">
        {filteredDpps.map((d) => (
          <div
            key={d.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 transition"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                <span className="material-symbols-outlined text-xl">assignment</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {d.subject}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 truncate">
                    {d.chapter}
                  </span>
                  {d.status === "COMPLETED" && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      ✓ Done {d.score != null ? `· Score: ${d.score}` : ""}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate">
                  {d.title}
                </h3>

                <p className="text-[11px] text-slate-500 mt-0.5">
                  {d.questionCount} Questions · {d.durationMin} mins duration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {d.pdfUrl && (
                <button
                  type="button"
                  onClick={() => onOpenPdf({ title: d.title, pdfUrl: d.pdfUrl!, fileName: `${d.code}.pdf` })}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
                  title="Open DPP PDF"
                >
                  <span className="material-symbols-outlined text-base text-rose-500">picture_as_pdf</span>
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}

              {d.href ? (
                <Link
                  href={d.href}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    d.status === "COMPLETED"
                      ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100"
                      : d.status === "IN_PROGRESS"
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {d.status === "COMPLETED" ? "DPP Analysis" : d.status === "IN_PROGRESS" ? "Resume DPP" : "Attempt DPP"}
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold">
                  Locked
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 5. TESTS TAB (AVAILABLE, UPCOMING, RESULTS & PDFs)
// ----------------------------------------------------------------------------

function TestsTab({
  tests,
  now,
  onOpenPdf,
}: {
  tests: BatchTestItem[];
  now: Date;
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const state = (t: BatchTestItem) => {
    if (t.attemptStatus === "SUBMITTED") return "done";
    if (t.attemptStatus === "IN_PROGRESS") return "resume";
    if (t.openTime && new Date(t.openTime) > now) return "upcoming";
    if (t.closeTime && new Date(t.closeTime) < now) return "missed";
    return "open";
  };

  const groups = [
    { title: "Available Tests", keys: ["open", "resume"] },
    { title: "Upcoming Tests", keys: ["upcoming"] },
    { title: "Attempted & Results", keys: ["done"] },
  ];

  if (tests.length === 0) {
    return <Empty text="No tests scheduled for this batch yet." icon="quiz" />;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const list = tests.filter((t) => g.keys.includes(state(t)));
        if (!list.length) return null;

        return (
          <Section key={g.title} title={`${g.title} (${list.length})`}>
            <div className="space-y-2.5">
              {list.map((t) => {
                const s = state(t);
                const isDone = s === "done";
                return (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">quiz</span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.subject}
                          </span>
                          {t.score != null && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Score: {t.score} / {t.totalMarks}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate">
                          {t.name}
                        </h3>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {t.durationMin} mins · Max Marks: {t.totalMarks}
                          {t.openTime ? ` · Opens ${dateFmt(t.openTime)}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {t.questionPdfUrl && (
                        <button
                          type="button"
                          onClick={() => onOpenPdf({ title: `${t.name} (Question Paper)`, pdfUrl: t.questionPdfUrl! })}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
                          title="Question Paper PDF"
                        >
                          <span className="material-symbols-outlined text-base text-rose-500">picture_as_pdf</span>
                          <span className="hidden sm:inline">Paper</span>
                        </button>
                      )}

                      {isDone && t.solutionPdfUrl && (
                        <button
                          type="button"
                          onClick={() => onOpenPdf({ title: `${t.name} (Solutions)`, pdfUrl: t.solutionPdfUrl! })}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
                          title="Solution PDF"
                        >
                          <span className="material-symbols-outlined text-base text-emerald-500">description</span>
                          <span className="hidden sm:inline">Solutions</span>
                        </button>
                      )}

                      {s === "open" && (
                        <Link
                          href={`/tests/${t.id}/attempt`}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
                        >
                          Start Test
                        </Link>
                      )}
                      {s === "resume" && (
                        <Link
                          href={`/tests/${t.id}/attempt`}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm"
                        >
                          Resume
                        </Link>
                      )}
                      {s === "done" && (
                        <Link
                          href={`/tests/${t.id}/result`}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 text-xs font-bold"
                        >
                          Test Analysis
                        </Link>
                      )}
                      {s === "upcoming" && (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold">
                          Opens {t.openTime ? dateFmt(t.openTime) : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 6. ALL PDFs & CENTRALIZED BATCH LIBRARY
// ----------------------------------------------------------------------------

const PDF_CATEGORIES: { id: BatchPdfCategory | "ALL"; label: string; icon: string; color: string }[] = [
  { id: "ALL", label: "All PDFs", icon: "folder_open", color: "text-blue-600" },
  { id: "CLASS_NOTES", label: "Class Notes", icon: "menu_book", color: "text-blue-600" },
  { id: "DPP", label: "DPP Sheets", icon: "assignment", color: "text-emerald-600" },
  { id: "TESTS", label: "Test Papers", icon: "quiz", color: "text-purple-600" },
  { id: "MODULES", label: "Modules & Notes", icon: "auto_stories", color: "text-amber-600" },
  { id: "SYLLABUS", label: "Syllabus & Planner", icon: "calendar_month", color: "text-rose-600" },
];

function AllPdfsTab({
  allPdfs,
  onOpenPdf,
}: {
  allPdfs: BatchPdfItem[];
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean }) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<BatchPdfCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPdfs = useMemo(() => {
    return allPdfs.filter((p) => {
      const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.chapter && p.chapter.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [allPdfs, selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 5 Compact Horizontal Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {PDF_CATEGORIES.map((cat) => {
          const count =
            cat.id === "ALL" ? allPdfs.length : allPdfs.filter((p) => p.category === cat.id).length;
          const active = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                active
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500/40 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`material-symbols-outlined text-xl ${cat.color}`}>{cat.icon}</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{count}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                  {cat.label}
                </span>
                <span className="text-[10px] text-slate-500">Files Library</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search PDFs by file name, subject, or chapter..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Files List */}
      {filteredPdfs.length > 0 ? (
        <div className="space-y-2">
          {filteredPdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {pdf.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[pdf.subject, pdf.chapter, sizeFmt(pdf.sizeBytes)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onOpenPdf({
                      title: pdf.title,
                      pdfUrl: pdf.fileUrl,
                      fileName: pdf.fileName,
                      allowDownload: pdf.allowDownload,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Open</span>
                </button>

                {pdf.allowDownload ? (
                  <a
                    href={pdf.fileUrl}
                    download={pdf.fileName}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                    title="Download PDF"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                  </a>
                ) : (
                  <span
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400"
                    title="Download restricted"
                  >
                    <span className="material-symbols-outlined text-base">lock</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No PDF documents match your search filter." icon="description" />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 7. MODULES & EDUCATIONAL NOTES TAB
// ----------------------------------------------------------------------------

function ModulesTab({
  modules,
  onOpenPdf,
}: {
  modules: BatchModuleItem[];
  onOpenPdf: (pdf: { title: string; pdfUrl: string; fileName?: string; allowDownload?: boolean; totalPages?: number }) => void;
}) {
  if (modules.length === 0) {
    return <Empty text="Educational modules uploaded for this batch will appear here." icon="menu_book" />;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-slate-500">Atomic Comprehensive Modules</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modules.map((m) => (
          <div
            key={m.id}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-blue-500 transition shadow-xs"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {m.subject}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-400">{m.code}</span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                {m.title}
              </h3>

              <p className="text-xs text-slate-500">
                {[m.chapter, m.facultyName ? `By ${m.facultyName}` : null, `${m.pageCount} pages`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  onOpenPdf({
                    title: m.title,
                    pdfUrl: m.fileUrl,
                    fileName: m.fileName,
                    allowDownload: m.allowDownload,
                    totalPages: m.pageCount,
                  })
                }
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">auto_stories</span>
                <span>Read Module</span>
              </button>

              {m.allowDownload && (
                <a
                  href={m.fileUrl}
                  download={m.fileName}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition"
                  title="Download Module PDF"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 8. FACULTY & 1-TO-1 DOUBT SESSION BOOKING
// ----------------------------------------------------------------------------

function FacultyTab({
  teachers,
  doubtSlots,
  bookings,
}: {
  teachers: StudentBatchHomeData["batch"]["teacherCards"];
  doubtSlots: BatchDoubtSlotItem[];
  bookings: StudentDoubtBookingItem[];
}) {
  const [selectedSlot, setSelectedSlot] = useState<BatchDoubtSlotItem | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleBookSlot = async (slotId: string) => {
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/doubt-booking/slots/${slotId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicInput.trim() || "Academic Doubt Discussion" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to book doubt session");
      }
      setBookingSuccess("1-to-1 Doubt session booked successfully!");
      setSelectedSlot(null);
      setTopicInput("");
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Faculty Cards Grid */}
      <Section title="Assigned Faculty">
        {teachers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teachers.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                {t.photoUrl ? (
                  <img
                    src={t.photoUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-lg font-black shrink-0">
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{t.name}</h3>
                  <p className="text-[11px] font-semibold text-blue-600 truncate">
                    {t.subjects.join(", ")}
                    {t.experienceYears ? ` · ${t.experienceYears} yrs exp` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Faculty details will be updated soon." icon="school" />
        )}
      </Section>

      {/* Active Doubt Bookings */}
      {bookings.length > 0 && (
        <Section title="My Scheduled Doubt Sessions">
          <div className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                    Confirmed
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate">
                    {b.topic || "1-to-1 Doubt Session"} with {b.teacherName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {dateFmt(b.startsAt)} at {timeFmt(b.startsAt)}
                  </p>
                </div>
                {b.meetingUrl && (
                  <Link
                    href={b.meetingUrl}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    Join Call
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Book 1-to-1 Doubt Session Slots */}
      <Section title="Book 1-to-1 Doubt Session">
        {bookingSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            {bookingSuccess}
          </div>
        )}
        {bookingError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
            {bookingError}
          </div>
        )}

        {doubtSlots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {doubtSlots.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {s.subject} · {s.teacherName}
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {dateFmt(s.startsAt)} · {timeFmt(s.startsAt)}
                  </h4>
                  <span className="text-[10px] text-slate-500">{s.durationMinutes} minutes slot</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSlot(s)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shrink-0 shadow-sm"
                >
                  Book Slot
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No open doubt slots available right now. Please check back soon." icon="event_available" />
        )}

        {/* Slot Booking Confirmation Dialog */}
        {selectedSlot && (
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Confirm 1-to-1 Doubt Session with {selectedSlot.teacherName}
            </h4>
            <p className="text-xs text-slate-500">
              {dateFmt(selectedSlot.startsAt)} at {timeFmt(selectedSlot.startsAt)} ({selectedSlot.durationMinutes} mins)
            </p>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="What topic or question do you want to discuss?"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={bookingLoading}
                onClick={() => handleBookSlot(selectedSlot.id)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                {bookingLoading ? "Booking…" : "Confirm Booking"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 9. ANNOUNCEMENTS & NOTICES TAB
// ----------------------------------------------------------------------------

function NoticesTab({ notices }: { notices: StudentBatchHomeData["notices"] }) {
  if (notices.length === 0) {
    return <Empty text="No announcements posted for this batch yet." icon="campaign" />;
  }

  return (
    <div className="space-y-2.5">
      {notices.map((n) => {
        const content = (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{n.title}</h3>
              <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                {dateFmt(n.createdAt)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {n.body}
            </p>
          </div>
        );

        return n.deepLink ? (
          <Link
            key={n.id}
            href={n.deepLink}
            className="block p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition"
          >
            {content}
          </Link>
        ) : (
          <div
            key={n.id}
            className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
