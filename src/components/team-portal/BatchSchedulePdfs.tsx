"use client";

import { BOX, BOX_GRID, subjectTone } from "./batch-ui";

type ScheduleLite = {
  type: string;
  subject: string | null;
  startsAt: string;
  chapter: { subjectTitle: string | null } | null;
};

/**
 * Subject-wise schedule PDFs of the batch. Nothing is uploaded: each PDF is
 * made from the batch timetable when it is opened, so a class added, moved or
 * completed today is already in it (latest class first, with notes status).
 */
export function BatchSchedulePdfs({ batchId, schedules }: { batchId: string; schedules: ScheduleLite[] }) {
  const map = new Map<string, { classes: number; last: string }>();
  for (const s of schedules) {
    if (s.type !== "LIVE_CLASS") continue;
    const subject = (s.chapter?.subjectTitle || s.subject || "General").trim();
    const cur = map.get(subject) ?? { classes: 0, last: "" };
    cur.classes++;
    if (s.startsAt > cur.last) cur.last = s.startsAt;
    map.set(subject, cur);
  }
  const subjects = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const total = subjects.reduce((n, [, v]) => n + v.classes, 0);
  const fmt = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

  const card = (label: string, subject: string | null, classes: number, last: string) => {
    const tone = subjectTone(subject ?? "");
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return (
      <div key={label} className={`${BOX} flex flex-col gap-2`}>
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-xl ${tone.solid} text-white flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-xl">calendar_month</span>
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{label} Schedule</p>
            <p className="text-[11px] text-slate-500 truncate">
              {classes} class{classes === 1 ? "" : "es"} · latest {fmt(last)}
            </p>
          </div>
        </div>
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
          <a
            href={`/api/batches/${batchId}/schedule-pdf${q}`}
            className="h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 transition"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            PDF
          </a>
          <a
            href={`/api/batches/${batchId}/schedule-pdf${q ? `${q}&view=1` : "?view=1"}`}
            target="_blank"
            rel="noopener"
            className="h-8 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            View
          </a>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Auto-updated
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Class Schedule PDFs</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Subject-wise schedule, made automatically from this batch&apos;s timetable — newest class on top, with whether each class&apos;s notes are available or missing.
        </p>
      </div>
      {subjects.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center">
          No classes in this batch yet — schedule PDFs appear as soon as a class is added.
        </p>
      ) : (
        <div className={BOX_GRID}>
          {subjects.map(([s, v]) => card(s, s, v.classes, v.last))}
          {subjects.length > 1 && card("All Subjects", null, total, subjects.reduce((m, [, v]) => (v.last > m ? v.last : m), ""))}
        </div>
      )}
    </div>
  );
}
