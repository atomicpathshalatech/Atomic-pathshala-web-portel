import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "NEET UG 2026 Preparation — Target Medical Batch & PYQ Solutions | Atomic Pathshala",
  description:
    "Ace NEET UG with Atomic Pathshala's Selection Pro Batch. Learn Physics, Chemistry & Biology with expert doctors & faculties, chapter-wise verified PYQs (2000–2024), live classes, and AI test analytics in Hindi & English medium.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/neet",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/neet",
    title: "NEET UG 2026 Preparation | Atomic Pathshala",
    description:
      "Target NEET UG with concept clarity, chapter-wise PYQ bank, mock test series, and mentorship by top educators including Senior Chemistry Faculty Firoz Ali.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "NEET UG Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEET UG 2026 Preparation | Atomic Pathshala",
    description: "Target NEET UG with chapter-wise PYQ bank, mock test series, and top faculty mentorship.",
    images: ["/brand/logo.png"],
  },
};

export default async function NeetLandingPage() {
  const [course, batches, teachers, pyqCount] = await Promise.all([
    prisma.course.findFirst({
      where: { slug: "neet-ug-2026" },
      include: { subjects: true },
    }),
    prisma.batch.findMany({
      where: { targetExam: "NEET", status: "ACTIVE" },
      select: { id: true, name: true, code: true, description: true, thumbnailUrl: true },
    }),
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        OR: [{ department: { in: ["Chemistry", "Physics", "Biology", "NEET"] } }, { targetExams: { has: "NEET" } }],
      },
      include: { user: { select: { name: true, photoUrl: true } }, seoProfile: true },
      take: 6,
    }),
    prisma.pyqOccurrence.count({
      where: {
        exam: { canonicalType: "NEET_UG" },
        verificationStatus: "VERIFIED",
      },
    }),
  ]);

  const faqs = [
    {
      q: "What is covered in Atomic Pathshala's NEET program?",
      a: "Our NEET program covers complete Physics, Chemistry (Physical, Organic, Inorganic), Botany, and Zoology strictly based on the latest NTA NEET syllabus. It includes live interactive lectures, chapter-wise verified PYQs, DPPs with video solutions, and full-syllabus mock tests.",
    },
    {
      q: "Is NEET coaching available in Hindi medium?",
      a: "Yes! Atomic Pathshala offers comprehensive bilingual (Hinglish/Hindi + English) coaching for NEET aspirants with Hindi medium study materials, formula sheets, and chapter-wise question explanations.",
    },
    {
      q: "Who teaches Chemistry for NEET at Atomic Pathshala?",
      a: "Chemistry is mentored by Firoz Ali (M.Sc Chemistry, MJPRU Bareilly), Senior Chemistry Faculty & Founder of Atomic Pathshala, specializing in General Organic Chemistry (GOC), reaction mechanisms, and physical chemistry problem solving.",
    },
    {
      q: "How many NEET PYQs are available on the platform?",
      a: `Atomic Pathshala provides over ${pyqCount > 0 ? pyqCount : "900+"} verified NEET previous year questions with step-by-step solutions, key concepts, and difficulty tags.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "NEET UG Medical Target Program",
      description: "Comprehensive medical entrance exam preparation with live lectures, chapter-wise PYQs, and doubt clearing.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/neet",
      educationalCredentialAwarded: "NEET Preparation Certificate",
      occupationalCategory: "Medical Entrance (MBBS / BDS / AYUSH)",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "NEET UG", item: "https://ap.atomicpathshala.in/neet" },
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
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            NEET UG Preparation
          </span>
        </nav>

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <span className="material-symbols-outlined text-sm">medical_services</span>
              <span>Target Medical Batch 2026</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              NEET UG Preparation: Concept Clarity &amp; Selection Mastery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Master Physics, Chemistry, and Biology with structured live lectures, chapter-wise verified PYQ bank (2000–2024), NCERT line-by-line coverage, and personalized mentorship in Hindi and English medium.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/pyq/neet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Practice NEET PYQs</span>
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

        {/* Active Batches Section */}
        {batches.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">local_fire_department</span>
                <span>Active NEET Batches</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.map((b) => (
                <div
                  key={b.id}
                  className="bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      {b.code}
                    </span>
                    <span className="text-xs text-slate-500">Live + Recordings</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{b.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                    {b.description || "Comprehensive syllabus coverage, test series, DPPs and live doubt clearance."}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subject Breakdown & PYQ Shortcuts */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">auto_stories</span>
            <span>NEET Subjects &amp; Previous Year Questions</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/chemistry"
              className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 shadow-sm transition-all space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">science</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                NEET Chemistry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organic, Physical &amp; Inorganic Chemistry mentored by Firoz Ali. Chapter-wise reaction mechanisms &amp; formula sheets.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span>Explore Chemistry</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </div>
            </Link>

            <Link
              href="/physics"
              className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 shadow-sm transition-all space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                NEET Physics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mechanics, Electrodynamics &amp; Optics. Concept derivations, short-trick formulas &amp; 20-year PYQ solutions.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span>Explore Physics</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </div>
            </Link>

            <Link
              href="/biology"
              className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 shadow-sm transition-all space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">psychology</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                NEET Biology
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Botany &amp; Zoology with NCERT line-by-line questions, high-yield diagrams, and memory retention techniques.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span>Explore Biology</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Featured NEET Faculty */}
        {teachers.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">school</span>
                <span>Verified NEET Faculty</span>
              </h2>
              <Link href="/teachers" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                View All Educators →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {teachers.map((t) => {
                const slug = t.seoProfile?.slug || t.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || t.id;
                const subject = t.subjects.length > 0 ? t.subjects.join(", ") : t.department;
                return (
                  <Link
                    key={t.id}
                    href={`/teachers/${slug}`}
                    className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 shadow-sm transition-all flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {t.user.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.user.photoUrl} alt={t.user.name} className="w-full h-full object-cover" />
                      ) : (
                        (t.user.name[0] || "T").toUpperCase()
                      )}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                        {t.user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{subject}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* FAQs */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">quiz</span>
            <span>Frequently Asked Questions</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((f, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-sm"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{f.q}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
