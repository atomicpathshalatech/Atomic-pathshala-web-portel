import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "NEET Biology — Botany & Zoology NCERT Mastery | Atomic Pathshala",
  description:
    "Master NEET Biology (Botany & Zoology) with NCERT line-by-line coverage, high-yield diagrams, memory retention charts, and chapter-wise verified PYQs at Atomic Pathshala in Hindi and English medium.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/biology",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/biology",
    title: "NEET Biology Mastery | Atomic Pathshala",
    description: "Complete NCERT line-by-line Botany & Zoology mastery for NEET UG with verified PYQ bank.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Biology Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEET Biology Mastery | Atomic Pathshala",
    description: "NCERT line-by-line Botany & Zoology mastery for NEET UG.",
    images: ["/brand/logo.png"],
  },
};

export default async function BiologyLandingPage() {
  const [bioTeachers, bioQuestionsCount] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        OR: [{ department: "Biology" }, { subjects: { has: "Biology" } }],
      },
      include: { user: { select: { name: true, photoUrl: true } }, seoProfile: true },
    }),
    prisma.question.count({
      where: {
        isPublished: true,
        subject: { in: ["Biology", "Botany", "Zoology"] },
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
    }),
  ]);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "NEET Biology (Botany & Zoology) Mastery",
      description: "Complete NCERT line-by-line Botany and Zoology preparation for NEET medical aspirants.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/biology",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Biology Hub", item: "https://ap.atomicpathshala.in/biology" },
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
            Biology Hub
          </span>
        </nav>

        <section className="bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-emerald-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <span className="material-symbols-outlined text-sm">psychology</span>
              <span>Botany &amp; Zoology NCERT Intensive</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              NEET Biology: 360/360 Target with NCERT Line-by-Line Mastery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Master every NCERT diagram, table, and line with concept clarity. Solve {bioQuestionsCount > 0 ? bioQuestionsCount : "400+"} verified NEET Biology previous year questions in Hindi and English.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/pyq/neet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Biology PYQ Bank</span>
              </Link>
              <Link
                href="/teachers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <span>Biology Faculty</span>
              </Link>
            </div>
          </div>
        </section>

        {bioTeachers.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">school</span>
              <span>Biology Educators</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {bioTeachers.map((t) => {
                const slug = t.seoProfile?.slug || t.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/teachers/${slug}`}
                    className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 shadow-sm transition-all flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {t.user.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.user.photoUrl} alt={t.user.name} className="w-full h-full object-cover" />
                      ) : (
                        (t.user.name[0] || "B").toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {t.user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Biology Faculty</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
