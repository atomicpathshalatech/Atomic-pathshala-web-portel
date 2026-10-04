/**
 * DRAFT IMPORTER SERVICE
 *
 * Converts VERIFIED extracted questions into Question Bank Drafts in Prisma.
 * Strictly preserves permanent source name, source PDF URL, source page,
 * original question number, bilingual translations, options, and solutions.
 * Never creates published questions directly — all questions move to DRAFT.
 */

import { prisma } from "@/lib/db";
import { withNewQuestionCode, toQuestionType, toDifficulty, isOptionBasedType } from "@/lib/questions/create-with-code";

export interface ImportToDraftResult {
  importedCount: number;
  skippedCount: number;
  draftQuestionIds: string[];
}

export async function importVerifiedQuestionsToDraft(
  jobId: string,
  userId: string
): Promise<ImportToDraftResult> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
    include: {
      questions: {
        where: {
          status: "VERIFIED",
          draftQuestionId: null, // Avoid re-importing already imported
        },
      },
    },
  });

  if (!job) throw new Error("Extraction job not found.");

  const draftQuestionIds: string[] = [];
  let skippedCount = 0;

  for (const eq of job.questions) {
    const pyqExam = eq.pyqExam || job.pyqExam || (job.examName?.includes("JEE Adv") ? "JEE_ADVANCED" : job.examName?.includes("JEE") ? "JEE_MAINS" : job.examName?.includes("NEET") ? "NEET" : null);
    const pyqYear = eq.pyqYear ?? (job.pyqYear ?? (job.year ? parseInt(job.year, 10) || null : null));
    const pyqMonth = eq.pyqMonth || job.pyqMonth || null;
    const paddedQNum = String(eq.originalNumber).padStart(2, "0");
    const pyqQuestionNumber = eq.pyqQuestionNumber || `Question ${paddedQNum}`;

    let formattedPyqSource: string | null = null;
    if (pyqExam === "NEET") {
      formattedPyqSource = `NEET ${pyqYear || ""} — ${pyqQuestionNumber}`.replace("  —", " —");
    } else if (pyqExam === "JEE_MAINS") {
      formattedPyqSource = `JEE Main ${pyqYear || ""}${pyqMonth ? ` — ${pyqMonth}` : ""} — ${pyqQuestionNumber}`.replace("  —", " —");
    } else if (pyqExam === "JEE_ADVANCED") {
      formattedPyqSource = `JEE Advanced ${pyqYear || ""} — ${pyqQuestionNumber}`.replace("  —", " —");
    } else if (job.year) {
      formattedPyqSource = `${job.sourceName} ${job.year} — ${pyqQuestionNumber}`;
    } else {
      formattedPyqSource = `${job.sourceName} — ${pyqQuestionNumber}`;
    }

    const tagsArray = [
      "Extracted",
      `Source:${job.sourceName}`,
      `Q.${eq.originalNumber}`,
      pyqExam || job.examName || "NEET",
      pyqYear ? String(pyqYear) : null,
      pyqMonth,
      pyqQuestionNumber,
      eq.questionType,
    ].filter(Boolean);

    // One shared type mapping — MULTI_CORRECT used to become SINGLE_CORRECT and
    // INTEGER answers were stored as MCQs.
    const pType = toQuestionType(eq.questionType);

    // Hindi options are kept in the extraction snapshot (the table has no
    // Hindi-options column); the Hindi translation used to get the ENGLISH options.
    const snapshot = (eq.originalSnapshot ?? {}) as { optionsHi?: Record<string, string> | null; currentOptionsHi?: Record<string, string> | null };
    const hiSource = snapshot.currentOptionsHi ?? snapshot.optionsHi ?? null;
    const optionsHi = hiSource && Object.values(hiSource).some((v) => String(v ?? "").trim()) ? hiSource : null;
    const rawAnswer = String(eq.correctAnswer ?? "").trim();
    const correct = isOptionBasedType(eq.questionType)
      ? rawAnswer.split(/[\s,;/&]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-D]$/.test(x))
      : rawAnswer ? [rawAnswer] : [];
    if (correct.length === 0) {
      // No usable answer — leave it for review instead of importing a wrong key.
      skippedCount++;
      continue;
    }

    // Claim the row first so a double-click / second import can't create a
    // second Question Bank copy of the same extracted question.
    const claimed = await prisma.extractedQuestion.updateMany({
      where: { id: eq.id, draftQuestionId: null, status: "VERIFIED" },
      data: { status: "IMPORTING" },
    });
    if (claimed.count === 0) {
      skippedCount++;
      continue;
    }

    // Create Question in Question Bank as DRAFT (with its Question ID)
    let createdQuestion;
    try {
    createdQuestion = await withNewQuestionCode(eq.subject || "General", (questionCode) => prisma.question.create({
      data: {
        subject: eq.subject || "General",
        chapter: eq.chapter || job.chapter || null,
        topic: eq.topic || null,
        subTopic: eq.subTopic || null,
        type: pType,
        difficulty: toDifficulty(eq.difficulty),
        category: pyqExam ? `${pyqExam}_PYQ` : `Source: ${job.sourceName}`,
        pyqExam,
        pyqYear,
        pyqMonth,
        pyqQuestionNumber,
        pyqSource: formattedPyqSource,
        questionCode,
        solution: eq.solution || null,
        imageUrl: null, // STRICTLY for genuine diagram only
        referenceImageUrl: eq.imageUrl || null, // Editor-only source screenshot
        tags: tagsArray.join(", "),
        status: "DRAFT",
        isPublished: false,
        createdById: userId,
        translations: {
          create: [
            {
              language: "ENGLISH",
              statement: eq.statement,
              options: eq.options as any,
              correctOptionIds: correct,
              solution: eq.solution || null,
            },
            ...(eq.statementHi
              ? [
                  {
                    language: "HINDI",
                    statement: eq.statementHi,
                    options: (optionsHi ?? eq.options) as any,
                    correctOptionIds: correct,
                    solution: eq.solutionHi || eq.solution || null,
                  },
                ]
              : []),
          ],
        },
      },
    }));
    } catch (err) {
      await prisma.extractedQuestion.update({ where: { id: eq.id }, data: { status: "VERIFIED" } }).catch(() => {});
      throw err;
    }

    // Mark ExtractedQuestion as IMPORTED and link draft ID
    await prisma.extractedQuestion.update({
      where: { id: eq.id },
      data: {
        status: "IMPORTED",
        draftQuestionId: createdQuestion.id,
      },
    });

    draftQuestionIds.push(createdQuestion.id);
  }

  // Update extraction job stats
  const remainingReview = await prisma.extractedQuestion.count({
    where: { jobId, status: "REVIEW_REQUIRED" },
  });

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: remainingReview > 0 ? "REVIEW_REQUIRED" : "IMPORTED_TO_DRAFT",
    },
  });

  return {
    importedCount: draftQuestionIds.length,
    skippedCount,
    draftQuestionIds,
  };
}
