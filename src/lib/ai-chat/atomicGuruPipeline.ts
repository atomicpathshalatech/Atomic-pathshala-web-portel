import { prisma } from "@/lib/db";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { formatStructuredSolution, type QuizQuestion } from "@/lib/ai-chat/quiz";
import { QuestionType, Difficulty } from "@prisma/client";
import { awardXp, registerDailyActivity } from "@/lib/ai-chat/gamification";

function mapQuestionTypeToPrisma(typeStr?: string): QuestionType {
  if (!typeStr) return QuestionType.SINGLE_CORRECT;
  const upper = typeStr.toUpperCase();
  if (upper.includes("MULTI") && upper.includes("CORRECT")) return QuestionType.MULTIPLE_CORRECT;
  if (upper.includes("INTEGER")) return QuestionType.INTEGER;
  if (upper.includes("NUMERICAL")) return QuestionType.NUMERICAL;
  if (upper.includes("STATEMENT")) return QuestionType.STATEMENT_BASED;
  if (upper.includes("MATCH")) return QuestionType.MATCH_COLUMN;
  if (upper.includes("ASSERTION")) return QuestionType.ASSERTION_REASON;
  return QuestionType.SINGLE_CORRECT;
}

function mapDifficultyToPrisma(diffStr?: string): Difficulty {
  if (!diffStr) return Difficulty.MEDIUM;
  const upper = diffStr.toUpperCase();
  if (upper === "EASY") return Difficulty.EASY;
  if (upper === "HARD" || upper === "ULTRA") return Difficulty.HARD;
  return Difficulty.MEDIUM;
}

export async function resolveUserId(userId?: string | null): Promise<string | null> {
  try {
    if (userId) {
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (existing) return existing.id;
    }
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    return firstUser?.id || null;
  } catch {
    return null;
  }
}

/**
 * 1. Create a Generation Job record for Atomic Guru analytics
 */
export async function createGenerationJob({
  userId,
  sourceModule,
  subject,
  chapter,
  topic,
  requestedQuestionCount,
}: {
  userId?: string | null;
  sourceModule: string;
  subject: string;
  chapter?: string;
  topic?: string;
  requestedQuestionCount: number;
}): Promise<string> {
  const safeUserId = await resolveUserId(userId);
  if (!safeUserId) return "";

  const job = await prisma.generationJob.create({
    data: {
      userId: safeUserId,
      sourceModule,
      subject,
      chapter: chapter || null,
      topic: topic || null,
      requestedQuestionCount,
      status: "PROCESSING",
    },
  });
  return job.id;
}

/**
 * 2. Update an existing Generation Job
 */
export async function updateGenerationJob({
  jobId,
  status,
  successfulCount = 0,
  failedCount = 0,
  errorDetails,
}: {
  jobId: string;
  status: "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  successfulCount?: number;
  failedCount?: number;
  errorDetails?: string;
}) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status,
      successfulQuestionCount: successfulCount,
      failedQuestionCount: failedCount,
      errorDetails: errorDetails || null,
      completedAt: status === "COMPLETED" || status === "FAILED" || status === "PARTIAL" ? new Date() : undefined,
    },
  }).catch((e) => console.warn("[GenerationJob] Update warning:", e));
}

/**
 * 3. Persist generated quiz & its questions into PracticeQuiz
 */
export async function persistPracticeQuiz({
  quizCode,
  userId,
  sourceModule,
  subject,
  chapter,
  topic,
  subTopic,
  questionCount,
  difficulty = "Medium",
  questionTypes,
  language = "english",
  generationJobId,
  questions,
}: {
  quizCode: string;
  userId?: string | null;
  sourceModule: string;
  subject: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  questionCount: number;
  difficulty?: string;
  questionTypes?: string[];
  language?: string;
  generationJobId?: string;
  questions: QuizQuestion[];
}) {
  const safeUserId = await resolveUserId(userId);
  if (!safeUserId) return null;

  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      quizCode,
      userId: safeUserId,
      sourceModule,
      subject,
      chapter: chapter || null,
      topic: topic || null,
      subTopic: subTopic || null,
      questionCount,
      difficulty,
      questionTypes: questionTypes || [],
      language,
      status: "ACTIVE",
      generationJobId: generationJobId || null,
      questions: {
        create: questions.map((q, index) => {
          const structured = formatStructuredSolution(q);
          return {
            questionId: q.id,
            order: index + 1,
            subject: q.subject,
            text: q.text,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation || structured.solution,
            explainQuestion: structured.explainQuestion,
            concept: structured.concept,
            solution: structured.solution,
            finalAnswer: structured.finalAnswer,
            chapter: q.chapter || chapter || null,
            topic: q.topic || topic || null,
            difficulty: q.difficulty || difficulty,
            questionType: q.questionType || "single_correct",
            snapshot: JSON.parse(JSON.stringify(q)),
          };
        }),
      },
    },
    include: {
      questions: true,
    },
  });

  return practiceQuiz;
}

