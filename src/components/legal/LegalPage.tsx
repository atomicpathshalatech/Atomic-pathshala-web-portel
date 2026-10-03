import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

/** Who runs the platform — shown on the Privacy Policy and Terms pages. */
export const LEGAL = {
  company: "Atomic Pathshala Education",
  brand: "Atomic Pathshala",
  address: "Rampur, Uttar Pradesh, India",
  site: "https://ap.atomicpathshala.in",
  email: "atomic.pathshala.info@gmail.com",
  phone: "+91 76685 43654",
  grievanceOfficer: "Firoz Ali",
  grievanceDesignation: "Founder & Director",
  updated: "3 October 2026",
};

export type LegalSection = { id: string; title: string; body: ReactNode };

/** A plain, readable legal page (title, last-updated date, numbered sections). */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Navbar />
      <main className="pt-20 md:pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-800">Home</Link> / {title}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">Last updated: {LEGAL.updated}</p>
        <div className="mt-5 text-sm leading-relaxed text-slate-700 space-y-3">{intro}</div>

        <nav className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Contents</p>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-blue-700 hover:underline">{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-8 scroll-mt-24">
            <h2 className="text-lg font-semibold text-slate-900">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-blue-700 [&_a]:underline">
              {s.body}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}

/** Grievance officer block (Information Technology Rules, 2021). */
export function GrievanceOfficer() {
  return (
    <div className="rounded-xl bg-slate-50 p-4 not-prose">
      <p><b>Grievance Officer:</b> {LEGAL.grievanceOfficer}</p>
      <p><b>Designation:</b> {LEGAL.grievanceDesignation}</p>
      <p><b>Organization:</b> {LEGAL.company} ({LEGAL.brand})</p>
      <p><b>Address:</b> {LEGAL.address}</p>
      <p><b>Email:</b> <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
      <p><b>Phone:</b> <a href={`tel:${LEGAL.phone.replace(/\s/g, "")}`}>{LEGAL.phone}</a></p>
    </div>
  );
}
