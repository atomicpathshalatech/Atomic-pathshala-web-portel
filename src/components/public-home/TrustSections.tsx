import Image from "next/image";
import Link from "next/link";
import type { PublicHomeData } from "@/lib/public-home";
import { FAQAccordion, type FaqItem } from "@/components/landing/FAQAccordion";
import { ButtonLink, CONTAINER, Icon, Section, SectionHeader, fmtCount } from "./ui";

/** WHY ATOMIC PATHSHALA — Learn → Practice → Test → Improve. */
export function WhyAtomicPathshala() {
  const steps = [
    { icon: "school", title: "Learn", text: "Live classes, recordings and chapter notes." },
    { icon: "edit_note", title: "Practice", text: "PYQs and daily practice problems." },
    { icon: "timer", title: "Test", text: "Exam-pattern tests with instant results." },
    { icon: "trending_up", title: "Improve", text: "Analysis, doubt support and revision." },
  ];
  return (
    <Section id="why" tone="tint">
      <SectionHeader eyebrow="Why Atomic Pathshala" title="One complete learning loop" subtitle="Everything you need, in one place — learn, practise, test and improve." />
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon name={s.icon} className="text-[22px]" />
            </span>
            <p className="mt-3 text-xs font-semibold text-slate-400">Step {i + 1}</p>
            <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** TRUST — real platform numbers only; a number is shown only when it is meaningful. */
export function TrustSection({ metrics }: { metrics: PublicHomeData["metrics"] }) {
  const items = [
    { n: metrics.students, label: "Students learning", min: 100 },
    { n: metrics.questions, label: "Questions in our bank", min: 100 },
    { n: metrics.tests, label: "Tests published", min: 10 },
    { n: metrics.studyFiles, label: "Study material files", min: 20 },
  ].filter((x) => x.n >= x.min);
  const promises = [
    { icon: "translate", text: "Hindi + English medium" },
    { icon: "support_agent", text: "Doubt support with teachers & Atomic Guru" },
    { icon: "devices", text: "Works on mobile, tablet and laptop" },
    { icon: "lock", text: "Your data stays private" },
  ];
  return (
    <Section id="trust" tone="navy">
      <SectionHeader dark eyebrow="Built for students" title="Learning you can rely on" />
      {items.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {items.map((x) => (
            <div key={x.label} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <dt className="text-xs text-white/60">{x.label}</dt>
              <dd className="mt-1 text-2xl font-bold text-white">{fmtCount(x.n)}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {promises.map((p) => (
          <li key={p.text} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4 text-sm text-white/85 ring-1 ring-white/10">
            <Icon name={p.icon} className="text-[22px] text-cyan-300" /> {p.text}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** APP — the installable web app (PWA). */
export function AppPromotion() {
  return (
    <Section id="app">
      <div className="flex flex-col items-start gap-5 rounded-3xl bg-gradient-to-br from-[#0b1736] to-blue-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Icon name="install_mobile" className="text-[28px] text-cyan-300" />
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Study anywhere with the Atomic Pathshala app</h2>
            <p className="mt-1 text-sm text-white/75">Install it on your phone in seconds — classes, notes, DPPs and tests in one tap.</p>
          </div>
        </div>
        <ButtonLink href="/install" variant="light">
          Install the app <Icon name="download" className="text-[18px]" />
        </ButtonLink>
      </div>
    </Section>
  );
}

// Shown only until an admin publishes FAQs in Team → Website → FAQs. Kept to
// facts that are true of the platform today.
const DEFAULT_FAQS: FaqItem[] = [
  { question: "Is Atomic Pathshala free?", answer: "Creating an account is free. Free PYQs, notes, DPPs, tests and free classes are available with your account; full batches are paid." },
  { question: "Which exams can I prepare for?", answer: "NEET, JEE and Class 10, 11 and 12 boards." },
  { question: "Is content available in Hindi and English?", answer: "Yes — classes and study material are available in Hindi and English medium." },
  { question: "Are classes live or recorded?", answer: "Both. Live classes are recorded and added to your batch, so you can watch them again any time." },
  { question: "How do I ask a doubt?", answer: "Ask Atomic Guru for a step-by-step explanation, or post your doubt for a teacher from your dashboard." },
];

export function HomeFAQ({ faqs }: { faqs: FaqItem[] }) {
  return (
    <div id="faq" className="scroll-mt-20">
      <FAQAccordion faqs={faqs} />
    </div>
  );
}

export function resolveFaqs(cms: PublicHomeData["faqs"]): FaqItem[] {
  return cms.length ? cms.map((f) => ({ question: f.question, answer: f.answer })) : DEFAULT_FAQS;
}

const FOOTER_COLS = [
  {
    title: "Learn",
    links: [
      { label: "Courses", href: "/courses" },
      { label: "Study Material", href: "/study-material" },
      { label: "PYQ Practice", href: "/practice" },
      { label: "Board Exam Practice", href: "/practice/board-exam" },
      { label: "DPP", href: "/dpp" },
      { label: "Tests", href: "/tests" },
      { label: "Atomic Guru", href: "/guru" },
    ],
  },
  {
    title: "Atomic Pathshala",
    links: [
      { label: "Faculty", href: "/teachers" },
      { label: "About the Founder", href: "/about-founder" },
      { label: "Careers", href: "/careers/apply" },
      { label: "Install the App", href: "/install" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Create free account", href: "/register" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
    ],
  },
];

export function PublicFooter({ socials }: { socials: PublicHomeData["socials"] }) {
  return (
    <footer className="bg-[#0b1736] text-white/75">
      <div className={`${CONTAINER} grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div>
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Atomic Pathshala home">
            <Image src="/brand/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
            <span className="text-lg font-bold text-white">Atomic Pathshala</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm">Learn better, practise more and score higher — NEET, JEE and Boards in Hindi and English.</p>
          {socials.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center rounded-full bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {FOOTER_COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold text-white">{c.title}</p>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="inline-flex min-h-[32px] items-center text-sm hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className={`${CONTAINER} py-4 text-xs text-white/50`}>© {new Date().getFullYear()} Atomic Pathshala Education. All rights reserved.</p>
      </div>
    </footer>
  );
}
