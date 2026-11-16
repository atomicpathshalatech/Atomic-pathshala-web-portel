import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";
import { buildChapterSlug } from "@/lib/pyq/slug-generator";
import { PublicQuestionCard } from "@/components/pyq/PublicQuestionCard";

export const revalidate = 3600;

interface Props {
  params: { exam: string; slug: string[] };
  searchParams: { session?: string; shift?: string; year?: string; topic?: string };
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
  const examTitle = exam?.name || params.exam.toUpperCase();
  const slugParts = params.slug || [];

  // Case 1: Year Paper (/pyq/[exam]/2024)
  if (slugParts.length === 1 && /^\d{4}$/.test(slugParts[0])) {
    const year = slugParts[0];
    return {
      title: `${examTitle} ${year} Question Paper with Solutions | Atomic Pathshala`,
      description: `Practice official ${examTitle} ${year} questions with verified options and step-by-step solutions after login.`,
      alternates: { canonical: `https://ap.atomicpathshala.in/pyq/${params.exam}/${year}` },
    };
  }

  // Case 2: Subject Hub (/pyq/[exam]/physics)
  if (slugParts.length === 1) {
    const subject = slugParts[0].charAt(0).toUpperCase() + slugParts[0].slice(1);
    return {
      title: `${examTitle} ${subject} PYQ – Previous Year Questions | Atomic Pathshala`,
      description: `Practice all ${examTitle} ${subject} previous year questions chapter-wise with detailed solutions.`,
      alternates: { canonical: `https://ap.atomicpathshala.in/pyq/${params.exam}/${slugParts[0]}` },
    };
  }

  // Case 3: Chapter Page (/pyq/[exam]/physics/kinematics)
  const subject = slugParts[0].charAt(0).toUpperCase() + slugParts[0].slice(1);
  const chapterName = slugParts[1].replace(/-/g, " ");
  const titleChapter = chapterName.charAt(0).toUpperCase() + chapterName.slice(1);
  return {
    title: `${titleChapter} ${examTitle} PYQ – Previous Year Questions | Atomic Pathshala`,
    description: `Practice ${titleChapter} previous year questions for ${examTitle} ${subject} with year-wise distribution and step-by-step solutions after login.`,
    alternates: { canonical: `https://ap.atomicpathshala.in/pyq/${params.exam}/${slugParts[0]}/${slugParts[1]}` },
  };
}

