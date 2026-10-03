"use client";

import { useState } from "react";
import Link from "next/link";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";
import { BOX, BOX_GRID, BackToSubjects, EmptyBox, SubjectBox, subjectTone } from "./batch-ui";

/**
 * "All PDFs" for one batch — every piece of material the batch has produced
 * or inherited, in one place. Nothing here is uploaded by hand:
 *   Class Notes — the PDF the whiteboard pipeline writes when a live class ends.
 *   DPPs        — the DPPs of the chapters imported into this batch.
 *   Tests       — chapter tests of those chapters, plus every test of the
 *                 test series imported into this batch.
 * DPPs and tests are downloaded as question paper / solutions PDFs.
 */

export type ClassNoteEntry = {
  sessionId: string;
  title: string;
  subject: string;
  heldOn: string | null;
};

export type DppEntry = {
  id: string;
  code: string;
  name: string;
  subject: string;
  chapter: string;
  status: string;
  questionCount: number;
};

export type TestEntry = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  durationMin: number;
  subject: string;
  chapterTitle: string | null;
  series: { id: string; name: string } | null;
  scheduledAt?: string | null;
};

type Section = "notes" | "dpp" | "test";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : null;

const DL =
  "h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300";
const DL2 =
  "h-8 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center transition text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

function subjectsOf<T extends { subject: string }>(rows: T[]) {
  return Array.from(new Set(rows.map((r) => r.subject || "General"))).sort();
}

/** Subject boxes; opening one shows `render(rowsOfThatSubject)`. */
function BySubject<T extends { subject: string }>({
  rows,
  unit,
  render,
}: {
  rows: T[];
  unit: string;
  render: (rows: T[], subject: string) => React.ReactNode;
}) {
  const subjects = subjectsOf(rows);
  const [open, setOpen] = useState<string | null>(subjects.length === 1 ? subjects[0]! : null);
  if (!open || !subjects.includes(open)) {
    return (
      <div className={BOX_GRID}>
        {subjects.map((s) => {
          const n = rows.filter((r) => (r.subject || "General") === s).length;
          return <SubjectBox key={s} subject={s} onClick={() => setOpen(s)} lines={[`${n} ${unit}${n === 1 ? "" : "s"}`]} />;
        })}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {subjects.length > 1 && <BackToSubjects subject={open} onBack={() => setOpen(null)} />}
      {render(
        rows.filter((r) => (r.subject || "General") === open),
        open
      )}
    </div>
  );
}

export function BatchPdfLibrary({
  classNotes,
  dpps,
  tests,
}: {
  classNotes: ClassNoteEntry[];
  dpps: DppEntry[];
  tests: TestEntry[];
}) {
  const [section, setSection] = useState<Section>("notes");

  const TABS: Array<{ id: Section; label: string; icon: string; count: number }> = [
    { id: "notes", label: "Class Notes", icon: "menu_book", count: classNotes.length },
    { id: "dpp", label: "DPPs", icon: "task_alt", count: dpps.length },
    { id: "test", label: "Tests", icon: "quiz", count: tests.length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">All PDFs</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Collected automatically — notes of finished classes, and the DPPs and tests of this batch&apos;s chapters and test series.
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSection(t.id)}
            className={`px-3.5 py-2 min-h-11 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              section === t.id
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {section === "notes" &&
        (classNotes.length === 0 ? (
          <EmptyBox icon="menu_book" title="No class notes yet" body="A PDF appears here automatically once a live class of this batch ends and its whiteboard finishes processing." />
        ) : (
          <BySubject
            key="notes"
            rows={classNotes}
            unit="note"
            render={(rows, subject) => (
              <div className={BOX_GRID}>
                {[...rows]
                  .sort((a, b) => (b.heldOn ?? "").localeCompare(a.heldOn ?? ""))
                  .map((n) => (
                    <div key={n.sessionId} className={`${BOX} flex flex-col gap-2`}>
                      <span className={`self-start px-2 py-0.5 rounded-md text-[10px] font-semibold ${subjectTone(subject).chip}`}>Class notes</span>
                      <p className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">{n.title}</p>
                      {n.heldOn && <p className="text-[11px] text-slate-500">{fmtDate(n.heldOn)}</p>}
                      <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                        <WhiteboardPdfDownloadButton sessionId={n.sessionId} className={`${DL} disabled:opacity-60`}>
                          <span className="material-symbols-outlined text-sm">download</span>
                          PDF
                        </WhiteboardPdfDownloadButton>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          />
        ))}

      {section === "dpp" &&
        (dpps.length === 0 ? (
          <EmptyBox icon="task_alt" title="No DPPs yet" body="DPPs of this batch's imported chapters show up here." />
        ) : (
          <BySubject
            key="dpp"
            rows={dpps}
            unit="DPP"
            render={(rows, subject) => (
              <div className={BOX_GRID}>
                {rows.map((d) => (
                  <div key={d.id} className={`${BOX} flex flex-col gap-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${subjectTone(subject).chip}`}>{d.code}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">{d.status.toLowerCase()}</span>
                    </div>
                    <Link href={`/team/dpp/${d.id}`} className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2 hover:underline">
                      {d.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 truncate">
                      {d.chapter} · {d.questionCount} questions
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                      <a href={`/api/team/dpp/${d.id}/pdf`} className={DL} title="Questions + solutions, one PDF">
                        <span className="material-symbols-outlined text-sm">download</span>
                        PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          />
        ))}

      {section === "test" &&
        (tests.length === 0 ? (
          <EmptyBox icon="quiz" title="No tests yet" body="Chapter tests and the tests of test series imported into this batch appear here." />
        ) : (
          <BySubject
            key="test"
            rows={tests}
            unit="test"
            render={(rows, subject) => (
              <div className={BOX_GRID}>
                {[...rows]
                  .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
                  .map((t) => (
                    <div key={t.id} className={`${BOX} flex flex-col gap-2`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold truncate ${subjectTone(subject).chip}`}>
                          {t.series ? t.series.name : "Chapter test"}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">{t.status.toLowerCase()}</span>
                      </div>
                      <Link href={`/team/tests/${t.id}`} className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2 hover:underline">
                        {t.name}
                      </Link>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[t.chapterTitle, fmtDate(t.scheduledAt), `${t.durationMin} min`].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                        <a href={`/api/tests/${t.id}/pdf?type=questions`} className={DL}>
                          <span className="material-symbols-outlined text-sm">download</span>
                          PDF
                        </a>
                        <a href={`/api/tests/${t.id}/pdf?type=solutions`} className={DL2}>
                          Solutions
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          />
        ))}
    </div>
  );
}