/**
 * 4. Stream AI Generated Questions to Question Bank Draft
 * IMPORTANT: PYQ Practice questions MUST NEVER be streamed into Draft (Section 17 rule)
 */
export async function streamToQuestionBankDraft({
  questions,
  sourceModule,
  userId,
  language = "english",
  generationJobId,
}: {
  questions: QuizQuestion[];
  sourceModule: string;
  userId?: string | null;
  language?: string;
  generationJobId?: string;
}): Promise<number> {
  // STRICT RULE: PYQ questions are existing platform questions and must never enter Atomic Guru Draft
  if (sourceModule === "PYQ_PRACTICE" || sourceModule.toUpperCase().includes("PYQ")) {
    return 0;
  }

  const safeUserId = await resolveUserId(userId);
  if (!safeUserId) return 0;

  let savedCount = 0;

  for (const q of questions) {
    try {
      const structured = formatStructuredSolution(q);
      const code = await generateQuestionId(prisma, q.subject);
      const correctLetter = String.fromCharCode(65 + Math.max(0, Math.min(3, q.correctIndex ?? 0)));

      const optionsMap: Record<string, string> = {
        A: q.options[0] || "",
        B: q.options[1] || "",
        C: q.options[2] || "",
        D: q.options[3] || "",
      };

      const isHindi = language === "hindi";

      await prisma.question.create({
        data: {
          questionCode: code,
          subject: q.subject,
          chapter: q.chapter || q.topic || "General",
          topic: q.topic || q.chapter || "General",
          type: mapQuestionTypeToPrisma(q.questionType),
          difficulty: mapDifficultyToPrisma(q.difficulty),
          category: "ATOMIC_GURU",
          status: "DRAFT",
          solution: structured.solution,
          tags: `ATOMIC_GURU_GENERATED, SOURCE_${sourceModule}${generationJobId ? `, JOB_${generationJobId}` : ""}`,
          createdById: safeUserId,
          translations: {
            create: [
              {
                language: isHindi ? "HINDI" : "ENGLISH",
                statement: q.text,
                options: optionsMap,
                correctOptionIds: [correctLetter],
                solution: structured.solution,
              },
            ],
          },
          versions: {
            create: {
              versionNumber: 1,
              editedById: safeUserId,
              changeType: "CREATE",
              snapshot: {
                statement: q.text,
                options: optionsMap,
                correctOption: correctLetter,
                explainQuestion: structured.explainQuestion,
                concept: structured.concept,
                solution: structured.solution,
                finalAnswer: structured.finalAnswer,
                subject: q.subject,
                chapter: q.chapter,
                topic: q.topic,
                sourceModule,
              },
            },
          },
        },
      });

      savedCount++;
    } catch (err) {
      console.warn("[AtomicGuruPipeline] Failed to save question to draft:", err);
    }
  }

  return savedCount;
}

/**
 * 5. Idempotent per-question answer submission
 */
