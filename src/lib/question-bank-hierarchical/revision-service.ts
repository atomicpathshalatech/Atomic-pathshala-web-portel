import { prisma } from "@/lib/db";
import { RevisionItemSummary, RevisionDashboardStats } from "./types";

/**
 * Adds a hierarchy portion to the user's persistent revision list
 */
export async function addPortionToRevision(
  userId: string,
  data: {
    entityType: "CLASS" | "SUBJECT" | "CHAPTER" | "TOPIC" | "SUBTOPIC";
    entityId: string;
    title: string;
    fullPath: string;
  }
) {
  return await prisma.revisionItem.upsert({
    where: {
      userId_entityType_entityId: {
        userId,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    },
    create: {
      userId,
      entityType: data.entityType,
      entityId: data.entityId,
      title: data.title,
      fullPath: data.fullPath,
      active: true,
    },
    update: {
      active: true,
      title: data.title,
      fullPath: data.fullPath,
    },
  });
}

/**
 * Removes a portion from active revision (historical sessions preserved)
 */
export async function removePortionFromRevision(userId: string, revisionItemId: string) {
  return await prisma.revisionItem.updateMany({
    where: { id: revisionItemId, userId },
    data: { active: false },
  });
}

/**
 * Fetches user-isolated Revision dashboard statistics, active items, and weak/strong areas
 */
export async function getUserRevisionDashboard(userId: string): Promise<{
  stats: RevisionDashboardStats;
  items: RevisionItemSummary[];
}> {
  const activeItems = await prisma.revisionItem.findMany({
    where: { userId, active: true },
    include: {
      sessions: {
        orderBy: { revisionNumber: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  let totalSessions = 0;
  let totalQuestionsRevised = 0;
  let totalAccuracySum = 0;
  let completedSessionsCount = 0;

  const weakAreas: RevisionDashboardStats["weakAreas"] = [];
  const strongAreas: RevisionDashboardStats["strongAreas"] = [];

  const items: RevisionItemSummary[] = [];

  for (const item of activeItems) {
    const sessions = item.sessions || [];
    const completedSessions = sessions.filter((s) => s.completedAt !== null);

    totalSessions += completedSessions.length;

    let questionCount = 0;
    // Query actual question counts for this entity
    if (item.entityType === "CHAPTER") {
      questionCount = await prisma.question.count({
        where: { chapter: { contains: item.title, mode: "insensitive" } },
      });
    } else if (item.entityType === "SUBJECT") {
      questionCount = await prisma.question.count({
        where: { subject: { contains: item.title, mode: "insensitive" } },
      });
    } else if (item.entityType === "TOPIC") {
      questionCount = await prisma.question.count({
        where: { topic: { contains: item.title, mode: "insensitive" } },
      });
    } else if (item.entityType === "SUBTOPIC") {
      questionCount = await prisma.question.count({
        where: { subTopic: { contains: item.title, mode: "insensitive" } },
      });
    } else {
      questionCount = await prisma.question.count();
    }

    const latestSession = completedSessions[completedSessions.length - 1];
    const latestAccuracy = latestSession ? Math.round(latestSession.accuracy) : 0;

    const avgAcc =
      completedSessions.length > 0
        ? Math.round(completedSessions.reduce((acc, s) => acc + s.accuracy, 0) / completedSessions.length)
        : 0;

    for (const s of completedSessions) {
      totalQuestionsRevised += s.attempted;
      totalAccuracySum += s.accuracy;
      completedSessionsCount += 1;
    }

    let status: RevisionItemSummary["status"] = "UNATTEMPTED";
    if (completedSessions.length > 0) {
      if (latestAccuracy >= 85 && avgAcc >= 80) {
        status = "STRONG";
        strongAreas.push({
          title: item.title,
          fullPath: item.fullPath,
          accuracy: latestAccuracy,
          revisionCount: completedSessions.length,
          revisionItemId: item.id,
        });
      } else if (latestAccuracy < 70) {
        status = "WEAK";
        weakAreas.push({
          title: item.title,
          fullPath: item.fullPath,
          accuracy: latestAccuracy,
          revisionCount: completedSessions.length,
          revisionItemId: item.id,
        });
      } else {
        status = "NEEDS_PRACTICE";
      }
    }

    items.push({
      id: item.id,
      userId: item.userId,
      entityType: item.entityType as any,
      entityId: item.entityId,
      title: item.title,
      fullPath: item.fullPath,
      active: item.active,
      questionCount: Math.max(questionCount, item.sessions.reduce((max, s) => Math.max(max, s.totalQuestions), 0)),
      revisionCount: completedSessions.length,
      latestAccuracy,
      averageAccuracy: avgAcc,
      status,
      history: completedSessions.map((s) => ({
        sessionId: s.id,
        revisionNumber: s.revisionNumber,
        accuracy: Math.round(s.accuracy),
        date: s.completedAt ? s.completedAt.toISOString() : s.startedAt.toISOString(),
        attempted: s.attempted,
        correct: s.correct,
        incorrect: s.incorrect,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  }

  const overallAverageAccuracy =
    completedSessionsCount > 0 ? Math.round(totalAccuracySum / completedSessionsCount) : 0;

  const stats: RevisionDashboardStats = {
    activePortionsCount: activeItems.length,
    totalRevisionSessions: totalSessions,
    questionsRevisedCount: totalQuestionsRevised,
    averageAccuracy: overallAverageAccuracy,
    weakAreas,
    strongAreas,
  };

  return { stats, items };
}

/**
 * Starts a new Revision Session for a portion
 */
export async function startRevisionSession(
  userId: string,
  revisionItemId: string,
  mode: string = "ALL"
) {
  const revisionItem = await prisma.revisionItem.findFirst({
    where: { id: revisionItemId, userId },
  });

  if (!revisionItem) {
    throw new Error("Revision item not found or unauthorized.");
  }

  // Find previous sessions to calculate revisionNumber
  const previousSessionsCount = await prisma.revisionSession.count({
    where: { revisionItemId },
  });

  // Query matching questions from DB
  let questionWhere: any = {};
  if (revisionItem.entityType === "CHAPTER") {
    questionWhere.chapter = { contains: revisionItem.title, mode: "insensitive" };
  } else if (revisionItem.entityType === "SUBJECT") {
    questionWhere.subject = { contains: revisionItem.title, mode: "insensitive" };
  } else if (revisionItem.entityType === "TOPIC") {
    questionWhere.topic = { contains: revisionItem.title, mode: "insensitive" };
  } else if (revisionItem.entityType === "SUBTOPIC") {
    questionWhere.subTopic = { contains: revisionItem.title, mode: "insensitive" };
  }

  const questions = await prisma.question.findMany({
    where: questionWhere,
    include: {
      translations: true,
    },
    take: 50,
  });

  const session = await prisma.revisionSession.create({
    data: {
      userId,
      revisionItemId,
      revisionNumber: previousSessionsCount + 1,
      mode,
      totalQuestions: questions.length,
      startedAt: new Date(),
    },
  });

  return { session, questions, revisionItem };
}

/**
 * Submits a Revision Session and records question-level attempts
 */
export async function submitRevisionSession(
  userId: string,
  sessionId: string,
  answers: Record<string, string> // questionId -> selectedOption (e.g. "A")
) {
  const session = await prisma.revisionSession.findFirst({
    where: { id: sessionId, userId },
    include: { revisionItem: true },
  });

  if (!session) throw new Error("Session not found.");

  const questionIds = Object.keys(answers);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { translations: true },
  });

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const attemptRows = [];

  for (const q of questions) {
    const userAns = answers[q.id];
    if (!userAns) {
      skippedCount += 1;
      continue;
    }

    // Determine correct answer
    const enTrans = q.translations.find((t) => t.language === "ENGLISH") || q.translations[0];
    const correctOptions = (enTrans?.correctOptionIds as string[]) || ["A"];
    const isCorrect = correctOptions.includes(userAns);

    if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    attemptRows.push({
      sessionId,
      questionId: q.id,
      isCorrect,
      userAnswer: userAns,
      attemptedAt: new Date(),
    });
  }

  const totalAttempted = correctCount + incorrectCount;
  const accuracy = totalAttempted > 0 ? (correctCount / totalAttempted) * 100 : 0;

  // Write attempt records
  if (attemptRows.length > 0) {
    await prisma.revisionQuestionAttempt.createMany({
      data: attemptRows,
    });
  }

  // Update session
  const updatedSession = await prisma.revisionSession.update({
    where: { id: sessionId },
    data: {
      attempted: totalAttempted,
      correct: correctCount,
      incorrect: incorrectCount,
      skipped: skippedCount,
      accuracy: Math.round(accuracy * 100) / 100,
      completedAt: new Date(),
    },
  });

  // Touch parent revisionItem updatedAt
  await prisma.revisionItem.update({
    where: { id: session.revisionItemId },
    data: { updatedAt: new Date() },
  });

  return updatedSession;
}
