import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { buildChapterSlug, buildExamSlug } from "@/lib/pyq/slug-generator";
import { PublicQuestionCard } from "@/components/pyq/PublicQuestionCard";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const question = await prisma.question.findFirst({
    where: {
      OR: [{ slug: params.slug }, { id: params.slug }, { questionCode: params.slug }],
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
    description: `${statementSnippet}... Practice this official ${examName} question with full options, verified answers, and step-by-step solution after login.`,
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
      OR: [{ slug: params.slug }, { id: params.slug }, { questionCode: params.slug }],
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
          correctOptionIds: isAuthorized,
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
      translations: { select: { language: true, statement: true, options: true }, take: 1 },
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

      {/* Main Canonical Question Container */}
      <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {question.pyqOccurrences.map((o) => (
              <span
                key={o.id}
                className="font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl"
              >
                {o.exam.name} {o.year} {o.session ? `(${o.session})` : ""}{" "}
                {o.shift ? `[${o.shift}]` : ""} {o.questionNumber ? `Q.${o.questionNumber}` : ""}
              </span>
            ))}

            <span className="font-bold text-slate-700 dark:text-slate-300">
              {question.subject}
            </span>

            {question.chapter && (
              <span className="text-slate-500 font-medium">
                · {question.chapter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-slate-400 text-xs">
            <span>ID: {question.questionCode || question.id}</span>
          </div>
        </div>

        {/* Question Statement */}
        <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
          <FormulaText text={translation?.statement || "(Question text not available)"} />
        </div>

        {/* Diagram / Image */}
        {question.imageUrl && (
          <div className="my-4 max-w-md rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <img src={question.imageUrl} alt="Question figure" className="w-full object-contain" />
          </div>
        )}

        {/* Options */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
            Answer Choices:
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {["A", "B", "C", "D"].map((key) => {
              const optText = options[key];
              if (!optText) return null;
              const isCorrect = isAuthorized && correctKeys.includes(key);

              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border text-sm transition ${
                    isCorrect
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100 font-bold shadow-sm"
                      : "bg-slate-50/70 border-slate-200/80 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                  }`}
                >
                  <span
                    className={`font-black shrink-0 ${
                      isCorrect ? "text-emerald-600" : "text-blue-600"
                    }`}
                  >
                    ({key})
                  </span>
                  <div className="flex-1">
                    <FormulaText text={optText} />
                  </div>
                  {isCorrect && (
                    <span className="shrink-0 text-xs font-black uppercase text-emerald-600 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Correct Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Solution Gating Section */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          {isAuthorized ? (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                <span className="material-symbols-outlined">lightbulb</span>
                <h4>Detailed Step-by-Step Verified Solution</h4>
              </div>
              <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                <FormulaText
                  text={translation?.solution || question.solution || "Step-by-step derivation will be added shortly."}
                />
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-3xl p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Unlock Official Answer & Detailed Solution
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Log in with your Atomic Pathshala student account to reveal the verified correct answer, derivation steps, and key formula hints.
              </p>
              <div className="pt-2">
                <Link
                  href={`/login?redirect=/pyq/question/${question.slug || question.id}`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  Login to Reveal Answer & Solution
                </Link>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Related Questions from the same chapter */}
      {relatedQuestions.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              More Questions from {question.chapter || question.subject}
            </h3>
            {question.chapter && (
              <Link
                href={`/pyq/${examSlug}/${question.subject.toLowerCase()}/${chapterSlug}`}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View all chapter questions &rarr;
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedQuestions.map((rq) => (
              <PublicQuestionCard key={rq.id} question={rq} isAuthorized={isAuthorized} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
