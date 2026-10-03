import type { PublicHomeData } from "@/lib/public-home";
import { ButtonLink, CardRail, ResourceCard, Section, SectionHeader, fmtCount, hd, type Head } from "./ui";

export type LinkCard = { title: string; text?: string; href: string; icon?: string; cta?: string; external?: boolean };
const CARD_TONES = ["blue", "cyan", "orange", "green", "violet", "navy"];

const files = (n: number) => (n > 0 ? `${fmtCount(n)} file${n === 1 ? "" : "s"}` : undefined);

/** FREE LEARNING HUB — what a free account opens. */
export function FreeLearningHub({ data, youtubeUrl, head, items }: { data: PublicHomeData; youtubeUrl: string | null; head?: Head; items?: LinkCard[] }) {
  const m = data.materialCounts;
  const pyqTotal = Object.values(data.pyqCounts).reduce((n, s) => n + Object.values(s).reduce((a, b) => a + b, 0), 0);
  return (
    <Section id="free">
      <SectionHeader
        {...hd(head, {
          eyebrow: "Free learning hub",
          title: "Start with high-quality resources — completely free",
          subtitle: "Create a free account and open PYQs, notes, tests, DPPs, mind maps and formula sheets.",
        })}
      />
      {items?.length ? (
        <CardRail>
          {items.map((c, i) => (
            <ResourceCard key={`${c.title}-${i}`} href={c.href || "/register"} external={/^https?:\/\//i.test(c.href)} icon={c.icon || "star"} title={c.title} text={c.text || ""} cta={c.cta || "Open"} tone={CARD_TONES[i % CARD_TONES.length]} />
          ))}
        </CardRail>
      ) : (
      <CardRail>
        <ResourceCard href="/practice" icon="history_edu" title="Free PYQs" text="NEET PYQ practice with free questions every day, plus JEE & board papers." cta="Practice PYQs" meta={pyqTotal ? `${fmtCount(pyqTotal)} PYQs in our question bank` : undefined} />
        <ResourceCard href="/study-material" icon="description" title="Free Notes" text="Modules and short notes for every chapter." cta="Read notes" tone="cyan" meta={files(m.MODULE + m.SHORT_NOTES)} />
        <ResourceCard href="/tests" icon="quiz" title="Free Tests" text="Exam-style tests with instant results." cta="Take a test" tone="orange" />
        <ResourceCard href="/dpp" icon="assignment" title="Free DPPs" text="Daily practice problems, chapter by chapter." cta="Solve DPPs" tone="green" />
        {youtubeUrl ? (
          <ResourceCard href={youtubeUrl} external icon="smart_display" title="Free Classes" text="Lectures and revision on our YouTube channel." cta="Watch free" tone="violet" />
        ) : (
          <ResourceCard href="/register" icon="smart_display" title="Free Classes" text="Free lectures and revision sessions." cta="Join free" tone="violet" />
        )}
        <ResourceCard href="/study-material" icon="account_tree" title="Mind Maps" text="Whole chapters on one page for quick revision." cta="View mind maps" tone="cyan" meta={files(m.MIND_MAP)} />
        <ResourceCard href="/study-material" icon="calculate" title="Formula Sheets" text="All key formulas of a chapter, in one sheet." cta="Get formula sheets" tone="navy" meta={files(m.FORMULA_SHEET)} />
        <ResourceCard href="/practice/board-exam" icon="star" title="Board Exam Practice" text="Class 10 & 12 board PYQs and model papers." cta="Practice now" tone="orange" />
      </CardRail>
      )}
    </Section>
  );
}

/** FREE STUDY MATERIAL — one card per material type that exists in the library. */
export const MATERIAL_TYPES = ["MODULE", "SHORT_NOTES", "MIND_MAP", "FORMULA_SHEET", "NCERT_HIGHLIGHTED", "NCERT_EXEMPLAR", "NEET_PYQ", "JEE_PYQ"] as const;

export function StudyMaterialSection({ data, head, types }: { data: PublicHomeData; head?: Head; types?: string[] }) {
  const m = data.materialCounts;
  const cards = [
    { key: "MODULE", icon: "menu_book", title: "Chapter Notes & Modules", text: "Full chapter notes and modules.", n: m.MODULE, tone: "blue" },
    { key: "SHORT_NOTES", icon: "sticky_note_2", title: "Revision Notes", text: "Short notes for last-minute revision.", n: m.SHORT_NOTES, tone: "cyan" },
    { key: "MIND_MAP", icon: "account_tree", title: "Mind Maps", text: "Connect every concept of a chapter.", n: m.MIND_MAP, tone: "violet" },
    { key: "FORMULA_SHEET", icon: "calculate", title: "Formula Sheets", text: "Formulas and key results.", n: m.FORMULA_SHEET, tone: "navy" },
    { key: "NCERT_HIGHLIGHTED", icon: "highlight", title: "NCERT Highlighted", text: "NCERT with the important lines marked.", n: m.NCERT_HIGHLIGHTED, tone: "green" },
    { key: "NCERT_EXEMPLAR", icon: "library_books", title: "NCERT Exemplar", text: "Exemplar problems for deeper practice.", n: m.NCERT_EXEMPLAR, tone: "orange" },
    { key: "NEET_PYQ", icon: "history_edu", title: "NEET Previous Year Papers", text: "Past NEET papers to practise with.", n: m.NEET_PYQ, tone: "green" },
    { key: "JEE_PYQ", icon: "history_edu", title: "JEE Previous Year Papers", text: "Past JEE papers to practise with.", n: m.JEE_PYQ, tone: "blue" },
  ].filter((c) => !types?.length || types.includes(c.key));
  return (
    <Section id="material" tone="tint">
      <SectionHeader
        {...hd(head, { eyebrow: "Free study material", title: "Notes, mind maps & formula sheets", subtitle: "Class 11, 12, NEET and JEE — in Hindi and English." })}
        action={<ButtonLink href="/study-material" variant="secondary">Open study material</ButtonLink>}
      />
      <CardRail>
        {(cards.some((c) => c.n > 0) ? cards.filter((c) => c.n > 0) : cards).map((c) => (
          <ResourceCard key={c.title} href="/study-material" icon={c.icon} title={c.title} text={c.text} cta="Open" tone={c.tone} meta={files(c.n)} />
        ))}
      </CardRail>
    </Section>
  );
}

/** TEST YOURSELF — the free (public) test series. */
export function FreeTestSection({ data, head, seriesIds }: { data: PublicHomeData; head?: Head; seriesIds?: string[] }) {
  const series = seriesIds?.length ? data.freeSeries.filter((s) => seriesIds.includes(s.id)) : data.freeSeries;
  return (
    <Section id="tests">
      <SectionHeader
        {...hd(head, { eyebrow: "Test yourself", title: "Practice like the real exam", subtitle: "Timed tests with NTA-style interface, instant result and analysis." })}
        action={<ButtonLink href="/tests" variant="secondary">View All Free Tests</ButtonLink>}
      />
      {series.length ? (
        <CardRail cols="sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <ResourceCard
              key={s.id}
              href="/tests"
              icon="timer"
              title={s.name}
              text={s.examType ? `${s.examType} test series — free for every student.` : "Free test series for every student."}
              cta="Take Free Test"
              tone="orange"
              meta={[`${s.tests} test${s.tests === 1 ? "" : "s"}`, s.questions ? `${s.questions} questions` : null, s.avgDurationMin ? `${s.avgDurationMin} min each` : null].filter(Boolean).join(" · ")}
            />
          ))}
        </CardRail>
      ) : (
        <CardRail cols="sm:grid-cols-3">
          <ResourceCard href="/tests" icon="biotech" title="NEET Practice Tests" text="Physics, Chemistry and Biology in the NEET pattern." cta="View tests" tone="green" />
          <ResourceCard href="/tests" icon="functions" title="JEE Practice Tests" text="Physics, Chemistry and Maths in the JEE pattern." cta="View tests" tone="blue" />
          <ResourceCard href="/practice/board-exam" icon="school" title="Board Practice" text="Class 10 & 12 board-style questions." cta="Practice" tone="orange" />
        </CardRail>
      )}
    </Section>
  );
}
