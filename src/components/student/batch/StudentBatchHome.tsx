"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { canStudentJoinClass, getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import type { StudentBatchHomeData, BatchClassItem, BatchTestItem, BatchDppItem } from "@/lib/batch/student-batch-home";

export type BatchTab = "classes" | "recorded" | "dpp" | "tests" | "material" | "notices";

const TABS: { id: BatchTab; label: string; icon: string }[] = [
  { id: "classes", label: "Live", icon: "sensors" },
  { id: "recorded", label: "Recorded", icon: "smart_display" },
  { id: "dpp", label: "DPP", icon: "assignment" },
  { id: "tests", label: "Tests", icon: "quiz" },
  { id: "material", label: "Material", icon: "folder_open" },
  { id: "notices", label: "Notices", icon: "campaign" },
];

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const time = (d: string) => new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Enrolled student's batch: everything on the page, no pop-ups. */
export function StudentBatchHome({ data, initialTab }: { data: StudentBatchHomeData; initialTab: BatchTab }) {
  const [tab, setTab] = useState<BatchTab>(initialTab);
  const [now, setNow] = useState(() => new Date());
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

  const live = useMemo(() => data.classes.filter((c) => getEffectiveScheduleStatus(c, now) === "LIVE"), [data.classes, now]);
  const counts = {
    classes: data.classes.filter((c) => dayKey(c.startsAt) === dayKey(now)).length,
    recorded: 0,
    dpp: data.dpps.filter((d) => d.status === "PENDING" || d.status === "IN_PROGRESS").length,
    tests: data.tests.filter((t) => t.attemptStatus !== "SUBMITTED" && (!t.closeTime || new Date(t.closeTime) > now)).length,
    material: data.folders.reduce((n, f) => n + f.files.length, 0),
    notices: data.notices.length,
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-4 sm:p-5 flex items-center gap-4">
          {data.batch.thumbnailUrl ? (
            <img src={data.batch.thumbnailUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shrink-0">
              {data.batch.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Link href="/courses" className="hover:text-blue-600">My Batches</Link>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="truncate">{data.batch.code}</span>
            </p>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{data.batch.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {[data.batch.exam, data.batch.teachers.join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {live.length > 0 && (
          <Link
            href={`/live-class/${live[0]!.id}`}
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-rose-600 text-white"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
              <span className="font-bold text-sm truncate">LIVE NOW · {live[0]!.title}</span>
            </span>
            <span className="text-xs font-black bg-white text-rose-600 px-3 py-1 rounded-full shrink-0">Join</span>
          </Link>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-6 border-t border-slate-200 dark:border-slate-800">
          {TABS.map((t) => {
            const active = tab === t.id;
            const n = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={`relative py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[10px] min-[400px]:text-[11px] sm:text-xs font-bold transition ${
                  active ? "text-blue-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                <span className="leading-tight text-center">{t.label}</span>
                {n > 0 && t.id !== "material" && t.id !== "recorded" && (
                  <span className="absolute top-1 right-0.5 sm:static min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">{n}</span>
                )}
                {active && <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "classes" && <ClassesTab data={data} now={now} />}
      {tab === "recorded" && <RecordedTab data={data} now={now} />}
      {tab === "dpp" && <DppTab dpps={data.dpps} />}
      {tab === "tests" && <TestsTab tests={data.tests} now={now} />}
      {tab === "material" && <MaterialTab folders={data.folders} teachers={data.batch.teacherCards} />}
      {tab === "notices" && <NoticesTab notices={data.notices} />}
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">{text}</p>;
}

function ClassRow({ c, now }: { c: BatchClassItem; now: Date }) {
  const status = getEffectiveScheduleStatus(c, now);
  const join = canStudentJoinClass(c, now);
  let action: React.ReactNode;
  if (status === "LIVE") action = <Link href={`/live-class/${c.id}`} className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold">Join live</Link>;
  else if (status === "COMPLETED") action = <Link href={`/watch/${c.id}`} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm">play_arrow</span>Play</Link>;
  else if (status === "CANCELLED") action = <span className="text-[11px] font-bold text-rose-500">Cancelled</span>;
  else if (join.allowed) action = <Link href={`/live-class/${c.id}`} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold">Enter</Link>;
  else action = <span className="text-[11px] font-semibold text-slate-500">{time(c.startsAt)}</span>;
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="w-12 text-center shrink-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(c.startsAt).toLocaleDateString("en-IN", { timeZone: IST, month: "short" })}</p>
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{new Date(c.startsAt).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit" })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.title}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {[c.subject, c.teacherName, `${time(c.startsAt)} – ${time(c.endsAt)}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function ClassesTab({ data, now }: { data: StudentBatchHomeData; now: Date }) {
  const today = dayKey(now);
  const weekAhead = now.getTime() + 7 * 86_400_000;
  const todays = data.classes.filter((c) => dayKey(c.startsAt) === today);
  const upcoming = data.classes.filter((c) => dayKey(c.startsAt) > today && new Date(c.startsAt).getTime() <= weekAhead);
  return (
    <div className="space-y-5">
      <Section title="Today">
        {todays.length ? <div className="space-y-2">{todays.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div> : <Empty text="No class today." />}
      </Section>
      <Section title="Next 7 days">
        {upcoming.length ? <div className="space-y-2">{upcoming.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div> : <Empty text="Nothing scheduled in the next 7 days." />}
      </Section>
    </div>
  );
}

/** Recorded classes as folders: Subject → Chapter → classes (and the chapter's notes/DPPs). */
function RecordedTab({ data, now }: { data: StudentBatchHomeData; now: Date }) {
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null); // chapterId, or "" for classes without a chapter
  const recorded = data.classes
    .filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED")
    .slice()
    .reverse();
  const subjects = Array.from(new Set([...recorded.map((c) => c.subjectName), ...data.chapters.map((c) => c.subject)])).sort();
  const crumb = (label: string, onClick: (() => void) | null) =>
    onClick ? (
      <button type="button" onClick={onClick} className="text-blue-600">{label}</button>
    ) : (
      <span className="text-slate-800 dark:text-slate-100">{label}</span>
    );

  if (recorded.length === 0 && data.chapters.length === 0) return <Empty text="Recorded classes appear here after each class." />;

  // Level 1: subjects
  if (subject === null) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-bold">{crumb("All subjects", null)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {subjects.map((s) => {
            const n = recorded.filter((c) => c.subjectName === s).length;
            return (
              <button key={s} type="button" onClick={() => setSubject(s)} className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left">
                <span className="material-symbols-outlined text-blue-600">folder</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s}</span>
                  <span className="block text-[11px] text-slate-500">{n} recorded class{n === 1 ? "" : "es"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const inSubject = recorded.filter((c) => c.subjectName === subject);
  const chapters = data.chapters.filter((c) => c.subject === subject);
  const chapterIds = new Set(chapters.map((c) => c.id));
  // Chapters that have recordings even if not in the chapter list.
  for (const c of inSubject) {
    if (c.chapterId && !chapterIds.has(c.chapterId)) {
      chapterIds.add(c.chapterId);
      chapters.push({ id: c.chapterId, title: c.chapterTitle ?? "Chapter", subjectId: "", subject, lectures: 0, dpps: 0 });
    }
  }
  const loose = inSubject.filter((c) => !c.chapterId);

  // Level 2: chapters of the subject
  if (chapter === null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1 text-xs font-bold">
          {crumb("All subjects", () => setSubject(null))}
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          {crumb(subject, null)}
        </div>
        <div className="space-y-2">
          {chapters.map((ch) => {
            const n = inSubject.filter((c) => c.chapterId === ch.id).length;
            return (
              <button key={ch.id} type="button" onClick={() => setChapter(ch.id)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left">
                <span className="material-symbols-outlined text-amber-500">folder</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{ch.title}</span>
                  <span className="block text-[11px] text-slate-500">{n} recorded class{n === 1 ? "" : "es"}</span>
                </span>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
            );
          })}
          {loose.length > 0 && (
            <button type="button" onClick={() => setChapter("")} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left">
              <span className="material-symbols-outlined text-slate-400">folder</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Other classes</span>
                <span className="block text-[11px] text-slate-500">{loose.length} recorded class{loose.length === 1 ? "" : "es"}</span>
              </span>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
          )}
          {chapters.length === 0 && loose.length === 0 && <Empty text="No recorded classes in this subject yet." />}
        </div>
      </div>
    );
  }

  // Level 3: the chapter's recorded classes
  const ch = chapters.find((c) => c.id === chapter);
  const list = chapter === "" ? loose : inSubject.filter((c) => c.chapterId === chapter);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap text-xs font-bold">
        {crumb("All subjects", () => { setSubject(null); setChapter(null); })}
        <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
        {crumb(subject, () => setChapter(null))}
        <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
        {crumb(ch?.title ?? "Other classes", null)}
      </div>
      {ch && ch.subjectId && (
        <Link href={`/courses/${data.batch.id}/subjects/${ch.subjectId}/chapters/${ch.id}`} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
          <span>Chapter notes, DPPs &amp; lectures ({ch.lectures} lectures · {ch.dpps} DPPs)</span>
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </Link>
      )}
      {list.length ? <div className="space-y-2">{list.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div> : <Empty text="No recorded class in this chapter yet." />}
    </div>
  );
}

function TestsTab({ tests, now }: { tests: BatchTestItem[]; now: Date }) {
  const state = (t: BatchTestItem) => {
    if (t.attemptStatus === "SUBMITTED") return "done";
    if (t.attemptStatus === "IN_PROGRESS") return "resume";
    if (t.openTime && new Date(t.openTime) > now) return "upcoming";
    if (t.closeTime && new Date(t.closeTime) < now) return "missed";
    return "open";
  };
  const groups: { title: string; keys: string[] }[] = [
    { title: "Available now", keys: ["open", "resume"] },
    { title: "Upcoming", keys: ["upcoming"] },
    { title: "Attempted", keys: ["done"] },
    { title: "Missed", keys: ["missed"] },
  ];
  if (tests.length === 0) return <Empty text="No tests in this batch yet." />;
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const list = tests.filter((t) => g.keys.includes(state(t)));
        if (!list.length) return null;
        return (
          <Section key={g.title} title={`${g.title} (${list.length})`}>
            <div className="space-y-2">
              {list.map((t) => {
                const s = state(t);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="material-symbols-outlined text-orange-500 shrink-0">quiz</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.durationMin} min{t.openTime ? ` · ${date(t.openTime)}, ${time(t.openTime)}` : ""}
                      </p>
                    </div>
                    {s === "open" && <Link href={`/tests/${t.id}/attempt`} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0">Start</Link>}
                    {s === "resume" && <Link href={`/tests/${t.id}/attempt`} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shrink-0">Resume</Link>}
                    {s === "done" && t.pdfHref && (
                      <a
                        href={t.pdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold shrink-0"
                        title="Download questions + solutions PDF"
                      >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        PDF
                      </a>
                    )}
                    {s === "done" && <Link href={`/tests/${t.id}/result`} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold shrink-0">Result</Link>}
                    {s === "upcoming" && <span className="text-[11px] font-semibold text-slate-500 shrink-0">Opens {t.openTime ? date(t.openTime) : ""}</span>}
                    {s === "missed" && <span className="text-[11px] font-semibold text-slate-400 shrink-0">Closed</span>}
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

const DPP_CHIP: Record<BatchDppItem["status"], { label: string; cls: string }> = {
  UPCOMING: { label: "Upcoming", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  LOCKED: { label: "Coming soon", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  PENDING: { label: "Not attempted", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  IN_PROGRESS: { label: "In progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  COMPLETED: { label: "Done", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

function DppTab({ dpps }: { dpps: BatchDppItem[] }) {
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);
  if (dpps.length === 0) return <Empty text="DPPs for this batch will appear here." />;

  const pending = (list: BatchDppItem[]) => list.filter((d) => d.status === "PENDING" || d.status === "IN_PROGRESS").length;
  const crumbs = (
    <div className="flex items-center gap-1 flex-wrap text-xs font-bold">
      <button type="button" onClick={() => { setSubject(null); setChapter(null); }} className={subject ? "text-blue-600" : "text-slate-800 dark:text-slate-100"}>
        All subjects
      </button>
      {subject && (
        <>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <button type="button" onClick={() => setChapter(null)} className={chapter ? "text-blue-600" : "text-slate-800 dark:text-slate-100"}>{subject}</button>
        </>
      )}
      {chapter && (
        <>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-slate-800 dark:text-slate-100">{chapter}</span>
        </>
      )}
    </div>
  );
  const folderBtn = (key: string, label: string, list: BatchDppItem[], onClick: () => void, color: string) => {
    const p = pending(list);
    return (
      <button key={key} type="button" onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left">
        <span className={`material-symbols-outlined ${color}`}>folder</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{label}</span>
          <span className="block text-[11px] text-slate-500">{list.length} DPP{list.length === 1 ? "" : "s"}{p ? ` · ${p} to do` : ""}</span>
        </span>
        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
      </button>
    );
  };

  if (!subject) {
    const subjects = Array.from(new Set(dpps.map((d) => d.subject))).sort();
    return (
      <div className="space-y-3">
        {crumbs}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {subjects.map((s) => folderBtn(s, s, dpps.filter((d) => d.subject === s), () => setSubject(s), "text-blue-600"))}
        </div>
      </div>
    );
  }
  const inSubject = dpps.filter((d) => d.subject === subject);
  if (!chapter) {
    const chapters = Array.from(new Set(inSubject.map((d) => d.chapter)));
    return (
      <div className="space-y-3">
        {crumbs}
        <div className="space-y-2">{chapters.map((c) => folderBtn(c, c, inSubject.filter((d) => d.chapter === c), () => setChapter(c), "text-amber-500"))}</div>
      </div>
    );
  }
  const list = inSubject.filter((d) => d.chapter === chapter);
  return (
    <div className="space-y-3">
      {crumbs}
      <div className="space-y-2">
        {list.map((d) => {
          const chip = DPP_CHIP[d.status];
          return (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">assignment</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{d.title}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  {d.questionCount > 0 && <span>{d.questionCount} Qs</span>}
                  {d.durationMin > 0 && <span>· {d.durationMin} min</span>}
                  {d.status === "UPCOMING" && d.opensAt && <span>· opens {date(d.opensAt)}, {time(d.opensAt)}</span>}
                  {d.status === "COMPLETED" && d.score != null && <span>· score {d.score}</span>}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>
              </div>
              {d.pdfHref && (
                      <a
                        href={d.pdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold shrink-0"
                        title="Download questions + solutions PDF"
                      >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        PDF
                      </a>
                    )}
              {d.href ? (
                <Link href={d.href} className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${d.status === "COMPLETED" ? "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" : "bg-blue-600 text-white"}`}>
                  {d.status === "COMPLETED" ? "Result" : d.status === "IN_PROGRESS" ? "Resume" : "Attempt"}
                </Link>
              ) : (
                <span className="material-symbols-outlined text-slate-400 shrink-0">lock</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INFO = "__batch_info__";
const isInfoFolder = (name: string) => /^(batch\s*info|brochure)$/i.test(name.trim());

function MaterialTab({ folders, teachers }: { folders: StudentBatchHomeData["folders"]; teachers: StudentBatchHomeData["batch"]["teacherCards"] }) {
  const [path, setPath] = useState<string[]>([]);
  const current = path[path.length - 1] ?? null;
  // The admin's own "Batch Info" / "Brochure" folder is shown inside the
  // pinned Batch Info folder, not twice.
  const infoFolders = folders.filter((f) => !f.parentId && isInfoFolder(f.name));
  const children = current === INFO ? [] : folders.filter((f) => f.parentId === current && !(current === null && isInfoFolder(f.name)));
  const files =
    current === INFO ? infoFolders.flatMap((f) => f.files) : current ? folders.find((f) => f.id === current)?.files ?? [] : [];
  const nameOf = (id: string) => (id === INFO ? "Batch Info" : folders.find((f) => f.id === id)?.name ?? "");
  const countIn = (id: string): number =>
    (folders.find((f) => f.id === id)?.files.length ?? 0) + folders.filter((f) => f.parentId === id).reduce((n, f) => n + countIn(f.id), 0);

  const infoFileCount = infoFolders.reduce((n, f) => n + f.files.length, 0);
  return (
    <div className="space-y-3">
      {/* Breadcrumb: folders open right here, never in a pop-up */}
      <div className="flex items-center gap-1 flex-wrap text-xs font-bold">
        <button type="button" onClick={() => setPath([])} className={current ? "text-blue-600" : "text-slate-800 dark:text-slate-100"}>
          Study Material
        </button>
        {path.map((id, i) => (
          <React.Fragment key={id}>
            <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
            <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className={i === path.length - 1 ? "text-slate-800 dark:text-slate-100" : "text-blue-600"}>
              {nameOf(id)}
            </button>
          </React.Fragment>
        ))}
      </div>

      {current === null && (
        <button
          type="button"
          onClick={() => setPath([INFO])}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-left"
        >
          <span className="material-symbols-outlined">info</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">Batch Info</span>
            <span className="block text-[11px] text-white/80">
              {teachers.length} teacher{teachers.length === 1 ? "" : "s"}{infoFileCount ? ` · brochure & ${infoFileCount} file${infoFileCount === 1 ? "" : "s"}` : ""}
            </span>
          </span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}

      {current === INFO && (
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">Your teachers</h3>
          {teachers.length === 0 ? (
            <Empty text="Teachers will be listed here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teachers.map((t) => (
                <div key={t.id} className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xl font-black shrink-0">{t.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-[11px] font-bold text-blue-600">
                      {[t.subjects.join(", "), t.experienceYears ? `${t.experienceYears} yrs experience` : null].filter(Boolean).join(" · ")}
                    </p>
                    {t.bio && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-3">{t.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1 pt-2">Brochure</h3>
          {files.length === 0 && <Empty text="The batch brochure will be added here soon." />}
        </section>
      )}

      {children.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {children.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPath([...path, f.id])}
              className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left"
            >
              <span className="material-symbols-outlined text-amber-500">folder</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{f.name}</span>
                <span className="block text-[11px] text-slate-500">{countIn(f.id)} file{countIn(f.id) === 1 ? "" : "s"}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-rose-500 shrink-0">picture_as_pdf</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.title}</p>
                <p className="text-[11px] text-slate-500">{size(file.sizeBytes)}</p>
              </div>
              <a href={`/api/batch-materials/${file.id}?inline=1`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0">
                Open
              </a>
              <a href={`/api/batch-materials/${file.id}`} className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0" title="Download">
                <span className="material-symbols-outlined text-base">download</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {current && current !== INFO && children.length === 0 && files.length === 0 && <Empty text="This folder is empty." />}
      {current === null && children.length === 0 && <Empty text="Study material for this batch will appear here." />}
    </div>
  );
}

function NoticesTab({ notices }: { notices: StudentBatchHomeData["notices"] }) {
  if (notices.length === 0) return <Empty text="No announcements for this batch yet." />;
  return (
    <div className="space-y-2">
      {notices.map((n) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
              <span className="text-[10px] text-slate-500 shrink-0">{date(n.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{n.body}</p>
          </>
        );
        return n.deepLink ? (
          <Link key={n.id} href={n.deepLink} className="block p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400">
            {body}
          </Link>
        ) : (
          <div key={n.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {body}
          </div>
        );
      })}
    </div>
  );
}
