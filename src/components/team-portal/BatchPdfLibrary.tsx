"use client";

import { useState } from "react";
import Link from "next/link";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";

/**
 * "All PDFs" for one batch — every piece of material the batch has produced
 * or inherited, in one place.
 *
 * Nothing here is uploaded by hand. Each section gathers what already exists:
 *   Class Notes — the PDF the whiteboard pipeline writes when a live class
 *                 ends. Served by /api/whiteboard/sessions/[id]/slides, which
 *                 checks access itself, so the same link works for a student.
 *   DPPs        — the DPPs attached to the chapters imported into this batch.
 *   Tests       — the same, split into chapter tests and test-series tests,
 *                 because those are two different things to a student even
 *                 though they are one table.
 *
 * Class notes are a real downloadable file. DPPs and tests are live,
 * attemptable objects with no paper version, so they link to the item rather
 * than pretending a PDF exists — see the note rendered in those sections.
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
};

type Section = "notes" | "dpp" | "test";

function groupBySubject<T extends { subject: string }>(rows: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.subject || "General";
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries());
}

function SubjectCard({ subject, count, children }: { subject: string; count: number; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 border border-outline-variant/30 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
            {subject[0]}
          </span>
          <h4 className="font-bold text-sm text-on-surface truncate">{subject}</h4>
        </div>
        <span className="text-xs text-on-surface-variant font-mono shrink-0">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="glass-card rounded-3xl p-8 sm:p-12 text-center text-on-surface-variant space-y-2 border border-dashed border-outline-variant/30">
      <span className="material-symbols-outlined text-4xl text-primary opacity-60">{icon}</span>
      <h4 className="font-bold text-sm text-on-surface">{title}</h4>
      <p className="text-xs max-w-md mx-auto">{body}</p>
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

  const chapterTests = tests.filter((t) => !t.series);
  const seriesTests = tests.filter((t) => t.series);

  const seriesGroups = Array.from(
    seriesTests
      .reduce((map, t) => {
        const key = t.series!.name;
        const bucket = map.get(key);
        if (bucket) bucket.push(t);
        else map.set(key, [t]);
        return map;
      }, new Map<string, TestEntry[]>())
      .entries()
  );

  const TABS: Array<{ id: Section; label: string; icon: string; count: number }> = [
    { id: "notes", label: "Class Notes", icon: "menu_book", count: classNotes.length },
    { id: "dpp", label: "DPPs", icon: "task_alt", count: dpps.length },
    { id: "test", label: "Tests", icon: "quiz", count: tests.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">All PDFs</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Material for this batch, collected automatically — class notes from finished live
          classes, plus the DPPs and tests belonging to its imported chapters.
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

      {/* ---------------- Class Notes ---------------- */}
      {section === "notes" &&
        (classNotes.length === 0 ? (
          <EmptyState
            icon="menu_book"
            title="No class notes yet"
            body="A PDF appears here automatically once a live class of this batch ends and its whiteboard finishes processing."
          />
        ) : (
          <div className="space-y-4">
            {groupBySubject(classNotes).map(([subject, rows]) => (
              <SubjectCard key={subject} subject={subject} count={rows.length}>
                {rows.map((n) => (
                  <div
                    key={n.sessionId}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-on-surface truncate">{n.title}</p>
                      {n.heldOn && (
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(n.heldOn).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <WhiteboardPdfDownloadButton
                      sessionId={n.sessionId}
                      className="px-3 min-h-11 rounded-xl bg-primary/10 text-primary font-bold text-[11px] inline-flex items-center gap-1.5 hover:bg-primary/20 transition shrink-0 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      PDF
                    </WhiteboardPdfDownloadButton>
                  </div>
                ))}
              </SubjectCard>
            ))}
          </div>
        ))}

      {/* ---------------- DPPs ---------------- */}
      {section === "dpp" &&
        (dpps.length === 0 ? (
          <EmptyState
            icon="task_alt"
            title="No DPPs yet"
            body="DPPs attached to this batch's imported chapters show up here. Import a chapter, or add DPPs to one."
          />
        ) : (
          <div className="space-y-4">
            {groupBySubject(dpps).map(([subject, rows]) => (
              <SubjectCard key={subject} subject={subject} count={rows.length}>
                {rows.map((d) => (
                  <Link
                    key={d.id}
                    href={`/team/dpp/${d.id}`}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 transition-colors flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-on-surface truncate">{d.name}</p>
                        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">
                          {d.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        {d.chapter} &middot; {d.questionCount}{" "}
                        {d.questionCount === 1 ? "question" : "questions"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase shrink-0">
                      {d.status}
                    </span>
                  </Link>
                ))}
              </SubjectCard>
            ))}
          </div>
        ))}

      {/* ---------------- Tests ---------------- */}
      {section === "test" &&
        (tests.length === 0 ? (
          <EmptyState
            icon="quiz"
            title="No tests yet"
            body="Chapter tests and test-series tests belonging to this batch's imported chapters appear here."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Chapter Tests ({chapterTests.length})
              </h4>
              {chapterTests.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No standalone chapter tests yet.</p>
              ) : (
                groupBySubject(chapterTests).map(([subject, rows]) => (
                  <SubjectCard key={subject} subject={subject} count={rows.length}>
                    {rows.map((t) => (
                      <Link
                        key={t.id}
                        href={`/team/tests/${t.id}`}
                        className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 transition-colors flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-on-surface truncate">{t.name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {t.chapterTitle ? `${t.chapterTitle} · ` : ""}
                            {t.durationMin} min
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase shrink-0">
                          {t.status}
                        </span>
                      </Link>
                    ))}
                  </SubjectCard>
                ))
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Test Series ({seriesTests.length})
              </h4>
              {seriesGroups.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  No test-series tests linked to this batch&apos;s chapters yet.
                </p>
              ) : (
                seriesGroups.map(([seriesName, rows]) => (
                  <SubjectCard key={seriesName} subject={seriesName} count={rows.length}>
                    {rows.map((t) => (
                      <Link
                        key={t.id}
                        href={`/team/tests/${t.id}`}
                        className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 transition-colors flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-on-surface truncate">{t.name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {t.subject} &middot; {t.durationMin} min
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase shrink-0">
                          {t.status}
                        </span>
                      </Link>
                    ))}
                  </SubjectCard>
                ))
              )}
            </div>

            <p className="text-[11px] text-on-surface-variant border-t border-outline-variant/20 pt-3">
              Tests and DPPs are attempted online, so they have no PDF of their own yet — these
              link to the item. Say the word if you want a printable question paper generated
              for them.
            </p>
          </div>
        ))}
    </div>
  );
}
