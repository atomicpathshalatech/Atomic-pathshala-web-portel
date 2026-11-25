import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Class 11 Science (NEET / JEE / CBSE) — Online Classes & Notes | Atomic Pathshala",
  description:
    "Class 11 Science preparation for NEET, JEE & CBSE. Master Mechanics, Physical & Organic Chemistry (GOC) by Firoz Ali, and Cell Biology with chapter-wise notes and PYQs.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/class-11",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/class-11",
    title: "Class 11 Science (NEET / JEE) | Atomic Pathshala",
    description: "Build an unbeatable Class 11 foundation for NEET & JEE with expert faculty.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Class 11 Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Class 11 Science | Atomic Pathshala",
    description: "Build an unbeatable Class 11 foundation for NEET & JEE.",
    images: ["/brand/logo.png"],
  },
};

export default function Class11Page() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Class 11th Science (NEET / JEE / CBSE)",
      description: "Class 11 foundation coaching bridging Board exams with competitive medical & engineering entrance preparation.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/class-11",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Class 11", item: "https://ap.atomicpathshala.in/class-11" },
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
            Class 11 Science
          </span>
        </nav>

        <section className="bg-gradient-to-br from-blue-950 via-indigo-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-blue-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              <span>Class 11 Foundation &amp; Competitive Track</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Class 11 Science: NEET &amp; JEE Cornerstone Mastery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Don&apos;t let Class 11 backlogs ruin your NEET or JEE dream. Master General Organic Chemistry (GOC) with Firoz Ali, Newton&apos;s Laws in Physics, and NCERT Botany &amp; Zoology.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/chemistry"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">science</span>
                <span>Class 11 Chemistry</span>
              </Link>
              <Link
                href="/pyq/neet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Class 11 PYQs</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
