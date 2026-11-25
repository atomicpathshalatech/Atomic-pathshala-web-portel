import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "NEET & JEE Modules, Chapter Notes & DPPs | Atomic Pathshala",
  description:
    "Explore Atomic Pathshala's curriculum modules, chapter notes, formula sheets, Daily Practice Problems (DPP), and verified PYQ books for NEET UG, JEE Main, and Class 11-12 in Hindi & English medium.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/modules",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/modules",
    title: "Educational Modules & Study Material | Atomic Pathshala",
    description: "Chapter-wise notes, formula sheets, DPPs and practice modules for NEET & JEE.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Modules Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Educational Modules & Study Material | Atomic Pathshala",
    description: "Chapter-wise notes, formula sheets, DPPs and practice modules.",
    images: ["/brand/logo.png"],
  },
};

export default function ModulesPage() {
  const moduleCategories = [
    {
      title: "Chemistry Study Modules",
      exam: "NEET & JEE",
      desc: "General Organic Chemistry (GOC) reaction mechanism notes, Physical Chemistry formula sheets & derivations, and Inorganic Periodic charts curated by Firoz Ali.",
      icon: "science",
      href: "/chemistry",
    },
    {
      title: "Physics Concept Books",
      exam: "NEET & JEE",
      desc: "Formula compendium, Mechanics free-body diagrams, Electrodynamics circuit analysis, and Optics derivations with step-by-step proofs.",
      icon: "bolt",
      href: "/physics",
    },
    {
      title: "Biology NCERT Highlights",
      exam: "NEET UG",
      desc: "Line-by-line NCERT extract notes for Botany & Zoology with colored morphological diagrams, cycle flowcharts, and high-yield summary tables.",
      icon: "psychology",
      href: "/biology",
    },
    {
      title: "Chapter-Wise PYQ Books",
      exam: "NEET, JEE & Boards",
      desc: "Over 8,000+ categorized questions with 980+ verified official past paper solutions spanning 2000 to 2024 with key concepts and hints.",
      icon: "quiz",
      href: "/pyq",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Atomic Pathshala Study Modules & Educational Resources",
      itemListElement: moduleCategories.map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: m.title,
        description: m.desc,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Modules & Study Material", item: "https://ap.atomicpathshala.in/modules" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            Modules &amp; Study Material
          </span>
        </nav>

        <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-indigo-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <span className="material-symbols-outlined text-sm">library_books</span>
              <span>Curriculum &amp; Resource Catalog</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              NEET &amp; JEE Modules, Revision Notes &amp; DPP Worksheets
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Explore our structured academic study materials crafted by expert educators. Verified chapter summaries, formula derivations, and problem sets available across Hindi and English mediums.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/pyq"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Open PYQ Library</span>
              </Link>
              <Link
                href="/teachers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <span>Faculty Authors</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {moduleCategories.map((m, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">{m.icon}</span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {m.exam}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{m.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <Link
                  href={m.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>Explore Curriculum Details</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </section>

        <section className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">lock</span>
          <p>
            <strong>Note for Enrolled Students:</strong> Full downloadable PDF modules, printable exercise booklets, and batch-exclusive DPP question keys are protected and accessible directly via the Student Portal upon batch enrollment. Public previews demonstrate syllabus coverage and educational alignment.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
