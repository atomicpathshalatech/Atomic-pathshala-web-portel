import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Chemistry for NEET & JEE — Organic, Physical & Inorganic | Atomic Pathshala",
  description:
    "Master Chemistry for NEET UG, JEE Main & Board exams with Senior Chemistry Educator Firoz Ali. Concept-first lectures on GOC, reaction mechanisms, physical chemistry formulas, and chapter-wise verified PYQ solutions in Hindi & English medium.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/chemistry",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/chemistry",
    title: "NEET & JEE Chemistry Mastery | Atomic Pathshala",
    description:
      "Comprehensive Chemistry coaching by Firoz Ali (M.Sc Chemistry). Complete Organic, Inorganic & Physical Chemistry for NEET, JEE & Boards.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Chemistry Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEET & JEE Chemistry Mastery | Atomic Pathshala",
    description: "Chemistry lectures, GOC mastery, and verified PYQs by Firoz Ali.",
    images: ["/brand/logo.png"],
  },
};

export default async function ChemistryLandingPage() {
  const [chemistryTeachers, chemQuestionsCount] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        OR: [{ department: "Chemistry" }, { subjects: { has: "Chemistry" } }],
      },
      include: { user: { select: { name: true, photoUrl: true } }, seoProfile: true },
    }),
    prisma.question.count({
      where: {
        isPublished: true,
        subject: { contains: "Chemistry", mode: "insensitive" },
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
    }),
  ]);

  const branches = [
    {
      name: "Organic Chemistry",
      desc: "General Organic Chemistry (GOC-I & GOC-II), IUPAC, Isomerism, Hydrocarbons, Haloalkanes, Alcohols, Carbonyl Compounds & Amines. Master complete reaction mechanisms with arrow pushing techniques.",
      icon: "cyclone",
      color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-500",
    },
    {
      name: "Physical Chemistry",
      desc: "Mole Concept, Atomic Structure, Chemical Thermodynamics, Equilibrium (Chemical & Ionic), Electrochemistry, Chemical Kinetics & Solutions. Step-by-step numerical derivations.",
      icon: "speed",
      color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-500",
    },
    {
      name: "Inorganic Chemistry",
      desc: "Periodic Table trends, Chemical Bonding, Coordination Compounds, p-Block, d & f-Block elements, and Metallurgy. Simplified NCERT memory techniques and exception charts.",
      icon: "hub",
      color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-500",
    },
  ];

  const faqs = [
    {
      q: "Who leads the Chemistry faculty at Atomic Pathshala?",
      a: "Chemistry is headed by Firoz Ali (M.Sc Chemistry, MJPRU Bareilly), Senior Chemistry Educator and Founder of Atomic Pathshala. With over 4+ years of dedicated teaching across premier edtech platforms, he specializes in making organic reaction mechanisms intuitive and physical chemistry formulas effortless.",
    },
    {
      q: "Is Chemistry taught in Hindi Medium or English Medium?",
      a: "Both! We provide comprehensive bilingual (Hinglish/Hindi + English) explanations so students from CBSE, UP Board, Bihar Board, and state boards grasp the deepest concepts easily.",
    },
    {
      q: "Are chapter-wise Chemistry PYQs available for free?",
      a: `Yes, Atomic Pathshala offers ${chemQuestionsCount > 0 ? chemQuestionsCount : "400+"} verified NEET & JEE Chemistry PYQ solutions complete with step-by-step logic and NCERT references.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Chemistry Mastery for NEET & JEE",
      description: "Complete Organic, Inorganic, and Physical Chemistry preparation with verified faculty Firoz Ali.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/chemistry",
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
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Chemistry Hub", item: "https://ap.atomicpathshala.in/chemistry" },
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
            Chemistry Hub
          </span>
        </nav>

        {/* Hero Banner */}
        <section className="bg-gradient-to-br from-amber-950 via-slate-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-amber-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              <span className="material-symbols-outlined text-sm">science</span>
              <span>Complete Chemistry Curriculum</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              NEET &amp; JEE Chemistry: Organic, Physical &amp; Inorganic Mastery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Master the chemical sciences with concept clarity, reaction mechanisms, and high-yield numerical practice. Mentored by Senior Chemistry Educator <strong>Firoz Ali</strong> and the Atomic Pathshala faculty.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/teachers/firoz-ali"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-amber-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span>Firoz Ali Faculty Profile</span>
              </Link>
              <Link
                href="/pyq/neet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Chemistry PYQ Bank</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Chemistry Branches */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">bubble_chart</span>
            <span>Chemistry Disciplines &amp; Syllabus Coverage</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {branches.map((b, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${b.color} border flex items-center justify-center font-bold`}>
                  <span className="material-symbols-outlined text-2xl">{b.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{b.name}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Firoz Ali Spotlight */}
        <section className="bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-purple-900/20 rounded-3xl p-6 sm:p-8 border border-blue-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600 text-white font-black text-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-md border-2 border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://pub-dfdc1ecb5e9b4183a8dc9ac9cc695380.r2.dev/questions/q_mue54wqk_n6dp5.png"
                alt="Firoz Ali - Senior Chemistry Faculty"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-400/30">
                <span className="material-symbols-outlined text-xs">verified</span>
                <span>Senior Chemistry Educator &amp; Founder</span>
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Firoz Ali</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                M.Sc in Chemistry from MJPRU Bareilly with 4+ years of dedicated experience mentoring NEET &amp; JEE aspirants. Renowned for General Organic Chemistry (GOC) lecture series and simplified reaction mechanism models.
              </p>
              <div className="pt-2">
                <Link
                  href="/teachers/firoz-ali"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>View Firoz Ali&apos;s Full Teaching Profile &amp; Lectures</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">quiz</span>
            <span>Chemistry Preparation FAQs</span>
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
