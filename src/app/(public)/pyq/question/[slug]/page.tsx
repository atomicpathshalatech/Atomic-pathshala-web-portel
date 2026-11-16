import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildChapterSlug, buildExamSlug } from "@/lib/pyq/slug-generator";
import { PublicQuestionCard } from "@/components/pyq/PublicQuestionCard";
import { InteractiveQuestionQuiz } from "@/components/pyq/InteractiveQuestionQuiz";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

function buildSlugFilter(rawSlug: string) {
  const decoded = decodeURIComponent(rawSlug || "").trim();
  const normalized = decoded.toLowerCase().replace(/[\s_]+/g, "-");
  const codeMatch = decoded.match(/([a-zA-Z]\d{8,12})/);
  const extractedCode = codeMatch ? codeMatch[1].toUpperCase() : null;

  return [
    { slug: rawSlug },
    { slug: decoded },
    { slug: normalized },
    { id: rawSlug },
    { id: decoded },
    { questionCode: rawSlug },
    { questionCode: decoded },
    ...(extractedCode ? [{ questionCode: extractedCode }, { slug: { contains: extractedCode.toLowerCase() } }] : []),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const question = await prisma.question.findFirst({
    where: {
      OR: buildSlugFilter(params.slug),
      isPublished: true,
    },
    select: {
      id: true,
      slug: true,
      subject: true,
      chapter: true,
      pyqExam: true,
      pyqYear: true,
      translations: { select: { statement: true }, take: 1 },
      pyqOccurrences: {
        where: { verificationStatus: "VERIFIED" },
        take: 1,
        select: { year: true, exam: { select: { name: true } } },
      },
    },
  });

  if (!question) {
    return { title: "Question Not Found | Atomic Pathshala" };
  }

  const occ = question.pyqOccurrences[0];
  const examName = occ?.exam?.name || question.pyqExam || "NEET/JEE";
  const year = occ?.year || question.pyqYear || "";
  const statementSnippet =
    question.translations[0]?.statement.slice(0, 140).replace(/[$\\{}]/g, "") || "";

  return {
    title: `${examName} ${year} ${question.subject} – ${question.chapter || "Question"} | Atomic Pathshala`,
    description: `${statementSnippet}... Practice this official ${examName} question with interactive quiz, instant answer check, and step-by-step solution after login.`,
    alternates: {
      canonical: `https://ap.atomicpathshala.in/pyq/question/${question.slug || question.id}`,
    },
    openGraph: {
      title: `${examName} ${year} – ${question.chapter || question.subject} PYQ`,
      description: statementSnippet,
      url: `https://ap.atomicpathshala.in/pyq/question/${question.slug || question.id}`,
      type: "article",
    },
  };
}

export default async function IndividualQuestionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const isAuthorized = Boolean(session?.user?.id);

  const question = await prisma.question.findFirst({
    where: {
      OR: buildSlugFilter(params.slug),
      isPublished: true,
    },
    select: {
      id: true,
      slug: true,
      questionCode: true,
      type: true,
      difficulty: true,
      subject: true,
      chapter: true,
      topic: true,
      subTopic: true,
      imageUrl: true,
      pyqExam: true,
      pyqYear: true,
      pyqMonth: true,
      pyqQuestionNumber: true,
      // Protected fields: ONLY retrieved if user is authenticated!
      solution: isAuthorized,
      translations: {
        select: {
          language: true,
          statement: true,
          options: true,
          correctOptionIds: true, // Needed for quiz checking
          solution: isAuthorized,
        },
      },
      pyqOccurrences: {
        where: { verificationStatus: "VERIFIED" },
        select: {
          id: true,
          year: true,
          session: true,
          shift: true,
          paper: true,
          questionNumber: true,
          sourceLabel: true,
          exam: { select: { slug: true, name: true, canonicalType: true } },
        },
      },
    },
  });

  if (!question) notFound();

  const translation = question.translations[0];
  const options = (translation?.options || {}) as Record<string, string>;
  const correctKeys = (translation?.correctOptionIds || []) as string[];
  const occ = question.pyqOccurrences[0];
  const examSlug = occ?.exam ? buildExamSlug(occ.exam.canonicalType || occ.exam.slug) : "neet";
  const chapterSlug = question.chapter ? buildChapterSlug(question.chapter) : "general";

  // Related questions from same chapter
  const relatedQuestions = await prisma.question.findMany({
    where: {
      id: { not: question.id },
      isPublished: true,
      subject: { equals: question.subject, mode: "insensitive" },
      ...(question.chapter ? { chapter: { equals: question.chapter, mode: "insensitive" } } : {}),
      pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
    },
    take: 4,
    orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      questionCode: true,
      subject: true,
      chapter: true,
      pyqYear: true,
      translations: { select: { language: true, statement: true, options: true, correctOptionIds: true }, take: 1 },
      pyqOccurrences: {
        where: { verificationStatus: "VERIFIED" },
        take: 1,
        select: { year: true, exam: { select: { name: true } } },
      },
    },
  });

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: `${occ?.exam?.name || "NEET"} ${occ?.year || ""} ${question.subject} Question`,
    educationalAlignment: {
      "@type": "AlignmentObject",
      alignmentType: "educationalSubject",
      educationalFramework: "NCERT",
      targetName: question.chapter || question.subject,
    },
    hasPart: {
      "@type": "Question",
      name: translation?.statement.slice(0, 100),
      text: translation?.statement,
      suggestedAnswer: Object.entries(options).map(([key, text]) => ({
        "@type": "Answer",
        text: `(${key}) ${text}`,
      })),
    },
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
        <Link href="/pyq" className="hover:text-blue-600">
          PYQ Library
        </Link>
        <span>&rsaquo;</span>
        <Link href={`/pyq/${examSlug}`} className="hover:text-blue-600">
          {occ?.exam?.name || question.pyqExam || "Exam"}
        </Link>
        {question.chapter && (
          <>
            <span>&rsaquo;</span>
            <Link
              href={`/pyq/${examSlug}/${question.subject.toLowerCase()}/${chapterSlug}`}
              className="hover:text-blue-600"
            >
              {question.chapter}
            </Link>
          </>
        )}
        <span>&rsaquo;</span>
        <span className="text-slate-800 dark:text-slate-200">
          {question.questionCode || question.id.slice(-6)}
        </span>
      </nav>

      {/* Main Canonical Question Container with Interactive Quiz */}
      <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <InteractiveQuestionQuiz
          questionId={question.id}
          slug={question.slug}
          questionCode={question.questionCode}
          examName={occ?.exam?.name || question.pyqExam}
          pyqYear={occ?.year || question.pyqYear}
          session={occ?.session || question.pyqMonth}
          shift={occ?.shift}
          questionNumber={occ?.questionNumber || question.pyqQuestionNumber}
          subject={question.subject}
          chapter={question.chapter}
          topic={question.topic}
          statement={translation?.statement || "(Question text not available)"}
          imageUrl={question.imageUrl}
          options={options}
          correctOptionIds={correctKeys}
          solution={(translation?.solution || question.solution) as string | null}
          isAuthorized={isAuthorized}
          currentUrl={`/pyq/question/${question.slug || question.id}`}
        />
      </article>

      {/* Related Questions from Same Chapter */}
      {relatedQuestions.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">auto_stories</span>
              More {question.chapter || question.subject} PYQs
            </h3>
            <Link
              href={`/pyq/${examSlug}/${question.subject.toLowerCase()}/${chapterSlug}`}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              View All &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {relatedQuestions.map((rq) => (
              <PublicQuestionCard key={rq.id} question={rq} isAuthorized={isAuthorized} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
