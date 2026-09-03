import "server-only";
import { prisma } from "@/lib/db";

export type SubjectStat = {
  subject: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  avgTimeSec: number;
  strongAreas: string[];
  weakAreas: string[];
  topicsForRevision: string[];
};

export type QuestionTypeStat = {
  type: string;
  label: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  errorRate: number; // (incorrect / attempted) * 100
  sampleStatus: "SUFFICIENT" | "LIMITED_DATA";
};

export type ErrorTaxonomyStat = {
  category: string;
  label: string;
  count: number;
  percentageOfErrors: number;
  description: string;
};

export type ChapterStat = {
  subject: string;
  chapter: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  errorRate: number;
  status: "STRONG" | "NEEDS_IMPROVEMENT" | "WEAK" | "LIMITED_DATA";
};

export type TopicStat = {
  subject: string;
  chapter: string;
  topic: string;
  subTopic?: string | null;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  errorRate: number;
  priority: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  recommendation: string;
};

export type LosingMarkArea = {
  area: string;
  category: "QUESTION_TYPE" | "CHAPTER" | "CONCEPT" | "ERROR_TYPE";
  errorRate: number;
  marksLost: number;
  impactLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
};

export type NcertRecommendation = {
  subject: string;
  chapter: string;
  topic: string;
  errorCount: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  revisionFrequency: string; // e.g. "Read 3 times + solve 10 questions"
  practiceQuestionCount: number;
  actionText: string;
  ncertReference: {
    book?: string | null;
    className?: string | null;
    chapterName?: string | null;
    pageNumber?: string | null;
    sectionHeading?: string | null;
    lineReference?: string | null;
    isMapped: boolean;
  };
};

export type ActionPlanItem = {
  timeframe: "TODAY" | "24_HOURS" | "48_HOURS" | "7_DAYS";
  timeframeLabel: string;
  title: string;
  durationMin?: number;
  actionType: "NCERT_READ" | "PRACTICE" | "FORMULA_REVISION" | "RE_TEST";
  details: string;
};

export type QuestionReviewItem = {
  questionNumber: number;
  questionId: string;
  subject: string;
  chapter: string;
  topic: string;
  subTopic?: string | null;
  questionType: string;
  difficulty: string;
  userSelectedOptions: string[];
  correctOptions: string[];
  isCorrect: boolean | null; // null = unanswered
  isAnswered: boolean;
  marksObtained: number;
  maxMarks: number;
  negativeMarks: number;
  timeTakenSec: number;
  errorCategory?: string | null;
  statementEn: string;
  statementHi?: string | null;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  solutionEn?: string | null;
  solutionHi?: string | null;
  ncertReference?: {
    book?: string | null;
    page?: string | null;
    section?: string | null;
    line?: string | null;
    isMapped: boolean;
  };
  recommendedAction: string;
};

export type FullTestAnalysisResult = {
  attemptId: string;
  studentId: string;
  testId: string;
  testName: string;
  targetExam?: string | null;
  submittedAt: string;
  totalQuestions: number;
  attempted: number;
  unattempted: number;
  correct: number;
  incorrect: number;
  score: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  timeTakenSec: number;
  timeRemainingSec?: number;
  rank: number;
  totalParticipants: number;
  topperScore: number;
  gapTopperMarks: number;
  percentile: number;
  subjectStats: SubjectStat[];
  questionTypeStats: QuestionTypeStat[];
  errorBreakdown: ErrorTaxonomyStat[];
  losingMarkAreas: LosingMarkArea[];
  chapterStats: ChapterStat[];
  topicStats: TopicStat[];
  ncertPlan: NcertRecommendation[];
  actionPlan: ActionPlanItem[];
  questionReviews: QuestionReviewItem[];
};

type ErrorCategoryKey =
  | "CONCEPTUAL_ERROR"
  | "DEEP_CONCEPT_ERROR"
  | "CALCULATION_ERROR"
  | "READING_ERROR"
  | "STATEMENT_MISINTERPRETATION"
  | "OPTION_CONFUSION"
  | "SILLY_MISTAKE"
  | "UNANSWERED"
  | "UNCLASSIFIED_ERROR";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  SINGLE_CORRECT: "Single Correct (MCQ)",
  MULTIPLE_CORRECT: "Multiple Correct",
  MULTIPLE_INCORRECT: "Multiple Incorrect",
  ASSERTION_REASON: "Assertion & Reason",
  MATCH_COLUMN: "Match the Column",
  STATEMENT_BASED: "Statement Based",
  NUMERICAL: "Numerical Answer",
  INTEGER: "Integer Type",
  CONCEPTUAL: "Conceptual",
  DEEP_CONCEPT: "Deep Concept",
};

