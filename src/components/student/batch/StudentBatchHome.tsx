"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { registerBackGuard } from "@/lib/navigation/back-guards";
import { canStudentJoinClass, getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";
import type { StudentBatchHomeData, BatchClassItem, BatchTestItem, BatchDppItem } from "@/lib/batch/student-batch-home";

export type BatchTab = "home" | "content" | "live" | "recorded" | "dpp" | "tests" | "notes" | "pdf" | "notices" | "announcements";

const TAB_IDS: BatchTab[] = ["home", "content", "live", "recorded", "dpp", "tests", "notes", "pdf", "notices", "announcements"];
/** Older links (?tab=classes, ?tab=material) still land on the right box. */
export function parseBatchTab(t: string | null | undefined): BatchTab {
  if (t === "classes") return "live";
  if (t === "material") return "notes";
  return TAB_IDS.includes(t as BatchTab) ? (t as BatchTab) : "home";
}

const LABEL: Record<BatchTab, string> = {
  home: "Batch",
  content: "All Content",
  live: "Live Class",
  recorded: "Recorded Classes",
  dpp: "DPP",
  tests: "Test",
  notes: "Notes and Module",
  pdf: "All PDF",
  notices: "Notice",
  announcements: "Announcements",
};

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const time = (d: string) => new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : w.endsWith("s") ? "es" : "s"}`;

/** Where the student is inside the batch page — kept in the URL, so Back and Refresh never throw them out. */
type Nav = { tab: BatchTab; s: string | null; c: string | null; k: string | null };

function readNav(fallback: BatchTab): Nav {
  if (typeof window === "undefined") return { tab: fallback, s: null, c: null, k: null };
  const q = new URLSearchParams(window.location.search);
  return { tab: q.has("tab") ? parseBatchTab(q.get("tab")) : fallback, s: q.get("s"), c: q.get("c"), k: q.get("k") };
}

/** One level up from where the student is (null at the batch's front page). */
function parentOf(n: Nav): Nav | null {
  if (n.tab === "home") return null;
  if (n.c) return { tab: n.tab, s: n.s, c: null, k: null };
  if (n.k) {
    const parts = n.k.split("/").filter(Boolean);
    return { tab: n.tab, s: null, c: null, k: n.tab === "notes" && parts.length > 1 ? parts.slice(0, -1).join("/") : null };
  }
  if (n.s) return { tab: n.tab, s: null, c: null, k: null };
  return { tab: "home", s: null, c: null, k: null };
}

function writeUrl(n: Nav, mode: "push" | "replace") {
  try {
    const u = new URL(window.location.href);
    for (const key of ["tab", "s", "c", "k"] as const) {
      const v = key === "tab" ? (n.tab === "home" ? null : n.tab) : n[key];
      if (v) u.searchParams.set(key, v);
      else u.searchParams.delete(key);
    }
    if (mode === "push") window.history.pushState(window.history.state, "", u.toString());
    else window.history.replaceState(window.history.state, "", u.toString());
  } catch {}
}

function useBatchNav(initialTab: BatchTab) {
  const [nav, setNav] = useState<Nav>({ tab: initialTab, s: null, c: null, k: null });
  const navRef = useRef(nav);
  navRef.current = nav;
  // Steps pushed inside this page that Back can pop.
  const depth = useRef(0);

  useEffect(() => {
    setNav(readNav(initialTab));
    const onPop = () => {
      depth.current = Math.max(0, depth.current - 1);
      setNav(readNav("home"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialTab]);

  /** One step deeper = one history entry, so Back goes one step up. */
  const go = useCallback((next: Partial<Nav>) => {
    const n: Nav = { tab: next.tab ?? navRef.current.tab, s: null, c: null, k: null, ...next };
    writeUrl(n, "push");
    depth.current += 1;
    setNav(n);
    window.scrollTo({ top: 0 });
  }, []);

  /** Back one level inside the page; false at the front page (leave the page as usual). */
  const up = useCallback((): boolean => {
    const parent = parentOf(navRef.current);
    if (!parent) return false;
    if (depth.current > 0) {
      window.history.back();
    } else {
      // Opened straight on an inner box (link or refresh): step up without leaving.
      writeUrl(parent, "replace");
      setNav(parent);
    }
    return true;
  }, []);

  // The phone's Back key and the app's Back button go one level up too.
  useEffect(() => registerBackGuard(() => up()), [up]);

  return { nav, go, up };
}

/** Enrolled student's batch: small boxes, each opening right here (no pop-ups). */
export function StudentBatchHome({ data, initialTab }: { data: StudentBatchHomeData; initialTab: BatchTab }) {
  const { nav, go, up } = useBatchNav(initialTab);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const live = useMemo(() => data.classes.filter((c) => getEffectiveScheduleStatus(c, now) === "LIVE"), [data.classes, now]);
  const upcoming = useMemo(
    () => data.classes.filter((c) => { const s = getEffectiveScheduleStatus(c, now); return s === "LIVE" || (s !== "COMPLETED" && s !== "CANCELLED" && new Date(c.endsAt) > now); }),
    [data.classes, now]
  );
  const recorded = data.classes.filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED");
  const pdfCount = pdfCategories(data).reduce((n, c) => n + c.count, 0);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {nav.tab !== "home" ? (
          <button type="button" onClick={up} aria-label="Back" className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-slate-700 dark:text-slate-200">arrow_back</span>
          </button>
        ) : data.batch.thumbnailUrl ? (
          <img src={data.batch.thumbnailUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-black shrink-0">{data.batch.name.charAt(0)}</div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
            <Link href="/courses" className="hover:text-blue-600">My Batches</Link>
            <span className="material-symbols-outlined text-[11px]">chevron_right</span>
            <button type="button" onClick={() => go({ tab: "home" })} className="truncate hover:text-blue-600">{data.batch.name}</button>
          </p>
          <h1 className="text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
            {nav.tab === "home" ? data.batch.name : LABEL[nav.tab]}
          </h1>
        </div>
      </div>

      {live.length > 0 && (
        <Link href={`/live-class/${live[0]!.id}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-rose-600 text-white">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            <span className="font-semibold text-xs truncate">LIVE NOW · {live[0]!.title}</span>
          </span>
          <span className="text-[11px] font-bold bg-white text-rose-600 px-2.5 py-0.5 rounded-full shrink-0">Join</span>
        </Link>
      )}

      {nav.tab === "home" && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <HomeBox icon="apps" tone="blue" label="All Content" sub={plural(new Set(data.chapters.map((c) => c.subject)).size, "subject")} onClick={() => go({ tab: "content" })} />
          <HomeBox icon="calendar_month" tone="indigo" label="Batch Schedule" sub="Timetable" href={`/schedule?batch=${encodeURIComponent(data.batch.id)}`} />
          <HomeBox icon="sensors" tone="rose" label="Live Class" sub={upcoming.length ? `${upcoming.length} upcoming` : "None yet"} badge={live.length ? "LIVE" : undefined} onClick={() => go({ tab: "live" })} />
          <HomeBox icon="smart_display" tone="violet" label="Recorded" sub={plural(recorded.length, "class")} onClick={() => go({ tab: "recorded" })} />
          <HomeBox icon="assignment" tone="emerald" label="DPP" sub={plural(data.dpps.length, "DPP")} onClick={() => go({ tab: "dpp" })} />
          <HomeBox icon="quiz" tone="orange" label="Test" sub={plural(data.tests.length, "test")} onClick={() => go({ tab: "tests" })} />
          <HomeBox icon="menu_book" tone="amber" label="Notes and Module" sub={plural(data.folders.reduce((n, f) => n + f.files.length, 0), "file")} onClick={() => go({ tab: "notes" })} />
          <HomeBox icon="picture_as_pdf" tone="red" label="All PDF" sub={plural(pdfCount, "PDF")} onClick={() => go({ tab: "pdf" })} />
          <HomeBox icon="campaign" tone="sky" label="Notice" sub={plural(data.notices.length, "notice")} onClick={() => go({ tab: "notices" })} />
        </div>
      )}

      {nav.tab === "content" && <ContentTab data={data} now={now} nav={nav} go={go} />}
      {nav.tab === "live" && <LiveTab classes={upcoming} now={now} />}
      {nav.tab === "recorded" && <RecordedTab data={data} now={now} nav={nav} go={go} />}
      {nav.tab === "dpp" && <DppTab dpps={data.dpps} nav={nav} go={go} />}
      {nav.tab === "tests" && <TestsTab tests={data.tests} now={now} />}
      {nav.tab === "notes" && <NotesTab folders={data.folders} teachers={data.batch.teacherCards} nav={nav} go={go} />}
      {nav.tab === "pdf" && <PdfTab data={data} nav={nav} go={go} />}
      {nav.tab === "notices" && <NoticesTab notices={data.notices} />}
      {nav.tab === "announcements" && <AnnouncementsTab items={data.announcements} />}
    </div>
  );
}

