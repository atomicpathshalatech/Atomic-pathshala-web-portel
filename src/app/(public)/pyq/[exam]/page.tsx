import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";
import { buildChapterSlug } from "@/lib/pyq/slug-generator";

export const revalidate = 3600;

interface Props {
  params: { exam: string };
}

function resolveCanonicalType(slug: string): string {
  const norm = slug.toLowerCase();
  if (norm === "neet" || norm === "neet-ug") return "NEET_UG";
  if (norm === "jee-main" || norm === "jee-mains" || norm === "jee") return "JEE_MAIN";
  if (norm === "jee-advanced" || norm === "jee-adv") return "JEE_ADVANCED";
  return norm.toUpperCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cType = resolveCanonicalType(params.exam);
  const exam = await prisma.pyqExam.findFirst({
    where: { OR: [{ canonicalType: cType }, { slug: params.exam }] },
  });

  const titleName = exam?.name || params.exam.toUpperCase();
  return {
    title: `${titleName} PYQ – Previous Year Questions Chapter-Wise & Year-Wise | Atomic Pathshala`,
    description: `Complete ${titleName} previous year questions library with official answer keys, chapter-wise questions, and step-by-step solutions after login.`,
    alternates: {
      canonical: `https://ap.atomicpathshala.in/pyq/${params.exam}`,
    },
    openGraph: {
      title: `${titleName} Previous Year Questions | Atomic Pathshala`,
      description: `Practice ${titleName} PYQs chapter-wise and year-wise with verified solutions.`,
      url: `https://ap.atomicpathshala.in/pyq/${params.exam}`,
    },
  };
}

export default async function ExamPublicPage({ params }: Props) {
  const cType = resolveCanonicalType(params.exam);
  const exam = await prisma.pyqExam.findFirst({
    where: { OR: [{ canonicalType: cType }, { slug: params.exam }], isActive: true },
  });

  if (!exam) notFound();

  // Determine subjects for this exam
  const subjects =
    exam.canonicalType === "NEET_UG"
      ? ["Physics", "Chemistry", "Biology"]
      : ["Physics", "Chemistry", "Mathematics"];

  // Fetch years with count for this exam
  const [yearOccurrences, chapterGroupings] = await Promise.all([
    prisma.pyqOccurrence.groupBy({
      by: ["year"],
      where: {
        examId: exam.id,
        verificationStatus: "VERIFIED",
        year: { not: null },
      },
      _count: { id: true },
      orderBy: { year: "desc" },
    }),
    prisma.question.groupBy({
      by: ["subject", "chapter"],
      where: {
        isPublished: true,
        pyqOccurrences: {
          some: { examId: exam.id, verificationStatus: "VERIFIED" },
        },
      },
      _count: { id: true },
    }),
  ]);

  const years = yearOccurrences.map((y) => ({
    year: y.year!,
    count: y._count.id,
  }));

  const chapterCountMap = new Map<string, number>();
  for (const c of chapterGroupings) {
    if (c.chapter) {
      chapterCountMap.set(`${c.subject.toLowerCase()}::${c.chapter.toLowerCase().trim()}`, c._count.id);
    }
  }

  return (
    <div className="space-y-10">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link href="/pyq" className="hover:text-blue-600">
          PYQ Library
        </Link>
        <span>&rsaquo;</span>
        <span className="text-slate-800 dark:text-slate-200">{exam.name}</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase px-3 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {exam.name} PYQ Portal
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {yearOccurrences.reduce((s, y) => s + y._count.id, 0)} Verified Questions
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
          {exam.name} Previous Year Questions
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
          Master the {exam.name} examination with authentic, canonical questions from official exam papers. Browse year-by-year papers or focus on specific subject chapters to strengthen high-yield topics.
        </p>
      </div>

      {/* Year-Wise Papers Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">calendar_month</span>
            Year-Wise Question Papers
          </h2>
          <span className="text-xs text-slate-400 font-mono">{years.length} Years Available</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {years.map((y) => (
            <Link
              key={y.year}
              href={`/pyq/${params.exam}/${y.year}`}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 shadow-sm transition hover:shadow-md text-center"
            >
              <span className="text-lg font-black font-mono text-slate-900 dark:text-white block">
                {y.year}
              </span>
              <span className="text-[11px] font-bold text-blue-600 block mt-1">
                {y.count} Questions
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Chapter-Wise Syllabus Matrix */}
      <section className="space-y-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">menu_book</span>
          Chapter-Wise Question Collections
        </h2>

        <div className="space-y-8">
          {subjects.map((sub) => {
            const masterChapters = getMasterNcertChapters(normalizeSubjectName(sub));

            return (
              <div
                key={sub}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-lg">science</span>
                    {sub} Chapters
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">
                    Class 11 & Class 12
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {masterChapters.map((ch) => {
                    const chSlug = buildChapterSlug(ch.title);
                    const cleanTitle = ch.title.toLowerCase().trim();
                    const count =
                      chapterCountMap.get(`${sub.toLowerCase()}::${cleanTitle}`) ??
                      chapterCountMap.get(`${sub.toLowerCase()}::${ch.displayTitle.toLowerCase().trim()}`) ??
                      0;

                    return (
                      <Link
                        key={ch.id}
                        href={`/pyq/${params.exam}/${sub.toLowerCase()}/${chSlug}`}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-slate-400 font-mono block">
                            C{ch.classNumber} · Ch {ch.chapterNumber}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                            {ch.title}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded-lg shrink-0 ${
                            count > 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold"
                              : "text-slate-400"
                          }`}
                        >
                          {count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
