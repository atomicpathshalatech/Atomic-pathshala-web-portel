"use client";

import { useState } from "react";
import Link from "next/link";
import { ButtonLink, Icon, Section, SectionHeader, fmtCount, hd, type Head } from "./ui";

type Props = {
  pyqCounts: Record<string, Record<string, number>>;
  topChapters: { exam: string; subject: string; chapter: string; count: number }[];
  head?: Head;
  /** Exam tabs to show (ids from PYQ_EXAMS); all when empty. */
  exams?: string[];
};

// Where each exam's PYQs are practised today: NEET in PYQ Practice (free
// questions every day), JEE as previous-year papers in Study Material, Boards
// in the Board Exam Hub.
export const PYQ_EXAMS = ["NEET", "JEE Main", "JEE Advanced", "CBSE", "State Boards"];

const ALL_TABS = [
  { id: "NEET", label: "NEET", subjects: ["Physics", "Chemistry", "Biology"], href: "/practice", cta: "Practice NEET PYQs", note: "Free questions every day in PYQ Practice." },
  { id: "JEE Main", label: "JEE Main", subjects: ["Physics", "Chemistry", "Mathematics"], href: "/study-material", cta: "Open JEE PYQ papers", note: "Previous-year papers in Study Material." },
  { id: "JEE Advanced", label: "JEE Advanced", subjects: ["Physics", "Chemistry", "Mathematics"], href: "/study-material", cta: "Open JEE PYQ papers", note: "Previous-year papers in Study Material." },
  { id: "CBSE", label: "CBSE", subjects: ["Physics", "Chemistry", "Biology", "Mathematics"], href: "/practice/board-exam", cta: "Practice Board PYQs", note: "Class 10 & 12 board PYQs and model papers." },
  { id: "State Boards", label: "State Boards", subjects: ["Physics", "Chemistry", "Biology", "Mathematics"], href: "/practice/board-exam", cta: "Practice Board PYQs", note: "Class 10 & 12 board PYQs and model papers." },
];

const WAYS = [
  { icon: "view_list", label: "Chapter-wise PYQs" },
  { icon: "label", label: "Topic-wise PYQs" },
  { icon: "event", label: "Year-wise PYQs" },
];

/** PRACTICE REAL EXAM QUESTIONS — exam tabs → subjects → chapters, from the question bank. */
export function PyqHub({ pyqCounts, topChapters, head, exams }: Props) {
  const picked = exams?.length ? ALL_TABS.filter((t) => exams.includes(t.id)) : [];
  const TABS = picked.length ? picked : ALL_TABS;
  const [tab, setTab] = useState(TABS[0]!.id);
  const [subject, setSubject] = useState<string | null>(null);
  const t = TABS.find((x) => x.id === tab) ?? TABS[0]!;
  const counts = pyqCounts[tab] ?? {};
  const chapters = topChapters.filter((c) => c.exam === tab && (!subject || c.subject === subject)).slice(0, 6);

  return (
    <Section id="pyq" tone="navy">
      <SectionHeader
        dark
        {...hd(head, { eyebrow: "PYQ hub", title: "Practice real exam questions", subtitle: "NEET, JEE and Board previous-year questions — chapter-wise, topic-wise and year-wise, with solutions." })}
      />

      <div role="tablist" aria-label="Exam" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={tab === x.id}
            onClick={() => {
              setTab(x.id);
              setSubject(null);
            }}
            className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              tab === x.id ? "bg-white text-[#0b1736]" : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Subjects</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {t.subjects.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(subject === s ? null : s)}
                aria-pressed={subject === s}
                className={`min-h-[64px] rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                  subject === s ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white hover:bg-white/10"
                }`}
              >
                <span className="block text-sm font-semibold">{s}</span>
                <span className="block text-xs text-white/60">{counts[s] ? `${fmtCount(counts[s])} in question bank` : "Practice"}</span>
              </button>
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {WAYS.map((w) => (
              <li key={w.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/80">
                <Icon name={w.icon} className="text-[15px] text-cyan-300" /> {w.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/60">{t.note}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={t.href} variant="light">
              {t.cta} <Icon name="arrow_forward" className="text-[18px]" />
            </ButtonLink>
            {t.href !== "/study-material" && (
              <Link href="/study-material" className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-white/85 ring-1 ring-white/20 hover:bg-white/10">
                Previous year papers (PDF)
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            {subject ? `${subject} — chapters with most PYQs` : "Chapters with the most PYQs"}
          </p>
          {chapters.length ? (
            <ol className="mt-3 divide-y divide-white/10">
              {chapters.map((c) => (
                <li key={`${c.subject}-${c.chapter}`}>
                  <Link href={t.href} className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm text-white hover:text-cyan-200">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.chapter}</span>
                      <span className="block text-xs text-white/50">{c.subject}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/60">{fmtCount(c.count)} PYQs</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-white/60">
              Chapter-wise lists for {t.label} open when you start practising.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
