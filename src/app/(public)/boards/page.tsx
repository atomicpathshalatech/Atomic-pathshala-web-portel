import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Board Exam Preparation — Class 10 & 12 (CBSE & State Boards) | Atomic Pathshala",
  description:
    "Comprehensive Board Exam Preparation for Class 10 & Class 12 (CBSE, UP Board, Bihar Board & State Boards) in Hindi & English medium. Master NCERT textbooks, sample papers, and model answers with expert educators.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/boards",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/boards",
    title: "Board Exam Preparation | Atomic Pathshala",
    description: "Achieve top board exam percentages with NCERT line-by-line preparation, sample papers, and model answer writing.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Board Exams Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Board Exam Preparation | Atomic Pathshala",
    description: "Achieve top board exam percentages with NCERT mastery and model answer writing.",
    images: ["/brand/logo.png"],
  },
};

export default function BoardsPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Board Exam Mastery Program (Class 10 & 12)",
      description: "Complete syllabus coverage for CBSE and State Board examinations with answer writing practice.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/boards",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Board Preparation", item: "https://ap.atomicpathshala.in/boards" },
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
            Board Preparation
          </span>
        </nav>

        <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-blue-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <span className="material-symbols-outlined text-sm">history_edu</span>
              <span>CBSE &amp; State Boards Hub</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Class 10 &amp; 12 Board Exams: Master NCERT &amp; Step-Marking
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Score maximum marks in board theory papers with step-by-step presentation, NCERT exemplar problem solving, and previous board question solutions in Hindi and English.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/class-10"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">school</span>
                <span>Class 10 Hub</span>
              </Link>
              <Link
                href="/class-12"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">workspace_premium</span>
                <span>Class 12 Hub</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
