import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "IIT-JEE Main & Advanced Preparation — Classes & PYQ Bank | Atomic Pathshala",
  description:
    "Prepare for IIT-JEE Main & Advanced 2026 with Atomic Pathshala. Conceptual depth in Physics, Chemistry & Mathematics, chapter-wise verified PYQs with video derivations, mock tests, and top engineering faculty.",
  alternates: {
    canonical: "https://atomicpathshala.in/jee",
  },
  openGraph: {
    type: "website",
    url: "https://atomicpathshala.in/jee",
    title: "IIT-JEE Main & Advanced Preparation | Atomic Pathshala",
    description: "Crack JEE Main & Advanced with verified chapter-wise PYQ bank, advanced problem-solving techniques, and live classes.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "IIT-JEE Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IIT-JEE Preparation | Atomic Pathshala",
    description: "Crack JEE Main & Advanced with verified chapter-wise PYQs and top faculty.",
    images: ["/brand/logo.png"],
  },
};

export default async function JeeLandingPage() {
  const [teachers, pyqCount] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        OR: [{ department: { in: ["Physics", "Chemistry", "Mathematics"] } }, { targetExams: { has: "JEE Main" } }],
      },
      include: { user: { select: { name: true, photoUrl: true } }, seoProfile: true },
      take: 6,
    }),
    prisma.pyqOccurrence.count({
      where: {
        exam: { canonicalType: { in: ["JEE_MAIN", "JEE_ADVANCED"] } },
        verificationStatus: "VERIFIED",
      },
    }),
  ]);

  const faqs = [
    {
      q: "How does Atomic Pathshala prepare students for JEE Main & Advanced?",
      a: "Our pedagogy emphasizes first-principles conceptual derivations, multi-concept problems, chapter-wise previous year question mastery (2010–2024), and computer-based test (CBT) series with deep performance analytics.",
    },
    {
      q: "Who conducts JEE Chemistry sessions?",
      a: "Senior Chemistry Faculty Firoz Ali mentors JEE aspirants with deep dive into reaction mechanisms, GOC, physical chemistry calculations, and inorganic chemical bonding.",
    },
    {
      q: "Where can I practice JEE Main & Advanced PYQs?",
      a: `Access our free, categorized question bank with over ${pyqCount > 0 ? pyqCount : "400+"} verified JEE questions sorted by exam year, subject, and chapter.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "IIT-JEE (Main + Advanced) Engineering Target Program",
      description: "Structured engineering entrance coaching for JEE Main and Advanced aspirants.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://atomicpathshala.in",
      },
      url: "https://atomicpathshala.in/jee",
      educationalCredentialAwarded: "JEE Advanced Readiness Certificate",
      occupationalCategory: "Engineering Entrance (IIT / NIT / IIIT)",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "JEE Preparation", item: "https://atomicpathshala.in/jee" },
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
            JEE Main &amp; Advanced
          </span>
        </nav>

        <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
              <span>Engineering Target 2026</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              IIT-JEE Main &amp; Advanced: Analytical Rigor &amp; PYQ Mastery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Build rock-solid conceptual foundations in Physics, Chemistry, and Mathematics. Solve past 15-year official JEE questions with multi-step derivations, numerical tricks, and speed strategies.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/pyq/jee-main"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>JEE Main PYQs</span>
              </Link>
              <Link
                href="/pyq/jee-advanced"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">functions</span>
                <span>JEE Advanced PYQs</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Subject Shortcuts */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">science</span>
            <span>JEE Subject Focus</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/chemistry"
              className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 shadow-sm transition-all space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">science</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                JEE Chemistry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thermodynamics, Equilibrium, Organic Synthesis &amp; Coordination Chemistry by Firoz Ali.
              </p>
            </Link>

            <Link
              href="/physics"
              className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 shadow-sm transition-all space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                JEE Physics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rotational Dynamics, Electrostatics, Magnetism &amp; Wave Optics with deep mathematical proofs.
              </p>
            </Link>

            <div className="bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">calculate</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                JEE Mathematics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculus, Coordinate Geometry, Vectors &amp; Probability with high-speed problem solving.
              </p>
            </div>
          </div>
        </section>

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
