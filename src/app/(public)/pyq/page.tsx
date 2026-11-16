import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PublicQuestionCard } from "@/components/pyq/PublicQuestionCard";

export const revalidate = 3600; // 1 hour ISR

export const metadata: Metadata = {
  title: "NEET & JEE PYQ Library – Previous Year Questions with Solutions | Atomic Pathshala",
  description:
    "Practice official NEET UG, JEE Main, and JEE Advanced previous year questions with chapter-wise and year-wise filters. Step-by-step verified solutions and formula derivations.",
  keywords: [
    "NEET PYQ",
    "JEE Main Previous Year Questions",
    "JEE Advanced PYQ",
    "Chapter-wise PYQ",
    "NEET 2024 Question Paper",
    "NEET Physics PYQ",
    "Atomic Pathshala",
  ],
  alternates: {
    canonical: "https://ap.atomicpathshala.in/pyq",
  },
  openGraph: {
    title: "NEET & JEE PYQ Library – Atomic Pathshala",
    description: "Complete chapter-wise and year-wise question bank with verified solutions.",
    url: "https://ap.atomicpathshala.in/pyq",
    type: "website",
  },
};

export default async function PublicPyqHomePage() {
  // Fetch real statistics from database
  const [neetCount, jeeMainCount, jeeAdvCount, recentQuestions] = await Promise.all([
    prisma.pyqOccurrence.count({
      where: {
        verificationStatus: "VERIFIED",
        exam: { canonicalType: "NEET_UG" },
        question: { isPublished: true },
      },
    }),
    prisma.pyqOccurrence.count({
      where: {
        verificationStatus: "VERIFIED",
        exam: { canonicalType: "JEE_MAIN" },
        question: { isPublished: true },
      },
    }),
    prisma.pyqOccurrence.count({
      where: {
        verificationStatus: "VERIFIED",
        exam: { canonicalType: "JEE_ADVANCED" },
        question: { isPublished: true },
      },
    }),
    prisma.question.findMany({
      where: {
        isPublished: true,
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        slug: true,
        questionCode: true,
        subject: true,
        chapter: true,
        topic: true,
        pyqYear: true,
        translations: {
          select: { language: true, statement: true, options: true, correctOptionIds: true },
          take: 1,
        },
        pyqOccurrences: {
          where: { verificationStatus: "VERIFIED" },
          select: {
            year: true,
            questionNumber: true,
            exam: { select: { name: true, slug: true } },
          },
          take: 1,
        },
      },
    }),
  ]);

  const exams = [
    {
      title: "NEET UG",
      slug: "neet",
      tagline: "Medical Entrance Examination",
      description: "Complete year-wise & chapter-wise papers for Physics, Chemistry, and Biology.",
      count: neetCount,
      subjects: ["Physics", "Chemistry", "Biology", "Botany", "Zoology"],
      badgeColor: "bg-blue-600 text-white",
      href: "/pyq/neet",
    },
    {
      title: "JEE Main",
      slug: "jee-main",
      tagline: "Engineering Entrance (Session 1 & 2)",
      description: "Shift-wise and topic-wise questions for Physics, Chemistry, and Mathematics.",
      count: jeeMainCount,
      subjects: ["Physics", "Chemistry", "Mathematics"],
      badgeColor: "bg-amber-600 text-white",
      href: "/pyq/jee-main",
    },
    {
      title: "JEE Advanced",
      slug: "jee-advanced",
      tagline: "IIT Entrance Examination",
      description: "Challenging analytical and multi-correct conceptual questions from Paper 1 & 2.",
      count: jeeAdvCount,
      subjects: ["Physics", "Chemistry", "Mathematics"],
      badgeColor: "bg-purple-600 text-white",
      href: "/pyq/jee-advanced",
    },
  ];

  const featuredChapters = [
    { exam: "neet", subject: "physics", chapter: "kinematics", title: "Kinematics", count: "120+ PYQs" },
    { exam: "neet", subject: "chemistry", chapter: "chemical-bonding", title: "Chemical Bonding", count: "140+ PYQs" },
    { exam: "neet", subject: "biology", chapter: "cell-cycle-and-cell-division", title: "Cell Cycle & Division", count: "90+ PYQs" },
    { exam: "jee-main", subject: "physics", chapter: "rotational-motion", title: "Rotational Motion", count: "110+ PYQs" },
    { exam: "jee-main", subject: "mathematics", chapter: "definite-integrals", title: "Definite Integrals", count: "95+ PYQs" },
    { exam: "jee-main", subject: "chemistry", chapter: "thermodynamics", title: "Thermodynamics", count: "105+ PYQs" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">
          <span className="material-symbols-outlined text-sm">verified</span>
          Official Previous Year Question Engine
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Master NEET & JEE with <span className="text-blue-600">Previous Year Questions</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          Search over 30+ years of official examination questions organized chapter-wise and year-wise. Practice online with instant evaluation and detailed step-by-step solutions.
        </p>

        {/* Global Search Bar */}
        <div className="max-w-2xl mx-auto pt-2">
          <form action="/pyq" method="GET" className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400 text-xl">search</span>
            <input
              type="text"
              name="q"
              placeholder="Search by topic, formula, or question keyword (e.g. Kinematics NEET, Mole Concept)..."
              className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
            <button
              type="submit"
              className="absolute right-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Three Major Exam Cards */}
      <section className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">category</span>
          Browse by Target Examination
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {exams.map((ex) => (
            <Link
              key={ex.slug}
              href={ex.href}
              className="group flex flex-col justify-between p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${ex.badgeColor}`}>
                    {ex.tagline}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {ex.count} questions
                  </span>
                </div>

                <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                  {ex.title} PYQs
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {ex.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {ex.subjects.map((sub) => (
                    <span
                      key={sub}
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition">
                <span>Explore {ex.title} Questions</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured High-Yield Chapters */}
      <section className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">stars</span>
          High-Yield Chapter PYQ Collections
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {featuredChapters.map((fc) => (
            <Link
              key={`${fc.exam}-${fc.chapter}`}
              href={`/pyq/${fc.exam}/${fc.subject}/${fc.chapter}`}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 shadow-sm transition hover:shadow-md"
            >
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {fc.exam.toUpperCase()} · {fc.subject}
              </span>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-1">
                {fc.title}
              </h4>
              <span className="text-[11px] font-bold text-blue-600 mt-2 block">
                {fc.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Approved Questions Preview */}
      {recentQuestions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">new_releases</span>
              Recently Verified PYQs
            </h2>
            <Link href="/pyq/neet" className="text-xs font-bold text-blue-600 hover:underline">
              View all &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentQuestions.map((q) => (
              <PublicQuestionCard key={q.id} question={q} />
            ))}
          </div>
        </section>
      )}

      {/* SEO Content Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          Why Practice Previous Year Questions on Atomic Pathshala?
        </h3>
        <p>
          Previous Year Questions (PYQs) represent the gold standard for NEET UG and JEE examination preparation. Analyzing past trends enables students to understand question patterns, recurring formulas, and the depth of conceptual understanding demanded by NTA (National Testing Agency).
        </p>
        <p>
          Every question in the Atomic Pathshala database is canonical and duplicate-controlled: identical questions that appeared across multiple exam shifts or both NEET and JEE are unified into a single record with complete occurrence tracking. Our step-by-step solutions explain the underlying core NCERT concepts, mathematical derivations, and common student mistakes.
        </p>
      </section>
    </div>
  );
}