/**
 * Deterministic calculation of complete NTA-grade test performance analysis.
 * Generates and stores the complete analysis payload into the database.
 */
export async function calculateAndStoreTestAnalysis(
  attemptId: string
): Promise<FullTestAnalysisResult | null> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              questions: {
                orderBy: { order: "asc" },
                include: {
                  question: {
                    include: { translations: true },
                  },
                },
              },
            },
          },
        },
      },
      answers: true,
      student: { select: { id: true, targetExam: true, user: { select: { name: true } } } },
    },
  });

  if (!attempt || !attempt.test) return null;

  const test = attempt.test;
  const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const sectionQuestions = test.sections.flatMap((s) =>
    s.questions.map((sq) => ({ ...sq, section: s }))
  );

  const totalQuestions = sectionQuestions.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let computedScore = 0;
  let totalMaxMarks = 0;
  let totalTimeSec = 0;

  // Question review accumulation
  const questionReviews: QuestionReviewItem[] = [];

  // Groupings for aggregations
  const subjectMap = new Map<string, {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    score: number;
    maxMarks: number;
    timeSec: number;
    chapters: Map<string, { total: number; correct: number; incorrect: number }>;
    topics: Map<string, { total: number; correct: number; incorrect: number; chapter: string }>;
  }>();

  const typeMap = new Map<string, {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
  }>();

  const chapterMap = new Map<string, {
    subject: string;
    chapter: string;
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
  }>();

  const topicMap = new Map<string, {
    subject: string;
    chapter: string;
    topic: string;
    subTopic?: string | null;
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
  }>();

  const errorCounts: Record<ErrorCategoryKey, number> = {
    CONCEPTUAL_ERROR: 0,
    DEEP_CONCEPT_ERROR: 0,
    CALCULATION_ERROR: 0,
    READING_ERROR: 0,
    STATEMENT_MISINTERPRETATION: 0,
    OPTION_CONFUSION: 0,
    SILLY_MISTAKE: 0,
    UNANSWERED: 0,
    UNCLASSIFIED_ERROR: 0,
  };

  let qNumber = 1;

  for (const sq of sectionQuestions) {
    const q = sq.question;
    const ans = answersMap.get(q.id);

    const correctMarks = sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks;
    const incorrectMarks = sq.negativeMarksOverride ?? sq.section.negativeMarks ?? test.incorrectMarks;
    totalMaxMarks += correctMarks;

    const enTrans = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
    const hiTrans = q.translations.find((t) => t.language === "HINDI");

    const correctOptions = (enTrans?.correctOptionIds as string[] | null) ?? [];
    const userSelectedOptions = (ans?.selectedOptionIds as string[] | null) ?? [];
    const isAnswered = userSelectedOptions.length > 0;
    const timeSpent = ans?.timeTakenSec ?? 0;
    totalTimeSec += timeSpent;

    let isCorrect: boolean | null = null;
    let marksObtained = 0;
    let errorCategory: string | null = null;

    if (!isAnswered) {
      unattemptedCount++;
      isCorrect = null;
      marksObtained = 0;
      errorCounts.UNANSWERED++;
    } else {
      const match =
        correctOptions.length > 0 &&
        correctOptions.length === userSelectedOptions.length &&
        correctOptions.every((opt) => userSelectedOptions.includes(opt));

      if (match) {
        correctCount++;
        isCorrect = true;
        marksObtained = correctMarks;
        computedScore += correctMarks;
      } else {
        incorrectCount++;
        isCorrect = false;
        marksObtained = incorrectMarks;
        computedScore += incorrectMarks;

        // Evidence-based error classification
        if (q.category === "DEEP_CONCEPT" || (q.tags && q.tags.includes("Deep Concept"))) {
          errorCategory = "DEEP_CONCEPT_ERROR";
          errorCounts.DEEP_CONCEPT_ERROR++;
        } else if (q.type === "NUMERICAL" || q.type === "INTEGER") {
          errorCategory = "CALCULATION_ERROR";
          errorCounts.CALCULATION_ERROR++;
        } else if (q.type === "STATEMENT_BASED" || q.type === "ASSERTION_REASON") {
          errorCategory = "STATEMENT_MISINTERPRETATION";
          errorCounts.STATEMENT_MISINTERPRETATION++;
        } else if (q.difficulty === "EASY" && timeSpent < 15) {
          errorCategory = "SILLY_MISTAKE";
          errorCounts.SILLY_MISTAKE++;
        } else if (q.chapter || q.topic) {
          errorCategory = "CONCEPTUAL_ERROR";
          errorCounts.CONCEPTUAL_ERROR++;
        } else {
          errorCategory = "UNCLASSIFIED_ERROR";
          errorCounts.UNCLASSIFIED_ERROR++;
        }
      }
    }

    // Recommendation per question
    let recommendedAction = "Review this question to strengthen accuracy.";
    if (!isAnswered) {
      recommendedAction = `Attempt similar ${q.subject} practice problems to build confidence.`;
    } else if (isCorrect) {
      recommendedAction = "Great job! Keep this concept reinforced in periodic revisions.";
    } else {
      if (q.ncertChapter) {
        recommendedAction = `Re-read NCERT Chapter "${q.ncertChapter}" (Section: ${q.ncertSection || q.topic || "Core Concept"}) and solve 5 related questions.`;
      } else if (q.topic) {
        recommendedAction = `Revise core principles of "${q.topic}" and practice 5 targeted questions.`;
      }
    }

    // Accumulate into QuestionReviews
    questionReviews.push({
      questionNumber: qNumber++,
      questionId: q.id,
      subject: q.subject || "General",
      chapter: q.chapter || "General Topic",
      topic: q.topic || "General Concept",
      subTopic: q.subTopic,
      questionType: q.type,
      difficulty: q.difficulty,
      userSelectedOptions,
      correctOptions,
      isCorrect,
      isAnswered,
      marksObtained,
      maxMarks: correctMarks,
      negativeMarks: incorrectMarks,
      timeTakenSec: timeSpent,
      errorCategory,
      statementEn: enTrans?.statement || "",
      statementHi: hiTrans?.statement || null,
      optionsEn: (enTrans?.options as Record<string, string>) || {},
      optionsHi: (hiTrans?.options as Record<string, string>) || {},
      solutionEn: enTrans?.solution || q.solution,
      solutionHi: hiTrans?.solution,
      ncertReference: {
        book: q.ncertBook,
        page: q.ncertPage,
        section: q.ncertSection,
        line: q.ncertLine,
        isMapped: Boolean(q.ncertChapter || q.ncertPage || q.ncertSection),
      },
      recommendedAction,
    });

    // Subject breakdown accumulation
    const subjKey = q.subject || "General";
    if (!subjectMap.has(subjKey)) {
      subjectMap.set(subjKey, {
        total: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        score: 0,
        maxMarks: 0,
        timeSec: 0,
        chapters: new Map(),
        topics: new Map(),
      });
    }
    const sStat = subjectMap.get(subjKey)!;
    sStat.total++;
    sStat.maxMarks += correctMarks;
    sStat.timeSec += timeSpent;
    if (isAnswered) {
      sStat.attempted++;
      if (isCorrect) {
        sStat.correct++;
        sStat.score += correctMarks;
      } else {
        sStat.incorrect++;
        sStat.score += incorrectMarks;
      }
    } else {
      sStat.unattempted++;
    }

    // Question type accumulation
    const typeKey = q.type || "SINGLE_CORRECT";
    if (!typeMap.has(typeKey)) {
      typeMap.set(typeKey, { total: 0, attempted: 0, correct: 0, incorrect: 0, unattempted: 0 });
    }
    const tStat = typeMap.get(typeKey)!;
    tStat.total++;
    if (isAnswered) {
      tStat.attempted++;
      if (isCorrect) tStat.correct++;
      else tStat.incorrect++;
    } else {
      tStat.unattempted++;
    }

    // Chapter accumulation
    const chapterName = q.chapter || "General Fundamentals";
    const chapterKey = `${subjKey}::${chapterName}`;
    if (!chapterMap.has(chapterKey)) {
      chapterMap.set(chapterKey, {
        subject: subjKey,
        chapter: chapterName,
        total: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
      });
    }
    const chStat = chapterMap.get(chapterKey)!;
    chStat.total++;
    if (isAnswered) {
      chStat.attempted++;
      if (isCorrect) chStat.correct++;
      else chStat.incorrect++;
    } else {
      chStat.unattempted++;
    }

    // Topic accumulation
    const topicName = q.topic || "Core Concepts";
    const topicKey = `${chapterKey}::${topicName}`;
    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, {
        subject: subjKey,
        chapter: chapterName,
        topic: topicName,
        subTopic: q.subTopic,
        total: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
      });
    }
    const topStat = topicMap.get(topicKey)!;
    topStat.total++;
    if (isAnswered) {
      topStat.attempted++;
      if (isCorrect) topStat.correct++;
      else topStat.incorrect++;
    } else {
      topStat.unattempted++;
    }
  }

  const attemptedCount = correctCount + incorrectCount;
  const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;
  const percentage = totalMaxMarks > 0 ? (computedScore / totalMaxMarks) * 100 : 0;

  // 1. Subject Stats
  const subjectStats: SubjectStat[] = Array.from(subjectMap.entries()).map(([subj, s]) => {
    const sAcc = s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0;
    const sPct = s.maxMarks > 0 ? (s.score / s.maxMarks) * 100 : 0;
    const avgTime = s.total > 0 ? Math.round(s.timeSec / s.total) : 0;

    // Identify weak & strong areas within this subject
    const subjectChapters = Array.from(chapterMap.values()).filter((c) => c.subject === subj);
    const strongAreas = subjectChapters
      .filter((c) => c.attempted >= 2 && (c.correct / c.attempted) >= 0.75)
      .map((c) => c.chapter);
    const weakAreas = subjectChapters
      .filter((c) => c.attempted >= 2 && (c.correct / c.attempted) < 0.6)
      .map((c) => c.chapter);
    const topicsForRevision = Array.from(topicMap.values())
      .filter((t) => t.subject === subj && t.incorrect > 0)
      .map((t) => t.topic);

    return {
      subject: subj,
      totalQuestions: s.total,
      attempted: s.attempted,
      correct: s.correct,
      incorrect: s.incorrect,
      unattempted: s.unattempted,
      score: s.score,
      maxMarks: s.maxMarks,
      percentage: Math.round(sPct * 100) / 100,
      accuracy: Math.round(sAcc * 100) / 100,
      avgTimeSec: avgTime,
      strongAreas,
      weakAreas,
      topicsForRevision,
    };
  });

  // 2. Question Type Stats
  const questionTypeStats: QuestionTypeStat[] = Array.from(typeMap.entries()).map(([type, t]) => {
    const acc = t.attempted > 0 ? (t.correct / t.attempted) * 100 : 0;
    const errRate = t.attempted > 0 ? (t.incorrect / t.attempted) * 100 : 0;
    return {
      type,
      label: QUESTION_TYPE_LABELS[type] || type,
      totalQuestions: t.total,
      attempted: t.attempted,
      correct: t.correct,
      incorrect: t.incorrect,
      unattempted: t.unattempted,
      accuracy: Math.round(acc * 100) / 100,
      errorRate: Math.round(errRate * 100) / 100,
      sampleStatus: t.attempted >= 3 ? "SUFFICIENT" : "LIMITED_DATA",
    };
  });

  // 3. Chapter Stats
  const chapterStats: ChapterStat[] = Array.from(chapterMap.values()).map((ch) => {
    const acc = ch.attempted > 0 ? (ch.correct / ch.attempted) * 100 : 0;
    const errRate = ch.attempted > 0 ? (ch.incorrect / ch.attempted) * 100 : 0;
    let status: ChapterStat["status"] = "LIMITED_DATA";
    if (ch.attempted >= 3) {
      if (acc >= 80) status = "STRONG";
      else if (acc >= 60) status = "NEEDS_IMPROVEMENT";
      else status = "WEAK";
    }
    return {
      subject: ch.subject,
      chapter: ch.chapter,
      totalQuestions: ch.total,
      attempted: ch.attempted,
      correct: ch.correct,
      incorrect: ch.incorrect,
      unattempted: ch.unattempted,
      accuracy: Math.round(acc * 100) / 100,
      errorRate: Math.round(errRate * 100) / 100,
      status,
    };
  });

  // Sort chapter stats: WEAK first
  chapterStats.sort((a, b) => a.accuracy - b.accuracy);

  // 4. Topic Stats
  const topicStats: TopicStat[] = Array.from(topicMap.values()).map((top) => {
    const errRate = top.attempted > 0 ? (top.incorrect / top.attempted) * 100 : 0;
    let priority: TopicStat["priority"] = "INSUFFICIENT_DATA";
    let recommendation = `Review ${top.topic} concepts.`;

    if (top.attempted >= 3) {
      if (errRate >= 40 || top.incorrect >= 3) {
        priority = "HIGH";
        recommendation = `Priority focus: Re-read NCERT theory and practice 10 questions on ${top.topic}.`;
      } else if (errRate >= 20) {
        priority = "MEDIUM";
        recommendation = `Moderate focus: Practice 5 questions to strengthen ${top.topic}.`;
      } else {
        priority = "LOW";
        recommendation = `Maintain strength with periodic revision of ${top.topic}.`;
      }
    } else {
      if (top.incorrect > 0) {
        priority = "MEDIUM";
        recommendation = `Limited sample data: Revise fundamentals of ${top.topic}.`;
      } else {
        priority = "LOW";
        recommendation = `Looks good on initial questions; practice more questions to test mastery.`;
      }
    }

    return {
      subject: top.subject,
      chapter: top.chapter,
      topic: top.topic,
      subTopic: top.subTopic,
      totalQuestions: top.total,
      attempted: top.attempted,
      correct: top.correct,
      incorrect: top.incorrect,
      unattempted: top.unattempted,
      errorRate: Math.round(errRate * 100) / 100,
      priority,
      recommendation,
    };
  });

  // 5. Error Breakdown
  const totalErrors = incorrectCount;
  const errorBreakdown: ErrorTaxonomyStat[] = [
    {
      category: "CONCEPTUAL_ERROR",
      label: "Conceptual Errors",
      count: errorCounts.CONCEPTUAL_ERROR,
      percentageOfErrors: totalErrors > 0 ? Math.round((errorCounts.CONCEPTUAL_ERROR / totalErrors) * 100) : 0,
      description: "Errors arising from incomplete understanding or incorrect application of core theory.",
    },
    {
      category: "DEEP_CONCEPT_ERROR",
      label: "Deep Concept Errors",
      count: errorCounts.DEEP_CONCEPT_ERROR,
      percentageOfErrors: totalErrors > 0 ? Math.round((errorCounts.DEEP_CONCEPT_ERROR / totalErrors) * 100) : 0,
      description: "Errors on multi-concept synthesis or advanced NCERT analytical questions.",
    },
    {
      category: "STATEMENT_MISINTERPRETATION",
      label: "Statement / Assertion Errors",
      count: errorCounts.STATEMENT_MISINTERPRETATION,
      percentageOfErrors: totalErrors > 0 ? Math.round((errorCounts.STATEMENT_MISINTERPRETATION / totalErrors) * 100) : 0,
      description: "Misreading conditional clauses, incorrect assertion-reason evaluation, or option traps.",
    },
    {
      category: "CALCULATION_ERROR",
      label: "Calculation / Formula Errors",
      count: errorCounts.CALCULATION_ERROR,
      percentageOfErrors: totalErrors > 0 ? Math.round((errorCounts.CALCULATION_ERROR / totalErrors) * 100) : 0,
      description: "Arithmetic slips, formula recall error, or unit conversion mistakes on numerical questions.",
    },
    {
      category: "SILLY_MISTAKE",
      label: "Execution Slips / Silly Mistakes",
      count: errorCounts.SILLY_MISTAKE,
      percentageOfErrors: totalErrors > 0 ? Math.round((errorCounts.SILLY_MISTAKE / totalErrors) * 100) : 0,
      description: "Isolated mistakes on straightforward questions solved under rushed time.",
    },
    {
      category: "UNANSWERED",
      label: "Unattempted Questions",
      count: errorCounts.UNANSWERED,
      percentageOfErrors: 0,
      description: "Questions skipped due to time constraint or perceived high difficulty.",
    },
  ];

  // 6. Losing Mark Areas
  const losingMarkAreas: LosingMarkArea[] = [];

  // High error question types
  for (const qt of questionTypeStats) {
    if (qt.incorrect > 0) {
      losingMarkAreas.push({
        area: `${qt.label} Questions`,
        category: "QUESTION_TYPE",
        errorRate: qt.errorRate,
        marksLost: qt.incorrect * 5, // 4 marks missed + 1 negative mark
        impactLevel: qt.errorRate >= 40 ? "HIGH" : "MEDIUM",
        recommendation: `Solve 10 targeted ${qt.label} questions to eliminate recurring patterns.`,
      });
    }
  }

  // High error chapters
  for (const ch of chapterStats) {
    if (ch.incorrect > 0) {
      losingMarkAreas.push({
        area: `${ch.subject}: ${ch.chapter}`,
        category: "CHAPTER",
        errorRate: ch.errorRate,
        marksLost: ch.incorrect * 5,
        impactLevel: ch.errorRate >= 40 ? "HIGH" : "MEDIUM",
        recommendation: `Revisit NCERT chapter notes for ${ch.chapter}.`,
      });
    }
  }

  losingMarkAreas.sort((a, b) => b.marksLost - a.marksLost);

  // 7. NCERT Recommendations Plan
  const ncertPlan: NcertRecommendation[] = [];
  const ncertGroupMap = new Map<string, {
    subject: string;
    chapter: string;
    topic: string;
    errors: number;
    book?: string | null;
    page?: string | null;
    section?: string | null;
    line?: string | null;
  }>();

  for (const qr of questionReviews) {
    if (qr.isCorrect === false) {
      const key = `${qr.subject}::${qr.chapter}::${qr.topic}`;
      if (!ncertGroupMap.has(key)) {
        ncertGroupMap.set(key, {
          subject: qr.subject,
          chapter: qr.chapter,
          topic: qr.topic,
          errors: 0,
          book: qr.ncertReference?.book,
          page: qr.ncertReference?.page,
          section: qr.ncertReference?.section,
          line: qr.ncertReference?.line,
        });
      }
      ncertGroupMap.get(key)!.errors++;
    }
  }

  for (const [, nItem] of ncertGroupMap.entries()) {
    const severity: "HIGH" | "MEDIUM" | "LOW" =
      nItem.errors >= 3 ? "HIGH" : nItem.errors >= 2 ? "MEDIUM" : "LOW";

    const revisionFrequency =
      severity === "HIGH"
        ? "Read 3 times + solve 10 related questions"
        : severity === "MEDIUM"
        ? "Read 2 times + solve 5 related questions"
        : "Read 1 time + quick recap";

    const practiceCount = severity === "HIGH" ? 10 : severity === "MEDIUM" ? 5 : 3;

    ncertPlan.push({
      subject: nItem.subject,
      chapter: nItem.chapter,
      topic: nItem.topic,
      errorCount: nItem.errors,
      severity,
      revisionFrequency,
      practiceQuestionCount: practiceCount,
      actionText: `Re-read the NCERT section on ${nItem.topic} (${nItem.chapter}) to fix ${nItem.errors} mistake${nItem.errors > 1 ? "s" : ""}.`,
      ncertReference: {
        book: nItem.book,
        className: null,
        chapterName: nItem.chapter,
        pageNumber: nItem.page,
        sectionHeading: nItem.section,
        lineReference: nItem.line,
        isMapped: Boolean(nItem.page || nItem.section),
      },
    });
  }

  // 8. Action Plan
  const actionPlan: ActionPlanItem[] = [];

  // Today actions
  if (ncertPlan.length > 0 && ncertPlan[0]) {
    const topWeakNcert = ncertPlan[0];
    actionPlan.push({
      timeframe: "TODAY",
      timeframeLabel: "Today (Immediate Actions)",
      title: `Revise ${topWeakNcert.chapter} NCERT Section`,
      durationMin: 30,
      actionType: "NCERT_READ",
      details: `Re-read ${topWeakNcert.topic} section. Focus on concepts where errors occurred.`,
    });
  }

  if (questionReviews.some((q) => q.isCorrect === false && q.questionType === "MATCH_COLUMN")) {
    actionPlan.push({
      timeframe: "TODAY",
      timeframeLabel: "Today (Immediate Actions)",
      title: "Practice 10 Match-the-Column Questions",
      durationMin: 20,
      actionType: "PRACTICE",
      details: "Practice elimination strategies for match-the-column matrices.",
    });
  }

  if (questionReviews.some((q) => q.isCorrect === false && (q.questionType === "NUMERICAL" || q.questionType === "INTEGER"))) {
    actionPlan.push({
      timeframe: "24_HOURS",
      timeframeLabel: "Within 24 Hours",
      title: "Solve 8 Mixed Calculation Numericals",
      durationMin: 30,
      actionType: "PRACTICE",
      details: "Work through step-by-step calculations with pen and paper to prevent arithmetic slips.",
    });
  }

  actionPlan.push({
    timeframe: "48_HOURS",
    timeframeLabel: "After 48 Hours",
    title: "Second Reinforcement Revision",
    durationMin: 25,
    actionType: "FORMULA_REVISION",
    details: "Review summary flashcards & formula sheets for tested chapters.",
  });

  actionPlan.push({
    timeframe: "7_DAYS",
    timeframeLabel: "After 7 Days",
    title: "Retest Weak Topics in Mini Practice Arena",
    durationMin: 30,
    actionType: "RE_TEST",
    details: "Attempt a custom 15-question mini-test on these chapters to verify mastery retention.",
  });

  // 9. Leaderboard & Benchmark Calculation
  const finalizedAttempts = await prisma.attempt.findMany({
    where: { testId: test.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    select: { id: true, score: true, startedAt: true, submittedAt: true },
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
  });

  const totalParticipants = Math.max(finalizedAttempts.length, 1);
  const myScore = computedScore;
  const rank = finalizedAttempts.filter((a) => (a.score ?? 0) > myScore).length + 1;
  const topperScore = Math.max(...finalizedAttempts.map((a) => a.score ?? 0), myScore);
  const gapTopperMarks = Math.max(0, topperScore - myScore);
  const percentile =
    totalParticipants <= 1
      ? 100
      : Math.round(((totalParticipants - rank) / (totalParticipants - 1)) * 10000) / 100;

  // Persist into TestAttemptAnalysis table (Idempotent Upsert)
  await prisma.testAttemptAnalysis.upsert({
    where: { attemptId },
    create: {
      attemptId,
      studentId: attempt.studentId,
      testId: test.id,
      totalQuestions,
      attempted: attemptedCount,
      unattempted: unattemptedCount,
      correct: correctCount,
      incorrect: incorrectCount,
      score: computedScore,
      maxMarks: totalMaxMarks,
      percentage: Math.round(percentage * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      timeTakenSec: totalTimeSec,
      rank,
      topperScore,
      gapTopperMarks,
      percentile,
      subjectStats: subjectStats as any,
      questionTypeStats: questionTypeStats as any,
      conceptStats: topicStats as any,
      chapterStats: chapterStats as any,
      errorBreakdown: errorBreakdown as any,
      ncertPlan: ncertPlan as any,
      actionPlan: actionPlan as any,
      questionReviews: questionReviews as any,
    },
    update: {
      totalQuestions,
      attempted: attemptedCount,
      unattempted: unattemptedCount,
      correct: correctCount,
      incorrect: incorrectCount,
      score: computedScore,
      maxMarks: totalMaxMarks,
      percentage: Math.round(percentage * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      timeTakenSec: totalTimeSec,
      rank,
      topperScore,
      gapTopperMarks,
      percentile,
      subjectStats: subjectStats as any,
      questionTypeStats: questionTypeStats as any,
      conceptStats: topicStats as any,
      chapterStats: chapterStats as any,
      errorBreakdown: errorBreakdown as any,
      ncertPlan: ncertPlan as any,
      actionPlan: actionPlan as any,
      questionReviews: questionReviews as any,
    },
  });

  return {
    attemptId,
    studentId: attempt.studentId,
    testId: test.id,
    testName: test.name,
    targetExam: attempt.student?.targetExam,
    submittedAt: (attempt.submittedAt || new Date()).toISOString(),
    totalQuestions,
    attempted: attemptedCount,
    unattempted: unattemptedCount,
    correct: correctCount,
    incorrect: incorrectCount,
    score: computedScore,
    maxMarks: totalMaxMarks,
    percentage: Math.round(percentage * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    timeTakenSec: totalTimeSec,
    rank,
    totalParticipants,
    topperScore,
    gapTopperMarks,
    percentile,
    subjectStats,
    questionTypeStats,
    errorBreakdown,
    losingMarkAreas,
    chapterStats,
    topicStats,
    ncertPlan,
    actionPlan,
    questionReviews,
  };
}

/**
 * Fetch stored analysis for an attempt.
 */
export async function getStoredTestAnalysis(
  attemptId: string
): Promise<FullTestAnalysisResult | null> {
  const analysis = await prisma.testAttemptAnalysis.findUnique({
    where: { attemptId },
    include: {
      attempt: {
        include: {
          test: { select: { name: true } },
          student: { select: { targetExam: true } },
        },
      },
    },
  });

  if (!analysis) {
    // If not calculated yet, compute and store on the fly
    return calculateAndStoreTestAnalysis(attemptId);
  }

  // Get total participants
  const totalParticipants = await prisma.attempt.count({
    where: { testId: analysis.testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
  });

  const questionTypeStats = (analysis.questionTypeStats as any[]) || [];
  const chapterStats = (analysis.chapterStats as any[]) || [];

  // Generate losing mark areas from stored stats
  const losingMarkAreas: LosingMarkArea[] = [];
  for (const qt of questionTypeStats) {
    if (qt.incorrect > 0) {
      losingMarkAreas.push({
        area: `${qt.label} Questions`,
        category: "QUESTION_TYPE",
        errorRate: qt.errorRate,
        marksLost: qt.incorrect * 5,
        impactLevel: qt.errorRate >= 40 ? "HIGH" : "MEDIUM",
        recommendation: `Solve 10 targeted ${qt.label} questions to eliminate recurring patterns.`,
      });
    }
  }
  for (const ch of chapterStats) {
    if (ch.incorrect > 0) {
      losingMarkAreas.push({
        area: `${ch.subject}: ${ch.chapter}`,
        category: "CHAPTER",
        errorRate: ch.errorRate,
        marksLost: ch.incorrect * 5,
        impactLevel: ch.errorRate >= 40 ? "HIGH" : "MEDIUM",
        recommendation: `Revisit NCERT chapter notes for ${ch.chapter}.`,
      });
    }
  }
  losingMarkAreas.sort((a, b) => b.marksLost - a.marksLost);

  return {
    attemptId: analysis.attemptId,
    studentId: analysis.studentId,
    testId: analysis.testId,
    testName: analysis.attempt.test?.name || "Test Result",
    targetExam: analysis.attempt.student?.targetExam,
    submittedAt: analysis.createdAt.toISOString(),
    totalQuestions: analysis.totalQuestions,
    attempted: analysis.attempted,
    unattempted: analysis.unattempted,
    correct: analysis.correct,
    incorrect: analysis.incorrect,
    score: analysis.score,
    maxMarks: analysis.maxMarks,
    percentage: analysis.percentage,
    accuracy: analysis.accuracy,
    timeTakenSec: analysis.timeTakenSec,
    rank: analysis.rank ?? 1,
    totalParticipants: Math.max(totalParticipants, 1),
    topperScore: analysis.topperScore ?? analysis.score,
    gapTopperMarks: analysis.gapTopperMarks ?? 0,
    percentile: analysis.percentile ?? 100,
    subjectStats: (analysis.subjectStats as any) || [],
    questionTypeStats,
    errorBreakdown: (analysis.errorBreakdown as any) || [],
    losingMarkAreas,
    chapterStats,
    topicStats: (analysis.conceptStats as any) || [],
    ncertPlan: (analysis.ncertPlan as any) || [],
    actionPlan: (analysis.actionPlan as any) || [],
    questionReviews: (analysis.questionReviews as any) || [],
  };
}

/**
 * Privacy-compliant Leaderboard Generator.
 * Strips all student names, emails, phone numbers, avatars, and question answers.
 */
export async function getPrivacySafeLeaderboard(testId: string, currentStudentId: string) {
  const attempts = await prisma.attempt.findMany({
    where: { testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    select: {
      id: true,
      studentId: true,
      score: true,
      submittedAt: true,
      analysis: {
        select: {
          accuracy: true,
          percentage: true,
          timeTakenSec: true,
        },
      },
    },
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
  });

  const totalParticipants = attempts.length;
  let myRank = 1;
  let myScore = 0;
  let myAccuracy = 0;

  const anonymizedRows = attempts.slice(0, 10).map((att, idx) => {
    const isMe = att.studentId === currentStudentId;
    const rank = idx + 1;
    if (isMe) {
      myRank = rank;
      myScore = att.score ?? 0;
      myAccuracy = att.analysis?.accuracy ?? 0;
    }

    return {
      rank,
      displayName: rank === 1 ? "Rank 1 Performer" : isMe ? "You" : `Candidate #${rank}`,
      score: att.score ?? 0,
      accuracy: att.analysis?.accuracy ?? 0,
      percentage: att.analysis?.percentage ?? 0,
      timeTakenSec: att.analysis?.timeTakenSec ?? 0,
      isCurrentUser: isMe,
    };
  });

  // If current user is not in top 10, find their exact rank
  const myAttempt = attempts.find((a) => a.studentId === currentStudentId);
  if (myAttempt) {
    myRank = attempts.findIndex((a) => a.studentId === currentStudentId) + 1;
    myScore = myAttempt.score ?? 0;
    myAccuracy = myAttempt.analysis?.accuracy ?? 0;
  }

  const rank1Score = attempts.length > 0 && attempts[0] ? (attempts[0].score ?? 0) : myScore;

  return {
    totalParticipants,
    myRank,
    myScore,
    myAccuracy,
    rank1Score,
    gapTopperMarks: Math.max(0, rank1Score - myScore),
    leaderboard: anonymizedRows,
  };
}

/**
 * Multi-test performance trend over time for a student.
 */
export async function getStudentPerformanceTrend(studentId: string) {
  const analyses = await prisma.testAttemptAnalysis.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      testId: true,
      createdAt: true,
      score: true,
      maxMarks: true,
      percentage: true,
      accuracy: true,
      errorBreakdown: true,
      attempt: { select: { test: { select: { name: true } } } },
    },
    take: 10,
  });

  return analyses.map((a) => {
    const errors = (a.errorBreakdown as any[]) || [];
    const sillyMistakes = errors.find((e) => e.category === "SILLY_MISTAKE")?.count ?? 0;
    const deepConceptErrors = errors.find((e) => e.category === "DEEP_CONCEPT_ERROR")?.count ?? 0;

    return {
      testId: a.testId,
      testName: a.attempt.test?.name || "Test",
      date: a.createdAt.toISOString(),
      score: a.score,
      maxMarks: a.maxMarks,
      percentage: a.percentage,
      accuracy: a.accuracy,
      sillyMistakes,
      deepConceptErrors,
    };
  });
}