/* ---------- building blocks ---------- */

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const CARD = "bg-white dark:bg-slate-900 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.08)]";

function HomeBox({ icon, tone, label, sub, onClick, href, badge }: { icon: string; tone: string; label: string; sub?: string; onClick?: () => void; href?: string; badge?: string }) {
  const inner = (
    <>
      {badge && <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-rose-600 text-white px-1.5 py-px rounded-full">{badge}</span>}
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-tight text-center">{label}</span>
      {sub && <span className="text-[9.5px] text-slate-500 leading-none">{sub}</span>}
    </>
  );
  const cls = `${CARD} relative flex flex-col items-center justify-center gap-1 px-1.5 py-3 min-h-[92px] active:scale-[0.98] transition`;
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** A small folder box (subject / chapter / category). */
function FolderBox({ icon = "folder", tone = "blue", label, sub, onClick }: { icon?: string; tone?: string; label: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex items-center gap-2.5 p-2.5 text-left active:scale-[0.99] transition min-w-0`}>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{label}</span>
        {sub && <span className="block text-[10px] text-slate-500 truncate">{sub}</span>}
      </span>
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-0.5">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-5 text-center text-[11px] text-slate-500">{text}</p>;
}

function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap text-[11px] font-semibold">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="material-symbols-outlined text-[12px] text-slate-400">chevron_right</span>}
          {it.onClick ? (
            <button type="button" onClick={it.onClick} className="text-blue-600">{it.label}</button>
          ) : (
            <span className="text-slate-800 dark:text-slate-100">{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/** One download — the complete PDF (questions, answer key and solutions). */
function PdfDownload({ href }: { href: string }) {
  return (
    <a
      href={`${href}?type=solutions`}
      title="Download PDF"
      aria-label="Download PDF"
      className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0 active:scale-95 transition"
    >
      <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
    </a>
  );
}

function Row({ icon, tone, title, meta, chip, actions }: { icon: string; tone: string; title: string; meta?: React.ReactNode; chip?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={`${CARD} flex items-center gap-2.5 p-2.5`}>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug break-words line-clamp-2">{title}</p>
        {meta && <p className="text-[10px] text-slate-500 leading-snug">{meta}</p>}
        {chip}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

const BTN = "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0";

/* ---------- classes ---------- */

function ClassRow({ c, now }: { c: BatchClassItem; now: Date }) {
  const status = getEffectiveScheduleStatus(c, now);
  const join = canStudentJoinClass(c, now);
  let action: React.ReactNode;
  if (status === "LIVE") action = <Link href={`/live-class/${c.id}`} className={`${BTN} bg-rose-600 text-white`}>Join</Link>;
  else if (status === "COMPLETED") action = <Link href={`/watch/${c.id}`} className={`${BTN} bg-blue-600 text-white flex items-center gap-0.5`}><span className="material-symbols-outlined text-[14px]">play_arrow</span>Play</Link>;
  else if (status === "CANCELLED") action = <span className="text-[10px] font-semibold text-rose-500">Cancelled</span>;
  else if (join.allowed) action = <Link href={`/live-class/${c.id}`} className={`${BTN} bg-blue-600 text-white`}>Enter</Link>;
  else action = <span className="text-[10px] font-semibold text-slate-500">{time(c.startsAt)}</span>;
  return (
    <div className={`${CARD} flex items-center gap-2.5 p-2.5`}>
      <div className="w-10 text-center shrink-0">
        <p className="text-[9px] font-semibold text-slate-500 uppercase leading-none">{new Date(c.startsAt).toLocaleDateString("en-IN", { timeZone: IST, month: "short" })}</p>
        <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{new Date(c.startsAt).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit" })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">{c.title}</p>
        <p className="text-[10px] text-slate-500 truncate">{[c.subject, c.teacherName, `${time(c.startsAt)} – ${time(c.endsAt)}`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** Upcoming classes only (and the one live now), as compact day cards. */
function LiveTab({ classes, now }: { classes: BatchClassItem[]; now: Date }) {
  if (classes.length === 0) return <Empty text="No upcoming class right now. New classes appear here as soon as they are scheduled." />;
  const days = Array.from(new Set(classes.map((c) => dayKey(c.startsAt))));
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = classes.filter((c) => dayKey(c.startsAt) === d);
        const label = d === today ? "Today" : d === tomorrow ? "Tomorrow" : date(list[0]!.startsAt);
        return (
          <section key={d} className="space-y-1.5">
            <div className="flex items-center gap-2 px-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d === today ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{label}</span>
              <span className="text-[10px] text-slate-400">{plural(list.length, "class")}</span>
            </div>
            <div className="space-y-1.5">
              {list.map((c) => {
                const status = getEffectiveScheduleStatus(c, now);
                const join = canStudentJoinClass(c, now);
                return (
                  <div key={c.id} className={`${CARD} flex items-stretch overflow-hidden`}>
                    <div className={`w-[68px] shrink-0 flex flex-col items-center justify-center py-2 ${status === "LIVE" ? "bg-rose-600 text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"}`}>
                      <span className="text-[11px] font-bold leading-tight">{time(c.startsAt)}</span>
                      <span className="text-[9px] opacity-80 leading-tight">to {time(c.endsAt)}</span>
                    </div>
                    <div className="min-w-0 flex-1 px-2.5 py-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">{c.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{[c.subjectName !== "Other classes" ? c.subjectName : c.subject, c.chapterTitle, c.teacherName].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex items-center pr-2.5 shrink-0">
                      {status === "LIVE" ? (
                        <Link href={`/live-class/${c.id}`} className={`${BTN} bg-rose-600 text-white`}>Join</Link>
                      ) : join.allowed ? (
                        <Link href={`/live-class/${c.id}`} className={`${BTN} bg-blue-600 text-white`}>Enter</Link>
                      ) : (
                        <span className="material-symbols-outlined text-[18px] text-slate-300">schedule</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Recorded classes as folders: Subject → Chapter → classes. */
function RecordedTab({ data, now, nav, go }: { data: StudentBatchHomeData; now: Date; nav: Nav; go: (n: Partial<Nav>) => void }) {
  const subject = nav.s;
  const chapter = nav.c; // chapterId, or "-" for classes without a chapter
  const recorded = data.classes
    .filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED")
    .slice()
    .reverse();
  const subjects = Array.from(new Set([...recorded.map((c) => c.subjectName), ...data.chapters.map((c) => c.subject)])).sort();
  const n = (list: BatchClassItem[]) => plural(list.length, "recorded class");

  if (recorded.length === 0 && data.chapters.length === 0) return <Empty text="Recorded classes appear here after each class." />;

  if (!subject) {
    return (
      <div className="space-y-2">
        <Crumbs items={[{ label: "All subjects" }]} />
        <Grid>
          {subjects.map((s) => (
            <FolderBox key={s} tone="violet" label={s} sub={n(recorded.filter((c) => c.subjectName === s))} onClick={() => go({ tab: "recorded", s })} />
          ))}
        </Grid>
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

  if (!chapter) {
    return (
      <div className="space-y-2">
        <Crumbs items={[{ label: "All subjects", onClick: () => go({ tab: "recorded" }) }, { label: subject }]} />
        <Grid>
          {chapters.map((ch) => (
            <FolderBox key={ch.id} tone="amber" label={ch.title} sub={n(inSubject.filter((c) => c.chapterId === ch.id))} onClick={() => go({ tab: "recorded", s: subject, c: ch.id })} />
          ))}
          {loose.length > 0 && <FolderBox tone="slate" label="Other classes" sub={n(loose)} onClick={() => go({ tab: "recorded", s: subject, c: "-" })} />}
        </Grid>
        {chapters.length === 0 && loose.length === 0 && <Empty text="No recorded classes in this subject yet." />}
      </div>
    );
  }

  const ch = chapters.find((c) => c.id === chapter);
  const list = chapter === "-" ? loose : inSubject.filter((c) => c.chapterId === chapter);
  return (
    <div className="space-y-2">
      <Crumbs items={[{ label: "All subjects", onClick: () => go({ tab: "recorded" }) }, { label: subject, onClick: () => go({ tab: "recorded", s: subject }) }, { label: ch?.title ?? "Other classes" }]} />
      {ch && ch.subjectId && (
        <Link href={`/courses/${data.batch.id}/subjects/${ch.subjectId}/chapters/${ch.id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
          <span>Chapter notes, DPPs &amp; lectures ({ch.lectures} lectures · {ch.dpps} DPPs)</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </Link>
      )}
      {list.length ? <div className="space-y-1.5">{list.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div> : <Empty text="No recorded class in this chapter yet." />}
    </div>
  );
}

/* ---------- tests ---------- */

function testState(t: BatchTestItem, now: Date) {
  if (t.attemptStatus === "SUBMITTED") return "done";
  if (t.attemptStatus === "IN_PROGRESS") return "resume";
  if (t.openTime && new Date(t.openTime) > now) return "upcoming";
  if (t.closeTime && new Date(t.closeTime) < now) return "missed";
  return "open";
}

function TestRow({ t, now }: { t: BatchTestItem; now: Date }) {
  const s = testState(t, now);
  return (
    <Row
      icon="quiz"
      tone="orange"
      title={t.name}
      meta={`${t.durationMin} min${t.openTime ? ` · ${date(t.openTime)}, ${time(t.openTime)}` : ""}`}
      actions={
        <>
          {s === "open" && <Link href={`/tests/${t.id}/attempt`} className={`${BTN} bg-blue-600 text-white`}>Start</Link>}
          {s === "resume" && <Link href={`/tests/${t.id}/attempt`} className={`${BTN} bg-amber-500 text-white`}>Resume</Link>}
          {s === "done" && t.pdfHref && <PdfDownload href={t.pdfHref} />}
          {s === "done" && <Link href={`/tests/${t.id}/result`} className={`${BTN} bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100`}>Result</Link>}
          {s === "upcoming" && <span className="text-[10px] font-semibold text-slate-500">Opens {t.openTime ? date(t.openTime) : ""}</span>}
          {s === "missed" && <span className="text-[10px] font-semibold text-slate-400">Closed</span>}
        </>
      }
    />
  );
}

function TestsTab({ tests, now }: { tests: BatchTestItem[]; now: Date }) {
  const groups: { title: string; keys: string[] }[] = [
    { title: "Available now", keys: ["open", "resume"] },
    { title: "Upcoming", keys: ["upcoming"] },
    { title: "Attempted", keys: ["done"] },
    { title: "Missed", keys: ["missed"] },
  ];
  if (tests.length === 0) return <Empty text="No tests in this batch yet." />;
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const list = tests.filter((t) => g.keys.includes(testState(t, now)));
        if (!list.length) return null;
        return (
          <Section key={g.title} title={`${g.title} (${list.length})`}>
            <div className="space-y-1.5">{list.map((t) => <TestRow key={t.id} t={t} now={now} />)}</div>
          </Section>
        );
      })}
    </div>
  );
}

