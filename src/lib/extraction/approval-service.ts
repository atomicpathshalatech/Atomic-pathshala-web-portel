import "server-only";
import { prisma } from "@/lib/db";
import { toQuestionType, toDifficulty, isOptionBasedType } from "@/lib/questions/create-with-code";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { questionFingerprint } from "@/lib/pyq/fingerprint";
import { triggerQuestionVerification } from "@/lib/questions/verification-service";

export interface ApproveQuestionResult {
  success: boolean;
  publishedQuestionId?: string;
  questionCode?: string;
  sourceSequenceNumber?: number;
  message: string;
  alreadyPublished?: boolean;
}

export interface BulkApproveSummary {
  totalSelected: number;
  approvedCount: number;
  skippedCount: number;
  failedCount: number;
  questionCodeRange?: string;
  subject: string;
  chapter: string | null;
  topicDistribution: Record<string, number>;
  questionsWithErrors: Array<{ id: string; code?: string; reasons: string[] }>;
  questionsWithDuplicateWarning: Array<{ id: string; code?: string }>;
  errors: string[];
}

/**
 * Validates whether an extracted question has all required fields for publication.
 */
export function validateQuestionForPublication(eq: {
  statement?: string | null;
  options?: any;
  correctAnswer?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  questionType?: string | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!eq.statement || !eq.statement.trim() || eq.statement.includes("[MISSING QUESTION")) {
    errors.push("Question statement is missing or contains extraction placeholder.");
  }

  const rawAnswer = String(eq.correctAnswer ?? "").trim();
  if (isOptionBasedType(eq.questionType)) {
    if (!rawAnswer) {
      errors.push("Missing correct answer key for option-based question.");
    }
    const opts = eq.options as Record<string, string> | null;
    if (!opts || !opts.A || !opts.B) {
      errors.push("Option-based question requires at least options A and B.");
    }
  }

  if (!eq.subject || eq.subject === "Auto Detect" || eq.subject === "General") {
    errors.push("Subject must be assigned to an official subject (e.g. Chemistry, Physics, Biology).");
  }

  if (eq.topic === "NEEDS_TOPIC_REVIEW") {
    errors.push("Question is marked with 'NEEDS_TOPIC_REVIEW' — please assign a canonical topic before approval.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Ensures an extracted question has an assigned canonical Question ID before approval.
 */
export async function ensureAssignedQuestionCode(
  extractedQuestionId: string,
  subject: string
): Promise<string> {
  const existing = await prisma.extractedQuestion.findUnique({
    where: { id: extractedQuestionId },
    select: { assignedQuestionCode: true },
  });

  if (existing?.assignedQuestionCode) {
    return existing.assignedQuestionCode;
  }

  const newCode = await generateQuestionId(prisma as any, subject);
  await prisma.extractedQuestion.update({
    where: { id: extractedQuestionId },
    data: { assignedQuestionCode: newCode },
  });

  return newCode;
}

/**
 * Approves a single staged question and transactionally publishes it into the official Question Bank.
 * Strictly preserves:
 * - Assigned Question ID (questionCode)
 * - Source PDF name & URL
 * - Source Page number
 * - Original printed question number
 * - Source sequence number
 * - Extraction batch ID
 * - Bilingual content & solutions
 */
export async function approveStagedQuestion(
  extractedQuestionId: string,
  reviewerId: string,
  overrides?: {
    statement?: string;
    statementHi?: string | null;
    options?: any;
    optionsHi?: any;
    correctAnswer?: string;
    solution?: string | null;
    solutionHi?: string | null;
    subject?: string;
    chapter?: string | null;
    topic?: string | null;
    subTopic?: string | null;
    difficulty?: string;
    questionType?: string;
  },
  approvalOptions?: {
    skipAsyncVerification?: boolean;
  }
): Promise<ApproveQuestionResult> {
  const eq = await prisma.extractedQuestion.findUnique({
    where: { id: extractedQuestionId },
    include: { job: true },
  });

  if (!eq) {
    throw new Error(`Staged extracted question with ID "${extractedQuestionId}" not found.`);
  }

  // Idempotency: if already approved and published, return existing record
  if (eq.approvalStatus === "APPROVED" && eq.publishedQuestionId) {
    const existingPub = await prisma.question.findUnique({
      where: { id: eq.publishedQuestionId },
      select: { id: true, questionCode: true, sourceSequenceNumber: true },
    });
    if (existingPub) {
      return {
        success: true,
        publishedQuestionId: existingPub.id,
        questionCode: existingPub.questionCode || eq.assignedQuestionCode || undefined,
        sourceSequenceNumber: existingPub.sourceSequenceNumber ?? eq.sourceSequenceNumber ?? undefined,
        message: "Question is already approved and published in the official Question Bank.",
        alreadyPublished: true,
      };
    }
  }

  // Merge overrides
  const statement = overrides?.statement ?? eq.statement;
  const statementHi = overrides?.statementHi !== undefined ? overrides.statementHi : eq.statementHi;
  const options = overrides?.options ?? eq.options;
  const rawAnswer = String(overrides?.correctAnswer ?? eq.correctAnswer ?? "").trim();
  const solution = overrides?.solution !== undefined ? overrides.solution : eq.solution;
  const solutionHi = overrides?.solutionHi !== undefined ? overrides.solutionHi : eq.solutionHi;
  const subject = overrides?.subject ?? eq.subject ?? eq.job.subject ?? "Chemistry";
  const chapter = overrides?.chapter ?? eq.chapter ?? eq.job.chapter ?? null;
  const topic = overrides?.topic ?? eq.topic ?? null;
  const subTopic = overrides?.subTopic ?? eq.subTopic ?? null;
  const questionTypeStr = overrides?.questionType ?? eq.questionType ?? "SINGLE_CORRECT";
  const difficultyStr = overrides?.difficulty ?? eq.difficulty ?? "MEDIUM";

  // Validate
  const validation = validateQuestionForPublication({
    statement,
    options,
    correctAnswer: rawAnswer,
    subject,
    chapter,
    topic,
    questionType: questionTypeStr,
  });

  if (!validation.valid) {
    throw new Error(`Cannot approve question: ${validation.errors.join("; ")}`);
  }

  // Ensure stable Question ID
  const questionCode = eq.assignedQuestionCode || (await ensureAssignedQuestionCode(eq.id, subject));
  const pType = toQuestionType(questionTypeStr);
  const pDiff = toDifficulty(difficultyStr);

  const correct = isOptionBasedType(questionTypeStr)
    ? rawAnswer.split(/[\s,;/&]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-D]$/.test(x))
    : rawAnswer ? [rawAnswer] : [];

  const snapshot = (eq.originalSnapshot ?? {}) as {
    optionsHi?: Record<string, string> | null;
    currentOptionsHi?: Record<string, string> | null;
  };
  const hiSource = overrides?.optionsHi ?? snapshot.currentOptionsHi ?? snapshot.optionsHi ?? null;
  const optionsHi = hiSource && Object.values(hiSource).some((v) => String(v ?? "").trim()) ? hiSource : null;

  const fingerprint = questionFingerprint(statement || "", (options as Record<string, string>) || null);

  const images = (eq.imagesJson && !Array.isArray(eq.imagesJson) ? eq.imagesJson : {}) as {
    reference?: string | null;
    figure?: string | null;
  };

  const now = new Date();

  // Transactional publication
  const result = await prisma.$transaction(async (tx) => {
    // Check if official question with this questionCode already exists
    let official = await tx.question.findUnique({
      where: { questionCode },
    });

    if (official) {
      // Update existing official question
      official = await tx.question.update({
        where: { id: official.id },
        data: {
          subject,
          chapter,
          topic,
          subTopic,
          type: pType,
          difficulty: pDiff,
          solution,
          imageUrl: eq.hasImage ? images.figure ?? eq.imageUrl ?? null : null,
          referenceImageUrl: images.reference ?? null,
          contentFingerprint: fingerprint,
          sourceSequenceNumber: eq.sourceSequenceNumber ?? eq.questionIndex,
          sourcePage: eq.sourcePage,
          sourcePdfName: eq.sourcePdfName,
          sourcePdfUrl: eq.sourcePdfUrl,
          sourceQuestionNumber: String(eq.originalNumber),
          extractionJobId: eq.jobId,
          isPublished: true,
          status: "PUBLISHED",
          publishedAt: now,
          publishedById: reviewerId,
          approvedAt: now,
          approvedById: reviewerId,
          isStagedImport: true,
        },
      });

      // Update English translation
      await tx.questionTranslation.upsert({
        where: { questionId_language: { questionId: official.id, language: "ENGLISH" } },
        create: {
          questionId: official.id,
          language: "ENGLISH",
          statement,
          options: options as any,
          correctOptionIds: correct,
          solution,
        },
        update: {
          statement,
          options: options as any,
          correctOptionIds: correct,
          solution,
        },
      });

      // Update Hindi translation if present
      if (statementHi) {
        await tx.questionTranslation.upsert({
          where: { questionId_language: { questionId: official.id, language: "HINDI" } },
          create: {
            questionId: official.id,
            language: "HINDI",
            statement: statementHi,
            options: (optionsHi ?? options) as any,
            correctOptionIds: correct,
            solution: solutionHi || solution || null,
          },
          update: {
            statement: statementHi,
            options: (optionsHi ?? options) as any,
            correctOptionIds: correct,
            solution: solutionHi || solution || null,
          },
        });
      }
    } else {
      // Create new official Question in Question Bank
      official = await tx.question.create({
        data: {
          questionCode,
          subject,
          chapter,
          topic,
          subTopic,
          type: pType,
          difficulty: pDiff,
          category: `Source: ${eq.sourceName}`,
          pyqSource: `${eq.sourceName} — Q.${eq.originalNumber}`,
          pyqQuestionNumber: String(eq.originalNumber),
          solution,
          imageUrl: eq.hasImage ? images.figure ?? eq.imageUrl ?? null : null,
          referenceImageUrl: images.reference ?? null,
          contentFingerprint: fingerprint,
          tags: [
            "Imported",
            `Source:${eq.sourceName}`,
            `Q.${eq.originalNumber}`,
            `Seq:${eq.sourceSequenceNumber ?? eq.questionIndex}`,
            chapter,
            topic,
          ]
            .filter(Boolean)
            .join(", "),
          sourceSequenceNumber: eq.sourceSequenceNumber ?? eq.questionIndex,
          sourcePage: eq.sourcePage,
          sourcePdfName: eq.sourcePdfName,
          sourcePdfUrl: eq.sourcePdfUrl,
          sourceQuestionNumber: String(eq.originalNumber),
          extractionJobId: eq.jobId,
          isPublished: true,
          status: "PUBLISHED",
          publishedAt: now,
          publishedById: reviewerId,
          approvedAt: now,
          approvedById: reviewerId,
          createdById: eq.job.createdById || reviewerId,
          isStagedImport: true,
          translations: {
            create: [
              {
                language: "ENGLISH",
                statement,
                options: options as any,
                correctOptionIds: correct,
                solution,
              },
              ...(statementHi
                ? [
                    {
                      language: "HINDI",
                      statement: statementHi,
                      options: (optionsHi ?? options) as any,
                      correctOptionIds: correct,
                      solution: solutionHi || solution || null,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }

    // Mark staged question as APPROVED and link publishedQuestionId
    await tx.extractedQuestion.update({
      where: { id: eq.id },
      data: {
        approvalStatus: "APPROVED",
        reviewDecision: "APPROVED",
        publishedQuestionId: official.id,
        draftQuestionId: official.id,
        reviewedById: reviewerId,
        reviewedAt: now,
        statement,
        statementHi,
        options: options as any,
        correctAnswer: rawAnswer,
        solution,
        solutionHi,
        subject,
        chapter,
        topic,
        subTopic,
        difficulty: difficultyStr,
        questionType: questionTypeStr,
      },
    });

    return official;
  });

  // Asynchronously trigger AI verification if enabled
  if (!approvalOptions?.skipAsyncVerification) {
    triggerQuestionVerification(result.id, { triggerSource: "PDF_EXTRACTION", userId: reviewerId }).catch((err) =>
      console.warn("[ApprovalService] Verification trigger skipped or failed:", err?.message || err)
    );
  }

  return {
    success: true,
    publishedQuestionId: result.id,
    questionCode: result.questionCode || questionCode,
    sourceSequenceNumber: result.sourceSequenceNumber ?? eq.sourceSequenceNumber ?? undefined,
    message: `Question ${questionCode} (Seq #${eq.sourceSequenceNumber ?? eq.questionIndex}) successfully approved and published into official Question Bank.`,
  };
}

/**
 * Rejects a staged question.
 * The Question ID is retained and NOT deleted or reused.
 */
export async function rejectStagedQuestion(
  extractedQuestionId: string,
  reviewerId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const eq = await prisma.extractedQuestion.findUnique({
    where: { id: extractedQuestionId },
  });

  if (!eq) {
    throw new Error(`Staged extracted question "${extractedQuestionId}" not found.`);
  }

  await prisma.extractedQuestion.update({
    where: { id: extractedQuestionId },
    data: {
      approvalStatus: "REJECTED",
      reviewDecision: "REJECTED",
      rejectionReason: reason || "Rejected by administrator review.",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  return {
    success: true,
    message: `Question Q.${eq.originalNumber} (ID: ${eq.assignedQuestionCode || eq.id}) rejected and kept in staging history.`,
  };
}

/**
 * Provides a comprehensive summary of a batch or selected questions before bulk approval.
 */
export async function getJobApprovalSummary(
  jobId: string,
  selectedQuestionIds?: string[]
): Promise<BulkApproveSummary> {
  const whereClause: any = { jobId };
  if (selectedQuestionIds && selectedQuestionIds.length > 0) {
    whereClause.id = { in: selectedQuestionIds };
  }

  const questions = await prisma.extractedQuestion.findMany({
    where: whereClause,
    orderBy: { sourceSequenceNumber: "asc" },
  });

  const topicDistribution: Record<string, number> = {};
  const questionsWithErrors: Array<{ id: string; code?: string; reasons: string[] }> = [];
  const questionsWithDuplicateWarning: Array<{ id: string; code?: string }> = [];

  for (const q of questions) {
    const t = q.topic || "Unassigned";
    topicDistribution[t] = (topicDistribution[t] || 0) + 1;

    const val = validateQuestionForPublication(q);
    if (!val.valid) {
      questionsWithErrors.push({
        id: q.id,
        code: q.assignedQuestionCode || undefined,
        reasons: val.errors,
      });
    }

    if (q.status === "DUPLICATE") {
      questionsWithDuplicateWarning.push({
        id: q.id,
        code: q.assignedQuestionCode || undefined,
      });
    }
  }

  const firstCode = questions[0]?.assignedQuestionCode;
  const lastCode = questions[questions.length - 1]?.assignedQuestionCode;
  const questionCodeRange = firstCode && lastCode ? `${firstCode} – ${lastCode}` : undefined;

  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
    select: { subject: true, chapter: true },
  });

  return {
    totalSelected: questions.length,
    approvedCount: questions.filter((q) => q.approvalStatus === "APPROVED").length,
    skippedCount: 0,
    failedCount: questionsWithErrors.length,
    questionCodeRange,
    subject: job?.subject || questions[0]?.subject || "Chemistry",
    chapter: job?.chapter || questions[0]?.chapter || null,
    topicDistribution,
    questionsWithErrors,
    questionsWithDuplicateWarning,
    errors: [],
  };
}

/**
 * Bulk approves explicitly selected questions with confirmation.
 */
export async function bulkApproveStagedQuestions(
  jobId: string,
  selectedQuestionIds: string[],
  reviewerId: string,
  options?: { skipAsyncVerification?: boolean }
): Promise<{
  successCount: number;
  failedCount: number;
  approvedIds: string[];
  failedItems: Array<{ id: string; error: string }>;
}> {
  if (!selectedQuestionIds || selectedQuestionIds.length === 0) {
    throw new Error("No questions selected for bulk approval.");
  }

  const approvedIds: string[] = [];
  const failedItems: Array<{ id: string; error: string }> = [];

  for (const qid of selectedQuestionIds) {
    try {
      const res = await approveStagedQuestion(qid, reviewerId, undefined, options);
      if (res.publishedQuestionId) {
        approvedIds.push(res.publishedQuestionId);
      }
    } catch (err) {
      failedItems.push({
        id: qid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update extractionJob stats
  const remainingPending = await prisma.extractedQuestion.count({
    where: { jobId, approvalStatus: "PENDING" },
  });

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: remainingPending === 0 ? "IMPORTED" : "REVIEW_REQUIRED",
    },
  });

  return {
    successCount: approvedIds.length,
    failedCount: failedItems.length,
    approvedIds,
    failedItems,
  };
}
