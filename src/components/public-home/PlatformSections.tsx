import Link from "next/link";
import type { PublicHomeData } from "@/lib/public-home";
import { ButtonLink, CardRail, Icon, Section, SectionHeader, hd, inr, type Head } from "./ui";

const IST = "Asia/Kolkata";
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });

/** WHAT'S HAPPENING TODAY — today's real schedule across batches (titles and times only). */
export function TodaySection({ today, head }: { today: PublicHomeData["today"]; head?: Head }) {
  const empty = !today.classes.length && !today.dpps && !today.tests;
  return (
    <Section id="today" tone="tint">
      <SectionHeader {...hd(head, { eyebrow: "Today", title: "What's happening today", subtitle: "Live classes, DPPs and tests scheduled for today across our batches." })} />
      {empty ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Nothing is scheduled for today yet. New classes, DPPs and tests show up here as soon as they are scheduled.</p>
          <ButtonLink href="/register" variant="secondary">Get schedule alerts</ButtonLink>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Today&apos;s live classes
            </p>
            {today.classes.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {today.classes.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className="w-20 shrink-0 whitespace-nowrap text-sm font-semibold text-blue-700">{istTime(c.startsAt)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.title}</span>
                      <span className="block truncate text-xs text-slate-500">{[c.subject, c.batch].filter(Boolean).join(" · ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No live class today.</p>
            )}
            <Link href="/live-class" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-blue-700">
              Join from your batch <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Link href="/dpp" className="rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-blue-200">
              <Icon name="assignment" className="text-[22px] text-emerald-600" />
              <span className="mt-2 block text-sm font-semibold text-slate-900">Today&apos;s DPP</span>
              <span className="block text-xs text-slate-500">{today.dpps ? `${today.dpps} scheduled` : "None scheduled"}</span>
            </Link>
            <Link href="/tests" className="rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-blue-200">
              <Icon name="quiz" className="text-[22px] text-orange-600" />
              <span className="mt-2 block text-sm font-semibold text-slate-900">Today&apos;s Test</span>
              <span className="block text-xs text-slate-500">{today.tests ? `${today.tests} opening today` : "None today"}</span>
            </Link>
          </div>
        </div>
      )}
    </Section>
  );
}

/** LEARN WITH ATOMIC PATHSHALA — active / upcoming batches from the database. */
export function CourseSection({ batches, head, showPrice = true }: { batches: PublicHomeData["batches"]; head?: Head; showPrice?: boolean }) {
  return (
    <Section id="courses">
      <SectionHeader
        {...hd(head, { eyebrow: "Courses", title: "Learn with Atomic Pathshala", subtitle: "Structured batches with live classes, recordings, DPPs, tests and doubt support." })}
        action={<ButtonLink href="/courses" variant="secondary">View All Courses</ButtonLink>}
      />
      {batches.length ? (
        <CardRail cols="sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <article key={b.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {b.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote batch banner (CMS)
                <img src={b.thumbnailUrl} alt={`${b.name} banner`} loading="lazy" decoding="async" width={640} height={360} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[#0b1736] to-blue-700 px-4 text-center text-lg font-bold text-white">{b.name}</div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  {b.exam && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{b.exam}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600"}`}>
                    {b.status === "ACTIVE" ? "Running" : "Upcoming"}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">{b.name}</h3>
                {b.faculty.length > 0 && <p className="mt-1 text-xs text-slate-500">Faculty: {b.faculty.slice(0, 4).join(", ")}</p>}
                {b.startDate && <p className="mt-0.5 text-xs text-slate-500">{b.status === "ACTIVE" ? "Started" : "Starts"} {istDate(b.startDate)}</p>}
                <ul className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-600">
                  <li className="flex items-center gap-1"><Icon name="live_tv" className="text-[15px] text-blue-600" /> Live classes</li>
                  <li className="flex items-center gap-1"><Icon name="replay" className="text-[15px] text-blue-600" /> Recordings</li>
                  <li className="flex items-center gap-1"><Icon name="assignment" className="text-[15px] text-blue-600" /> DPPs & tests</li>
                  <li className="flex items-center gap-1"><Icon name="help" className="text-[15px] text-blue-600" /> Doubt support</li>
                </ul>
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  {showPrice && b.price != null && b.price > 0 ? (
                    <p className="text-lg font-bold text-slate-900">
                      {inr(b.price)}
                      {b.originalPrice && b.originalPrice > b.price ? <span className="ml-1.5 text-xs font-medium text-slate-400 line-through">{inr(b.originalPrice)}</span> : null}
                    </p>
                  ) : (
                    <span />
                  )}
                  <ButtonLink href={`/courses/${b.id}`} className="!min-h-[40px] shrink-0 whitespace-nowrap !px-4">View Details</ButtonLink>
                </div>
              </div>
            </article>
          ))}
        </CardRail>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">New batches will be announced here soon.</p>
      )}
    </Section>
  );
}

