import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Class 12 Science (Board + Competitive Mastery) | Atomic Pathshala",
  description:
    "Class 12 Science preparation for Board Exams (CBSE & State Boards), NEET UG, and JEE Main. Master Electrodynamics, Organic Reactions, Genetics, and Calculus with verified study materials.",
  alternates: {
    canonical: "https://atomicpathshala.in/class-12",
  },
  openGraph: {
    type: "website",
    url: "https://atomicpathshala.in/class-12",
    title: "Class 12 Science (Board + Competitive) | Atomic Pathshala",
    description: "Score top marks in Class 12 Boards and secure medical & engineering admissions.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Class 12 Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Class 12 Science | Atomic Pathshala",
    description: "Score top marks in Class 12 Boards and competitive exams.",
    images: ["/brand/logo.png"],
  },
};

export default function Class12Page() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Class 12th Science (Board + Competitive Mastery)",
      description: "Class 12 Board preparation combined with NEET and JEE test series and PYQ mastery.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://atomicpathshala.in",
      },
      url: "https://atomicpathshala.in/class-12",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Class 12", item: "https://atomicpathshala.in/class-12" },
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
            Class 12 Science
          </span>
        </nav>

        <section className="bg-gradient-to-br from-indigo-950 via-slate-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-indigo-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              <span>Class 12 Board &amp; Entrance Track</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Class 12 Science: 95%+ in Boards &amp; Competitive Dominance
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Synchronize your Class 12 CBSE &amp; State Board preparation with NEET/JEE targets. Complete Organic Chemistry, Optics, Genetics, and Calculus with live classes and chapter-wise question solving.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/chemistry"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">science</span>
                <span>Class 12 Chemistry</span>
              </Link>
              <Link
                href="/pyq"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Browse PYQ Bank</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