export async function recordQuizAnswer({
  attemptId,
  quizId,
  questionId,
  selectedIndex,
  timeTakenSec = 0,
}: {
  attemptId: string;
  quizId?: string;
  questionId: string;
  selectedIndex: number;
  timeTakenSec?: number;
}) {
  // Locate question in database for authoritative validation
  let correctIndex = 0;
  let questionRecord: any = null;

  if (quizId) {
    questionRecord = await prisma.practiceQuizQuestion.findFirst({
      where: { quizId, questionId },
    });
    if (questionRecord) {
      correctIndex = questionRecord.correctIndex;
    }
  }

  // If question was not found in PracticeQuizQuestion, lookup by id or fallback
  if (!questionRecord) {
    const pq = await prisma.practiceQuizQuestion.findFirst({
      where: { questionId },
    });
    if (pq) {
      questionRecord = pq;
      correctIndex = pq.correctIndex;
    }
  }

  const isCorrect = selectedIndex === correctIndex;
  const correctLetter = String.fromCharCode(65 + correctIndex);
  const selectedLetter = String.fromCharCode(65 + selectedIndex);

  // Idempotent upsert on [attemptId, questionId]
  const answerRecord = await prisma.quizAttemptAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId,
      },
    },
    update: {
      selectedIndex,
      selectedAnswer: selectedLetter,
      correctAnswer: correctLetter,
      isCorrect,
      timeTakenSec,
      answeredAt: new Date(),
    },
    create: {
      attemptId,
      quizId: quizId || null,
      questionId,
      selectedIndex,
      selectedAnswer: selectedLetter,
      correctAnswer: correctLetter,
      isCorrect,
      timeTakenSec,
      answeredAt: new Date(),
    },
  });

  const structured = questionRecord ? formatStructuredSolution(questionRecord as any) : null;

  return {
    answerRecord,
    isCorrect,
    correctIndex,
    solution: structured,
  };
}

/**
 * 6. Finalize quiz attempt with authoritative server-side score calculation
 */
export async function finalizeQuizAttempt({
  attemptId,
  userId,
  timeTakenSec,
}: {
  attemptId: string;
  userId: string;
  timeTakenSec?: number;
}) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      quiz: {
        include: { questions: true },
      },
    },
  });

  if (!attempt) {
    throw new Error("Quiz attempt not found.");
  }

  // Calculate scores server-side
  const totalQuestions = attempt.quiz?.questions.length || attempt.totalQuestions;
  const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  let correctCount = 0;
  let wrongCount = 0;

  if (attempt.quiz?.questions && attempt.quiz.questions.length > 0) {
    for (const q of attempt.quiz.questions) {
      const ans = answersMap.get(q.questionId);
      if (ans && ans.selectedIndex !== null) {
        if (ans.selectedIndex === q.correctIndex) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    }
  } else {
    correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    wrongCount = attempt.answers.filter((a) => a.selectedIndex !== null && !a.isCorrect).length;
  }

  const unattemptedCount = Math.max(0, totalQuestions - (correctCount + wrongCount));
  // NEET Marking: +4 for correct, -1 for incorrect
  const finalScore = correctCount * 4 - wrongCount * 1;
  const attempted = correctCount + wrongCount;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

  // Update QuizAttempt
  const updatedAttempt = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      correct: correctCount,
      wrong: wrongCount,
      unattempted: unattemptedCount,
      score: finalScore,
      accuracy,
      timeTakenSec: timeTakenSec ?? attempt.timeTakenSec,
    },
  });

  // Mark PracticeQuiz as completed
  if (attempt.quizId) {
    await prisma.practiceQuiz.update({
      where: { id: attempt.quizId },
      data: { status: "COMPLETED" },
    }).catch(() => {});
  }

  // Register daily activity and award XP
  await registerDailyActivity(userId).catch(() => {});
  const xpGained = correctCount * 10 + wrongCount * 2;
  await awardXp(userId, xpGained).catch(() => {});

  return {
    attempt: updatedAttempt,
    totalQuestions,
    correct: correctCount,
    wrong: wrongCount,
    unattempted: unattemptedCount,
    score: finalScore,
    accuracy,
    xpGained,
  };
}

/**
 * 7. Persist generated quiz PDF
 */
export async function persistQuizPdf({
  quizId,
  userId,
  fileName,
  fileSizeBytes = 0,
  publicUrl,
  storageKey,
  generationJobId,
}: {
  quizId: string;
  userId?: string | null;
  fileName: string;
  fileSizeBytes?: number;
  publicUrl?: string;
  storageKey?: string;
  generationJobId?: string;
}) {
  const safeUserId = await resolveUserId(userId);
  if (!safeUserId) return null;

  return prisma.practiceQuizPdf.create({
    data: {
      quizId,
      userId: safeUserId,
      generationJobId: generationJobId || null,
      fileName,
      storageKey: storageKey || null,
      publicUrl: publicUrl || null,
      fileSizeBytes,
    },
  });
}