/** STUCK ON A QUESTION? — Atomic Guru as a supporting tool. */
export function AtomicGuruSection({ head, ctaText, ctaUrl }: { head?: Head; ctaText?: string; ctaUrl?: string } = {}) {
  const h = hd(head, { eyebrow: "Doubt support", title: "Stuck on a question?", subtitle: "Ask Atomic Guru — get a step-by-step explanation any time. Free questions every day with your account." });
  const steps = [
    { icon: "help", title: "Your question", text: "Type it or upload a photo of the question." },
    { icon: "psychology", title: "Atomic Guru", text: "Understands the concept behind it." },
    { icon: "format_list_numbered", title: "Step-by-step", text: "A clear explanation you can follow." },
  ];
  return (
    <Section id="guru">
      <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 p-6 sm:p-10 lg:grid-cols-2">
        <div>
          {h.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">{h.eyebrow}</p>}
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{h.title}</h2>
          <p className="mt-2 text-base text-slate-600">{h.subtitle}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={ctaUrl || "/guru"}>{ctaText || "Try Atomic Guru"} <Icon name="arrow_forward" className="text-[18px]" /></ButtonLink>
            <ButtonLink href="/doubts" variant="secondary">Ask a teacher</ButtonLink>
          </div>
        </div>
        <ol className="grid gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Icon name={s.icon} className="text-[22px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{i + 1}. {s.title}</span>
                <span className="block text-xs text-slate-500">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/** LEARN FROM EXPERIENCED FACULTY — public teacher profiles. */
export function FacultySection({ faculty, head }: { faculty: PublicHomeData["faculty"]; head?: Head }) {
  if (!faculty.length) return null;
  return (
    <Section id="faculty" tone="tint">
      <SectionHeader {...hd(head, { eyebrow: "Faculty", title: "Learn from experienced faculty" })} action={<ButtonLink href="/teachers" variant="secondary">Meet all faculty</ButtonLink>} />
      <CardRail>
        {faculty.map((f) => (
          <Link key={f.slug} href={`/teachers/${f.slug}`} className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {f.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote profile photo
              <img src={f.photoUrl} alt={f.name} loading="lazy" decoding="async" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">{f.name.charAt(0)}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-slate-900 group-hover:text-blue-700">{f.name}</span>
              {f.subjects.length > 0 && <span className="block truncate text-xs text-slate-500">{f.subjects.join(", ")}</span>}
              <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700">View profile <Icon name="arrow_forward" className="text-[14px]" /></span>
            </span>
          </Link>
        ))}
      </CardRail>
    </Section>
  );
}

/** LEARN FREE ON YOUTUBE — links to the channel set in Team → Website → Footer. */
export function YouTubeSection({ youtubeUrl, head, chips, ctaText }: { youtubeUrl: string | null; head?: Head; chips?: string[]; ctaText?: string }) {
  if (!youtubeUrl) return null;
  const kinds = chips?.length ? chips : ["Latest lectures", "One-shot revision", "PYQ series", "Revision classes", "Live classes"];
  const h = hd(head, { title: "Learn free on YouTube" });
  return (
    <Section id="youtube">
      <div className="flex flex-col items-start gap-5 rounded-3xl border border-slate-200/80 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <svg viewBox="0 0 28 20" width="48" height="34" aria-hidden="true" className="shrink-0">
            <path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5c.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9Z" />
            <path fill="#FFFFFF" d="M11.2 14.3 18.5 10l-7.3-4.3v8.6Z" />
          </svg>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{h.title}</h2>
            {h.subtitle && <p className="mt-1 text-sm text-slate-600">{h.subtitle}</p>}
            <ul className="mt-2 flex flex-wrap gap-2">
              {kinds.map((k) => (
                <li key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{k}</li>
              ))}
            </ul>
          </div>
        </div>
        <ButtonLink href={youtubeUrl} external>
          {ctaText || "Visit Atomic Pathshala YouTube"}
        </ButtonLink>
      </div>
    </Section>
  );
}