export default async function DynamicPyqRouter({ params, searchParams }: Props) {
  const cType = resolveCanonicalType(params.exam);
  const exam = await prisma.pyqExam.findFirst({
    where: { OR: [{ canonicalType: cType }, { slug: params.exam }], isActive: true },
  });

  if (!exam) notFound();

  const session = await getServerSession(authOptions);
  const isAuthorized = Boolean(session?.user?.id);
  const slugParts = params.slug || [];

  // ---------------------------------------------------------------------------
  // 1. YEAR PAPER VIEW (/pyq/[exam]/2024)
  // ---------------------------------------------------------------------------
  if (slugParts.length === 1 && /^\d{4}$/.test(slugParts[0])) {
    const yearNum = parseInt(slugParts[0], 10);
    const occurrenceWhere: any = {
      examId: exam.id,
      year: yearNum,
      verificationStatus: "VERIFIED",
      question: { isPublished: true },
      ...(searchParams.session ? { session: searchParams.session } : {}),
      ...(searchParams.shift ? { shift: searchParams.shift } : {}),
    };

    const [totalQuestions, occurrences] = await Promise.all([
      prisma.pyqOccurrence.count({ where: occurrenceWhere }),
      prisma.pyqOccurrence.findMany({
        where: occurrenceWhere,
        orderBy: [{ questionNumber: "asc" }, { createdAt: "asc" }],
        take: 100,
        include: {
          question: {
            select: {
              id: true,
              slug: true,
              questionCode: true,
              type: true,
              difficulty: true,
              subject: true,
              chapter: true,
              topic: true,
              imageUrl: true,
              pyqYear: true,
              solution: isAuthorized,
              translations: {
                select: {
                  language: true,
                  statement: true,
                  options: true,
                  correctOptionIds: true,
                  solution: isAuthorized,
                },
              },
            },
          },
        },
      }),
    ]);

    return (
      <div className="space-y-8">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/pyq" className="hover:text-blue-600">PYQ Library</Link>
          <span>&rsaquo;</span>
          <Link href={`/pyq/${params.exam}`} className="hover:text-blue-600">{exam.name}</Link>
          <span>&rsaquo;</span>
          <span className="text-slate-800 dark:text-slate-200">{yearNum} Paper</span>
        </nav>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-black uppercase px-3 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Official Exam Paper
                </span>
                <span className="text-xs text-slate-400 font-mono">{totalQuestions} Questions</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
                {exam.name} {yearNum} Question Paper
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Official questions with verified options and step-by-step solutions after login.
              </p>
            </div>
            {!isAuthorized && (
              <Link
                href={`/login?redirect=/pyq/${params.exam}/${yearNum}`}
                className="pyq-btn-primary px-5 py-2.5 text-xs font-black shadow-md shrink-0"
              >
                <span className="material-symbols-outlined text-sm">lock_open</span>
                Login to Unlock Solutions
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {occurrences.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400">
              No questions recorded yet for this year paper.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {occurrences.map((occ) => {
                const q = {
                  ...occ.question,
                  pyqOccurrences: [
                    {
                      year: occ.year,
                      session: occ.session,
                      shift: occ.shift,
                      paper: occ.paper,
                      questionNumber: occ.questionNumber,
                      exam: { name: exam.name, slug: exam.slug },
                    },
                  ],
                };
                return <PublicQuestionCard key={occ.id} question={q} isAuthorized={isAuthorized} />;
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. SUBJECT OVERVIEW (/pyq/[exam]/physics)
  // ---------------------------------------------------------------------------
  if (slugParts.length === 1) {
    const rawSubject = slugParts[0];
    const normSubject = normalizeSubjectName(rawSubject);
    const masterChapters = getMasterNcertChapters(normSubject);

    const chapterGroupings = await prisma.question.groupBy({
      by: ["chapter"],
      where: {
        isPublished: true,
        subject: { equals: normSubject, mode: "insensitive" },
        pyqOccurrences: { some: { examId: exam.id, verificationStatus: "VERIFIED" } },
      },
      _count: { id: true },
    });

    const countMap = new Map(chapterGroupings.map((c) => [c.chapter?.toLowerCase().trim(), c._count.id]));

    return (
      <div className="space-y-8">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/pyq" className="hover:text-blue-600">PYQ Library</Link>
          <span>&rsaquo;</span>
          <Link href={`/pyq/${params.exam}`} className="hover:text-blue-600">{exam.name}</Link>
          <span>&rsaquo;</span>
          <span className="text-slate-800 dark:text-slate-200">{normSubject}</span>
        </nav>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <span className="text-[11px] font-black uppercase px-3 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {exam.name} Subject Hub
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white mt-2">
            {normSubject} Previous Year Questions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Browse all Class 11 and Class 12 {normSubject} chapters for {exam.name}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {masterChapters.map((ch) => {
            const chSlug = buildChapterSlug(ch.title);
            const count = countMap.get(ch.title.toLowerCase().trim()) ?? 0;
            return (
              <Link
                key={ch.id}
                href={`/pyq/${params.exam}/${rawSubject}/${chSlug}`}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 shadow-sm transition text-xs"
              >
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">C{ch.classNumber} · Ch {ch.chapterNumber}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{ch.title}</span>
                </div>
                <span className={`font-mono text-xs px-2 py-0.5 rounded-lg font-bold ${count > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-slate-400"}`}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. CHAPTER PAGE (/pyq/[exam]/physics/kinematics)
  // ---------------------------------------------------------------------------
  const rawSubject = slugParts[0];
  const rawChapterSlug = slugParts[1];
  const normSubject = normalizeSubjectName(rawSubject);
  const masterChapters = getMasterNcertChapters(normSubject);

  const matchedChapter = masterChapters.find((c) => buildChapterSlug(c.title) === rawChapterSlug.toLowerCase());
  const chapterSearchName = matchedChapter?.title || rawChapterSlug.replace(/-/g, " ");

  const yearFilter = searchParams.year ? parseInt(searchParams.year, 10) : null;
  const topicFilter = searchParams.topic?.trim() || null;

  const where: any = {
    isPublished: true,
    subject: { equals: normSubject, mode: "insensitive" },
    chapter: { contains: chapterSearchName, mode: "insensitive" },
    pyqOccurrences: {
      some: {
        examId: exam.id,
        verificationStatus: "VERIFIED",
        ...(yearFilter ? { year: yearFilter } : {}),
      },
    },
    ...(topicFilter ? { topic: { contains: topicFilter, mode: "insensitive" } } : {}),
  };

  const [totalApproved, questions, yearDistGroup, topicDistGroup] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        slug: true,
        questionCode: true,
        type: true,
        difficulty: true,
        subject: true,
        chapter: true,
        topic: true,
        imageUrl: true,
        pyqYear: true,
        solution: isAuthorized,
        translations: {
          select: {
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: isAuthorized,
          },
        },
        pyqOccurrences: {
          where: { examId: exam.id, verificationStatus: "VERIFIED" },
          select: {
            year: true,
            session: true,
            shift: true,
            paper: true,
            questionNumber: true,
            exam: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    prisma.pyqOccurrence.groupBy({
      by: ["year"],
      where: {
        examId: exam.id,
        verificationStatus: "VERIFIED",
        year: { not: null },
        question: {
          isPublished: true,
          subject: { equals: normSubject, mode: "insensitive" },
          chapter: { contains: chapterSearchName, mode: "insensitive" },
        },
      },
      _count: { id: true },
      orderBy: { year: "desc" },
    }),
    prisma.question.groupBy({
      by: ["topic"],
      where: {
        isPublished: true,
        subject: { equals: normSubject, mode: "insensitive" },
        chapter: { contains: chapterSearchName, mode: "insensitive" },
        pyqOccurrences: { some: { examId: exam.id, verificationStatus: "VERIFIED" } },
      },
      _count: { id: true },
    }),
  ]);

  const years = yearDistGroup.map((y) => ({ year: y.year!, count: y._count.id }));
  const topics = topicDistGroup.filter((t) => t.topic).map((t) => ({ topic: t.topic!, count: t._count.id }));
  const relatedChapters = masterChapters.filter((c) => buildChapterSlug(c.title) !== rawChapterSlug.toLowerCase()).slice(0, 6);

  return (
    <div className="space-y-10">
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link href="/pyq" className="hover:text-blue-600">PYQ Library</Link>
        <span>&rsaquo;</span>
        <Link href={`/pyq/${params.exam}`} className="hover:text-blue-600">{exam.name}</Link>
        <span>&rsaquo;</span>
        <Link href={`/pyq/${params.exam}/${rawSubject}`} className="hover:text-blue-600">{normSubject}</Link>
        <span>&rsaquo;</span>
        <span className="text-slate-800 dark:text-slate-200">{chapterSearchName}</span>
      </nav>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase px-3 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {exam.name} PYQ
              </span>
              <span className="text-xs text-slate-400 font-bold">{normSubject} · Class {matchedChapter?.classNumber || 11}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {chapterSearchName} Previous Year Questions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl mt-1 leading-relaxed">
              Solve official {exam.name} questions from {chapterSearchName} with topic filters, authentic options, and login-protected solutions.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <span className="text-2xl font-black font-mono text-blue-600">{totalApproved} Questions</span>
            <Link
              href={`/pyq?ps=${encodeURIComponent(normSubject)}&pm=chapter&pc=${encodeURIComponent(chapterSearchName)}`}
              className="pyq-btn-primary px-5 py-2.5 text-xs font-black shadow-md"
            >
              <span className="material-symbols-outlined text-sm">play_circle</span>
              Practice Online Quiz
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-slate-500 block mb-2 text-[11px] uppercase tracking-wider">Filter by Year</span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/pyq/${params.exam}/${rawSubject}/${rawChapterSlug}`}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition ${!yearFilter ? "bg-blue-600 text-white font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
              >
                All Years
              </Link>
              {years.map((y) => (
                <Link
                  key={y.year}
                  href={`/pyq/${params.exam}/${rawSubject}/${rawChapterSlug}?year=${y.year}`}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition ${yearFilter === y.year ? "bg-blue-600 text-white font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                >
                  {y.year} ({y.count})
                </Link>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-500 block mb-2 text-[11px] uppercase tracking-wider">Topic Breakdown</span>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <Link
                  key={t.topic}
                  href={`/pyq/${params.exam}/${rawSubject}/${rawChapterSlug}?topic=${encodeURIComponent(t.topic)}`}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition ${topicFilter === t.topic ? "bg-blue-600 text-white font-bold" : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"}`}
                >
                  {t.topic} ({t.count})
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">quiz</span>
            Questions in {chapterSearchName} ({questions.length})
          </h2>
          {!isAuthorized && (
            <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">lock</span>
              Solutions protected — login required
            </span>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400">
            No questions matched the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => (
              <PublicQuestionCard key={q.id} question={q} isAuthorized={isAuthorized} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">Other {normSubject} Chapters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {relatedChapters.map((rc) => (
            <Link
              key={rc.id}
              href={`/pyq/${params.exam}/${rawSubject}/${buildChapterSlug(rc.title)}`}
              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-300 transition truncate"
            >
              {rc.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
