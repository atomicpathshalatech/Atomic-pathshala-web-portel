import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Class 10 Board & Foundation Preparation — Science & Maths | Atomic Pathshala",
  description:
    "Prepare for Class 10 Board Examinations and NTSE/Olympiad Foundation at Atomic Pathshala. Concept clarity in Physics, Chemistry, Biology & Mathematics with chapter-wise notes and practice questions.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/class-10",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/class-10",
    title: "Class 10 Board & Foundation Mastery | Atomic Pathshala",
    description: "Score 95%+ in Class 10 Boards and build a strong foundation for NEET/JEE.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Class 10 Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Class 10 Board & Foundation | Atomic Pathshala",
    description: "Score 95%+ in Class 10 Boards with top educators.",
    images: ["/brand/logo.png"],
  },
};

export default function Class10Page() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Class 10 Board & Foundation Program",
      description: "Class 10 CBSE & State Board preparation with Olympiad and NTSE foundation.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/class-10",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Class 10", item: "https://ap.atomicpathshala.in/class-10" },
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
            Class 10 Hub
          </span>
        </nav>

        <section className="bg-gradient-to-br from-purple-950 via-slate-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-purple-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-400/30">
              <span className="material-symbols-outlined text-sm">school</span>
              <span>Class 10 Board Excellence &amp; Foundation</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Class 10 Boards &amp; Foundation: Concept Clarity for 95%+
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Strengthen Science and Mathematics with chapter-by-chapter mastery. Lay the strongest groundwork for future NEET &amp; JEE success in Hindi and English.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/chemistry"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">science</span>
                <span>Class 10 Science</span>
              </Link>
              <Link
                href="/teachers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <span>Meet Faculty</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