/* ---------- DPP ---------- */

const DPP_CHIP: Record<BatchDppItem["status"], { label: string; cls: string }> = {
  UPCOMING: { label: "Upcoming", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  LOCKED: { label: "Coming soon", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  PENDING: { label: "Not attempted", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  IN_PROGRESS: { label: "In progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  COMPLETED: { label: "Done", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

function DppRow({ d }: { d: BatchDppItem }) {
  const chip = DPP_CHIP[d.status];
  return (
    <Row
      icon="assignment"
      tone="emerald"
      title={d.title}
      meta={[
        d.questionCount > 0 ? `${d.questionCount} Qs` : null,
        d.durationMin > 0 ? `${d.durationMin} min` : null,
        d.status === "UPCOMING" && d.opensAt ? `opens ${date(d.opensAt)}, ${time(d.opensAt)}` : null,
        d.status === "COMPLETED" && d.score != null ? `score ${d.score}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      chip={<span className={`inline-block mt-0.5 px-1.5 py-px rounded-full text-[9px] font-semibold ${chip.cls}`}>{chip.label}</span>}
      actions={
        <>
          {d.pdfHref && <PdfDownload href={d.pdfHref} />}
          {d.href ? (
            <Link href={d.href} className={`${BTN} ${d.status === "COMPLETED" ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100" : "bg-blue-600 text-white"}`}>
              {d.status === "COMPLETED" ? "Result" : d.status === "IN_PROGRESS" ? "Resume" : "Attempt"}
            </Link>
          ) : (
            <span className="material-symbols-outlined text-[18px] text-slate-300">lock</span>
          )}
        </>
      }
    />
  );
}

function DppTab({ dpps, nav, go }: { dpps: BatchDppItem[]; nav: Nav; go: (n: Partial<Nav>) => void }) {
  const subject = nav.s;
  const chapter = nav.c;
  if (dpps.length === 0) return <Empty text="DPPs for this batch will appear here." />;
  const sub = (list: BatchDppItem[]) => {
    const p = list.filter((d) => d.status === "PENDING" || d.status === "IN_PROGRESS").length;
    return `${plural(list.length, "DPP")}${p ? ` · ${p} to do` : ""}`;
  };

  if (!subject) {
    const subjects = Array.from(new Set(dpps.map((d) => d.subject))).sort();
    return (
      <div className="space-y-2">
        <Crumbs items={[{ label: "All subjects" }]} />
        <Grid>{subjects.map((s) => <FolderBox key={s} tone="emerald" label={s} sub={sub(dpps.filter((d) => d.subject === s))} onClick={() => go({ tab: "dpp", s })} />)}</Grid>
      </div>
    );
  }
  const inSubject = dpps.filter((d) => d.subject === subject);
  if (!chapter) {
    const chapters = Array.from(new Set(inSubject.map((d) => d.chapter)));
    return (
      <div className="space-y-2">
        <Crumbs items={[{ label: "All subjects", onClick: () => go({ tab: "dpp" }) }, { label: subject }]} />
        <Grid>{chapters.map((c) => <FolderBox key={c} tone="amber" label={c} sub={sub(inSubject.filter((d) => d.chapter === c))} onClick={() => go({ tab: "dpp", s: subject, c })} />)}</Grid>
      </div>
    );
  }
  const list = inSubject.filter((d) => d.chapter === chapter);
  return (
    <div className="space-y-2">
      <Crumbs items={[{ label: "All subjects", onClick: () => go({ tab: "dpp" }) }, { label: subject, onClick: () => go({ tab: "dpp", s: subject }) }, { label: chapter }]} />
      {list.length ? <div className="space-y-1.5">{list.map((d) => <DppRow key={d.id} d={d} />)}</div> : <Empty text="No DPP in this chapter yet." />}
    </div>
  );
}

/* ---------- All Content: Subject → Chapter → everything ---------- */

function ContentTab({ data, now, nav, go }: { data: StudentBatchHomeData; now: Date; nav: Nav; go: (n: Partial<Nav>) => void }) {
  const subject = nav.s;
  const chapterId = nav.c;
  const subjects = Array.from(new Set(data.chapters.map((c) => c.subject))).sort();

  if (!subject) {
    return (
      <div className="space-y-3">
        <Section title="Subjects">
          {subjects.length ? (
            <Grid>
              {subjects.map((s) => (
                <FolderBox key={s} tone="blue" icon="auto_stories" label={s} sub={plural(data.chapters.filter((c) => c.subject === s).length, "chapter")} onClick={() => go({ tab: "content", s })} />
              ))}
            </Grid>
          ) : (
            <Empty text="Subjects appear here once chapters are added to this batch." />
          )}
        </Section>
        <Section title="Everything in this batch">
          <Grid>
            <FolderBox icon="picture_as_pdf" tone="red" label="All PDF" onClick={() => go({ tab: "pdf" })} />
            <FolderBox icon="sensors" tone="rose" label="All Classes" sub="Upcoming" onClick={() => go({ tab: "live" })} />
            <FolderBox icon="smart_display" tone="violet" label="Recorded Classes" onClick={() => go({ tab: "recorded" })} />
            <FolderBox icon="quiz" tone="orange" label="All Test" sub={plural(data.tests.length, "test")} onClick={() => go({ tab: "tests" })} />
            <FolderBox icon="assignment" tone="emerald" label="All DPPs" sub={plural(data.dpps.length, "DPP")} onClick={() => go({ tab: "dpp" })} />
            <FolderBox icon="campaign" tone="sky" label="All Notice" sub={plural(data.notices.length, "notice")} onClick={() => go({ tab: "notices" })} />
            <FolderBox icon="record_voice_over" tone="indigo" label="All Announcement" sub={plural(data.announcements.length, "announcement")} onClick={() => go({ tab: "announcements" })} />
          </Grid>
        </Section>
      </div>
    );
  }

  const chapters = data.chapters.filter((c) => c.subject === subject);
  if (!chapterId) {
    return (
      <div className="space-y-2">
        <Crumbs items={[{ label: "All Content", onClick: () => go({ tab: "content" }) }, { label: subject }]} />
        {chapters.length ? (
          <Grid>
            {chapters.map((ch) => (
              <FolderBox key={ch.id} tone="amber" label={ch.title} sub={[ch.lectures ? plural(ch.lectures, "lecture") : null, ch.dpps ? plural(ch.dpps, "DPP") : null].filter(Boolean).join(" · ") || undefined} onClick={() => go({ tab: "content", s: subject, c: ch.id })} />
            ))}
          </Grid>
        ) : (
          <Empty text="No chapter in this subject yet." />
        )}
      </div>
    );
  }

  const ch = data.chapters.find((c) => c.id === chapterId);
  const classes = data.classes.filter((c) => c.chapterId === chapterId);
  const upcoming = classes.filter((c) => { const s = getEffectiveScheduleStatus(c, now); return s === "LIVE" || (s !== "COMPLETED" && s !== "CANCELLED" && new Date(c.endsAt) > now); });
  const recorded = classes.filter((c) => getEffectiveScheduleStatus(c, now) === "COMPLETED").reverse();
  const dpps = data.dpps.filter((d) => d.chapterId === chapterId);
  const tests = data.tests.filter((t) => t.chapterId === chapterId);
  const notes = classes.filter((c) => c.notesSessionId);
  const announcements = data.announcements.filter((a) => a.chapterId === chapterId);
  const nothing = !classes.length && !dpps.length && !tests.length && !announcements.length;

  return (
    <div className="space-y-3">
      <Crumbs items={[{ label: "All Content", onClick: () => go({ tab: "content" }) }, { label: subject, onClick: () => go({ tab: "content", s: subject }) }, { label: ch?.title ?? "Chapter" }]} />
      {ch && (
        <Link href={`/courses/${data.batch.id}/subjects/${ch.subjectId}/chapters/${ch.id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
          <span>Open chapter page — lectures &amp; class notes</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </Link>
      )}
      {upcoming.length > 0 && <Section title="Upcoming classes"><div className="space-y-1.5">{upcoming.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div></Section>}
      {recorded.length > 0 && <Section title="Recorded classes"><div className="space-y-1.5">{recorded.map((c) => <ClassRow key={c.id} c={c} now={now} />)}</div></Section>}
      {dpps.length > 0 && <Section title="DPP"><div className="space-y-1.5">{dpps.map((d) => <DppRow key={d.id} d={d} />)}</div></Section>}
      {tests.length > 0 && <Section title="Test"><div className="space-y-1.5">{tests.map((t) => <TestRow key={t.id} t={t} now={now} />)}</div></Section>}
      {notes.length > 0 && (
        <Section title="Class notes PDF">
          <div className="space-y-1.5">{notes.map((c) => <ClassNotesRow key={c.id} title={c.title} sessionId={c.notesSessionId!} meta={date(c.startsAt)} />)}</div>
        </Section>
      )}
      {announcements.length > 0 && <Section title="Announcements"><AnnouncementsTab items={announcements} /></Section>}
      {nothing && <Empty text="Classes, DPPs and tests of this chapter will appear here." />}
    </div>
  );
}

/* ---------- Notes and Module (batch folders) ---------- */

const INFO = "__batch_info__";
const isInfoFolder = (name: string) => /^(batch\s*info|brochure)$/i.test(name.trim());

function NotesTab({ folders, teachers, nav, go }: { folders: StudentBatchHomeData["folders"]; teachers: StudentBatchHomeData["batch"]["teacherCards"]; nav: Nav; go: (n: Partial<Nav>) => void }) {
  const path = nav.k ? nav.k.split("/").filter(Boolean) : [];
  const setPath = (p: string[]) => go({ tab: "notes", k: p.length ? p.join("/") : null });
  const current = path[path.length - 1] ?? null;
  // The admin's own "Batch Info" / "Brochure" folder is shown inside the
  // pinned Batch Info folder, not twice.
  const infoFolders = folders.filter((f) => !f.parentId && isInfoFolder(f.name));
  const children = current === INFO ? [] : folders.filter((f) => f.parentId === current && !(current === null && isInfoFolder(f.name)));
  const files = current === INFO ? infoFolders.flatMap((f) => f.files) : current ? folders.find((f) => f.id === current)?.files ?? [] : [];
  const nameOf = (id: string) => (id === INFO ? "Batch Info" : folders.find((f) => f.id === id)?.name ?? "");
  const countIn = (id: string): number =>
    (folders.find((f) => f.id === id)?.files.length ?? 0) + folders.filter((f) => f.parentId === id).reduce((n, f) => n + countIn(f.id), 0);
  const infoFileCount = infoFolders.reduce((n, f) => n + f.files.length, 0);

  return (
    <div className="space-y-2">
      <Crumbs items={[{ label: "Notes and Module", onClick: current ? () => setPath([]) : undefined }, ...path.map((id, i) => ({ label: nameOf(id), onClick: i === path.length - 1 ? undefined : () => setPath(path.slice(0, i + 1)) }))]} />

      {current === null && (
        <button type="button" onClick={() => setPath([INFO])} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-left">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Batch Info</span>
            <span className="block text-[10px] text-white/80">
              {plural(teachers.length, "teacher")}
              {infoFileCount ? ` · brochure & ${plural(infoFileCount, "file")}` : ""}
            </span>
          </span>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      )}

      {current === INFO && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-0.5">Your teachers</h3>
          {teachers.length === 0 ? (
            <Empty text="Teachers will be listed here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teachers.map((t) => (
                <div key={t.id} className={`${CARD} flex gap-2.5 p-2.5`}>
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-base font-bold shrink-0">{t.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-[10px] font-semibold text-blue-600">
                      {[t.subjects.join(", "), t.experienceYears ? `${t.experienceYears} yrs experience` : null].filter(Boolean).join(" · ")}
                    </p>
                    {t.bio && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-3">{t.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-0.5 pt-1">Brochure</h3>
          {files.length === 0 && <Empty text="The batch brochure will be added here soon." />}
        </section>
      )}

      {children.length > 0 && (
        <Grid>
          {children.map((f) => (
            <FolderBox key={f.id} tone="amber" label={f.name} sub={plural(countIn(f.id), "file")} onClick={() => setPath([...path, f.id])} />
          ))}
        </Grid>
      )}

      {files.length > 0 && <div className="space-y-1.5">{files.map((file) => <FileRow key={file.id} id={file.id} title={file.title} meta={size(file.sizeBytes)} />)}</div>}

      {current && current !== INFO && children.length === 0 && files.length === 0 && <Empty text="This folder is empty." />}
      {current === null && children.length === 0 && <Empty text="Notes and modules for this batch will appear here." />}
    </div>
  );
}

function FileRow({ id, title, meta }: { id: string; title: string; meta?: string }) {
  return (
    <Row
      icon="picture_as_pdf"
      tone="red"
      title={title}
      meta={meta}
      actions={
        <>
          <a href={`/api/batch-materials/${id}?inline=1`} target="_blank" rel="noreferrer" className={`${BTN} bg-blue-600 text-white`}>Open</a>
          <a href={`/api/batch-materials/${id}`} title="Download" aria-label="Download" className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">download</span>
          </a>
        </>
      }
    />
  );
}

function ClassNotesRow({ title, sessionId, meta }: { title: string; sessionId: string; meta?: string }) {
  return (
    <Row
      icon="draw"
      tone="indigo"
      title={title}
      meta={meta}
      actions={
        <WhiteboardPdfDownloadButton sessionId={sessionId} title="Download class notes PDF" className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
        </WhiteboardPdfDownloadButton>
      }
    />
  );
}

/* ---------- All PDF ---------- */

type PdfCat = { id: string; label: string; icon: string; tone: string; count: number };

function pdfCategories(data: StudentBatchHomeData): PdfCat[] {
  const boardNotes = data.classes.filter((c) => c.notesSessionId).length;
  return [
    { id: "notes", label: "Class Notes", icon: "draw", tone: "indigo", count: data.classNoteFiles.length + boardNotes },
    { id: "dpp", label: "DPP PDF", icon: "assignment", tone: "emerald", count: data.dpps.filter((d) => d.pdfHref).length },
    { id: "test", label: "Test PDF", icon: "quiz", tone: "orange", count: data.tests.filter((t) => t.pdfHref).length },
    { id: "syllabus", label: "Test Syllabus", icon: "fact_check", tone: "sky", count: data.syllabusFiles.length },
  ];
}

function PdfTab({ data, nav, go }: { data: StudentBatchHomeData; nav: Nav; go: (n: Partial<Nav>) => void }) {
  const cats = pdfCategories(data);
  const cat = cats.find((c) => c.id === nav.k);
  if (!cat) {
    return (
      <Grid>
        {cats.map((c) => (
          <FolderBox key={c.id} icon={c.icon} tone={c.tone} label={c.label} sub={plural(c.count, "PDF")} onClick={() => go({ tab: "pdf", k: c.id })} />
        ))}
      </Grid>
    );
  }

  let body: React.ReactNode = null;
  if (cat.id === "notes") {
    const board = data.classes.filter((c) => c.notesSessionId).slice().reverse();
    body = (
      <>
        {board.map((c) => <ClassNotesRow key={c.id} title={c.title} sessionId={c.notesSessionId!} meta={[c.subjectName, date(c.startsAt)].join(" · ")} />)}
        {data.classNoteFiles.map((f) => <FileRow key={f.id} id={f.id} title={f.title} meta={[f.subject, size(f.sizeBytes)].filter(Boolean).join(" · ")} />)}
      </>
    );
  } else if (cat.id === "dpp") {
    body = data.dpps.filter((d) => d.pdfHref).map((d) => (
      <Row key={d.id} icon="assignment" tone="emerald" title={d.title} meta={`${d.subject} · ${d.chapter}`} actions={<PdfDownload href={d.pdfHref!} />} />
    ));
  } else if (cat.id === "test") {
    body = data.tests.filter((t) => t.pdfHref).map((t) => (
      <Row key={t.id} icon="quiz" tone="orange" title={t.name} meta={t.openTime ? date(t.openTime) : undefined} actions={<PdfDownload href={t.pdfHref!} />} />
    ));
  } else {
    body = data.syllabusFiles.map((f) => <FileRow key={f.id} id={f.id} title={f.title} meta={size(f.sizeBytes)} />);
  }

  return (
    <div className="space-y-2">
      <Crumbs items={[{ label: "All PDF", onClick: () => go({ tab: "pdf" }) }, { label: cat.label }]} />
      {cat.count ? (
        <div className="space-y-1.5">{body}</div>
      ) : (
        <Empty text={cat.id === "dpp" || cat.id === "test" ? "PDFs appear here after you submit (and, for tests, once results are out)." : "PDFs will appear here."} />
      )}
    </div>
  );
}

/* ---------- Notice & Announcements ---------- */

function NoticesTab({ notices }: { notices: StudentBatchHomeData["notices"] }) {
  if (notices.length === 0) return <Empty text="No notice for this batch yet." />;
  return (
    <div className="space-y-1.5">
      {notices.map((n) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
              <span className="text-[9.5px] text-slate-500 shrink-0">{date(n.createdAt)}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{n.body}</p>
          </>
        );
        return n.deepLink ? (
          <Link key={n.id} href={n.deepLink} className={`block p-2.5 ${CARD}`}>{body}</Link>
        ) : (
          <div key={n.id} className={`p-2.5 ${CARD}`}>{body}</div>
        );
      })}
    </div>
  );
}

function AnnouncementsTab({ items }: { items: StudentBatchHomeData["announcements"] }) {
  if (items.length === 0) return <Empty text="No announcement yet." />;
  return (
    <div className="space-y-1.5">
      {items.map((a) => (
        <div key={a.id} className={`p-2.5 ${CARD}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{a.title}</p>
            <span className="text-[9.5px] text-slate-500 shrink-0">{date(a.createdAt)}</span>
          </div>
          <p className="text-[10px] text-blue-600 font-semibold">{[a.chapterTitle, a.author].filter(Boolean).join(" · ")}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{a.body}</p>
        </div>
      ))}
    </div>
  );
}
