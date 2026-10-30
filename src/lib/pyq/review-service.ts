import { triggerQuestionVerification } from "@/lib/questions/verification-service";
import "server-only";
import { Prisma, type ExtractedQuestion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withNewQuestionCode, toQuestionType, toDifficulty, isOptionBasedType } from "@/lib/questions/create-with-code";
import { buildOccurrenceKey, formatOccurrenceLabel } from "./keys";
import { questionFingerprint } from "./fingerprint";

/**
 * Review of extracted PYQ questions. Nothing reaches the verified PYQ
 * Library without an explicit approval, and approval refuses a record that
 * is missing its exam, year, chapter, options or answer, or that has an
 * unresolved duplicate warning.
 */

export type ExtractedPatch = Partial<{
  statement: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  solution: string | null;
  imageUrl: string | null;
  pyqExamId: string | null;
  pyqYear: number | null;
  pyqSession: string | null;
  pyqShift: string | null;
  pyqPaper: string | null;
  pyqQuestionNumber: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  difficulty: string;
  questionType: string;
}>;

const LETTER = /^[A-D](,[A-D])*$/;

/** What still stops this record from being approved (empty = ready). */
export function approvalBlockers(eq: Pick<ExtractedQuestion, "statement" | "options" | "correctAnswer" | "pyqExamId" | "pyqYear" | "chapter" | "duplicateOfQuestionId" | "duplicateDecision"> & { questionType?: string }): string[] {
  const problems: string[] = [];
  const opts = (eq.options ?? {}) as Record<string, string>;
  if (!String(eq.statement || "").trim()) problems.push("Question text is empty.");
  const qType = (eq as any).questionType || "SINGLE_CORRECT";
  const needsOptions = isOptionBasedType(qType);
  if (needsOptions && ["A", "B", "C", "D"].some((k) => !String(opts[k] ?? "").trim())) {
    problems.push("All four options (A, B, C, D) are required.");
  }
  if (!LETTER.test(String(eq.correctAnswer || ""))) problems.push("Correct answer is missing.");
  if (!eq.pyqExamId) problems.push("Exam is not set.");
  if (!eq.pyqYear) problems.push("Exam year is not set.");
  if (!eq.chapter) problems.push("Chapter is not set.");
  if (eq.duplicateOfQuestionId && (!eq.duplicateDecision || eq.duplicateDecision === "PENDING")) {
    problems.push("Possible duplicate — link it to the existing question, keep it separate, or ignore the warning.");
  }
  return problems;
}

export async function updateExtracted(id: string, patch: ExtractedPatch, userId: string) {
  const eq = await prisma.extractedQuestion.findUniqueOrThrow({ where: { id } });
  if (eq.reviewDecision === "APPROVED") throw new Error("Already approved — edit the question in the Question Bank instead.");
  const data: Prisma.ExtractedQuestionUpdateInput = { isEdited: true, reviewedById: userId };
  if (patch.statement !== undefined) data.statement = patch.statement.trim();
  if (patch.options !== undefined) data.options = patch.options as unknown as Prisma.InputJsonValue;
  if (patch.correctAnswer !== undefined) {
    const a = patch.correctAnswer.toUpperCase().replace(/\s+/g, "");
    if (a && !LETTER.test(a)) throw new Error("Answer must be A, B, C or D (comma-separated for several).");
    data.correctAnswer = a;
    data.answerKeySource = "MANUAL";
  }
  if (patch.solution !== undefined) data.solution = patch.solution?.trim() || null;
  if (patch.imageUrl !== undefined) {
    data.imageUrl = patch.imageUrl;
    data.hasImage = Boolean(patch.imageUrl);
  }
  if (patch.pyqExamId !== undefined) {
    const exam = patch.pyqExamId ? await prisma.pyqExam.findUniqueOrThrow({ where: { id: patch.pyqExamId } }) : null;
    data.pyqExamRef = exam ? { connect: { id: exam.id } } : { disconnect: true };
    data.pyqExam = exam?.name ?? null;
    data.metadataMethod = "MANUAL";
  }
  if (patch.pyqYear !== undefined) {
    if (patch.pyqYear !== null && (patch.pyqYear < 1980 || patch.pyqYear > 2100)) throw new Error("Year looks wrong.");
    data.pyqYear = patch.pyqYear;
    data.metadataMethod = "MANUAL";
  }
  if (patch.pyqSession !== undefined) data.pyqSession = data.pyqMonth = patch.pyqSession?.trim() || null;
  if (patch.pyqShift !== undefined) data.pyqShift = patch.pyqShift?.trim() || null;
  if (patch.pyqPaper !== undefined) data.pyqPaper = patch.pyqPaper?.trim() || null;
  if (patch.pyqQuestionNumber !== undefined) data.pyqQuestionNumber = patch.pyqQuestionNumber?.trim() || null;
  if (patch.subject !== undefined) data.subject = patch.subject.trim() || "General";
  if (patch.chapter !== undefined) {
    data.chapter = patch.chapter?.trim() || null;
    data.needsChapterReview = !data.chapter;
  }
  if (patch.topic !== undefined) data.topic = patch.topic?.trim() || null;
  if (patch.subTopic !== undefined) data.subTopic = patch.subTopic?.trim() || null;
  if (patch.difficulty !== undefined) data.difficulty = patch.difficulty;
  if (patch.questionType !== undefined) data.questionType = patch.questionType;
  if (patch.statement !== undefined || patch.options !== undefined) {
    data.contentFingerprint = questionFingerprint(
      (data.statement as string) ?? eq.statement,
      ((data.options as Record<string, string>) ?? (eq.options as Record<string, string>)) || null
    );
  }
  const updated = await prisma.extractedQuestion.update({ where: { id }, data });
  const blockers = approvalBlockers(updated);
  return prisma.extractedQuestion.update({
    where: { id },
    data: { status: blockers.length ? "REVIEW_REQUIRED" : "EXTRACTED", reviewReasons: blockers as unknown as Prisma.InputJsonValue },
  });
}

export async function bulkSetChapter(ids: string[], subject: string, chapter: string, topic: string | null, userId: string) {
  const res = await prisma.extractedQuestion.updateMany({
    where: { id: { in: ids }, reviewDecision: "PENDING" },
    data: { subject, chapter, topic, needsChapterReview: false, isEdited: true, reviewedById: userId },
  });
  for (const id of ids) {
    const eq = await prisma.extractedQuestion.findUnique({ where: { id } });
    if (!eq || eq.reviewDecision !== "PENDING") continue;
    const b = approvalBlockers(eq);
    await prisma.extractedQuestion.update({ where: { id }, data: { status: b.length ? "REVIEW_REQUIRED" : "EXTRACTED", reviewReasons: b as unknown as Prisma.InputJsonValue } });
  }
  return res.count;
}

export async function bulkSetYear(ids: string[], examId: string, year: number, userId: string) {
  const exam = await prisma.pyqExam.findUniqueOrThrow({ where: { id: examId } });
  return prisma.extractedQuestion.updateMany({
    where: { id: { in: ids }, reviewDecision: "PENDING" },
    data: { pyqExamId: exam.id, pyqExam: exam.name, pyqYear: year, metadataMethod: "MANUAL", isEdited: true, reviewedById: userId },
  });
}

export async function resolveDuplicate(id: string, decision: "LINKED" | "KEEP_SEPARATE" | "IGNORED", userId: string) {
  const eq = await prisma.extractedQuestion.findUniqueOrThrow({ where: { id } });
  if (!eq.duplicateOfQuestionId) throw new Error("This question has no duplicate warning.");
  if (eq.reviewDecision !== "PENDING") throw new Error("Already reviewed.");
  return prisma.extractedQuestion.update({ where: { id }, data: { duplicateDecision: decision, reviewedById: userId } });
}

export async function rejectExtracted(ids: string[], userId: string) {
  const res = await prisma.extractedQuestion.updateMany({
    where: { id: { in: ids }, reviewDecision: "PENDING" },
    data: { reviewDecision: "REJECTED", reviewedById: userId, reviewedAt: new Date() },
  });
  return res.count;
}

export type ApproveOutcome = { id: string; ok: boolean; questionId?: string; linked?: boolean; problems?: string[] };

/**
 * Approves extracted questions into the PYQ Library. Each record is claimed
 * first (PENDING -> APPROVING) so a double click or two reviewers can never
 * create two bank questions or two occurrences for one record.
 * `publish`: the reviewer may publish (question.approve) — the question is
 * then usable in tests/DPPs at once; otherwise it lands as a bank DRAFT.
 */
export async function approveExtracted(ids: string[], userId: string, publish: boolean): Promise<ApproveOutcome[]> {
  const out: ApproveOutcome[] = [];
  for (const id of ids) {
    const eq = await prisma.extractedQuestion.findUnique({ where: { id }, include: { job: true, pyqExamRef: true } });
    if (!eq || eq.reviewDecision !== "PENDING") {
      out.push({ id, ok: false, problems: ["Not awaiting review."] });
      continue;
    }

    // A question approved earlier from the same or another import may be
    // identical — check again now, so the same paper twice links instead of copying.
    if (!eq.duplicateOfQuestionId && eq.contentFingerprint) {
      const same = await prisma.question.findFirst({ where: { contentFingerprint: eq.contentFingerprint }, select: { id: true } });
      if (same) {
        await prisma.extractedQuestion.update({
          where: { id },
          data: { duplicateOfQuestionId: same.id, duplicateScore: 100, duplicateDecision: "PENDING", status: "REVIEW_REQUIRED" },
        });
        eq.duplicateOfQuestionId = same.id;
        eq.duplicateDecision = "PENDING";
      }
    }

    const problems = approvalBlockers(eq);
    if (problems.length) {
      out.push({ id, ok: false, problems });
      continue;
    }
    const claimed = await prisma.extractedQuestion.updateMany({ where: { id, reviewDecision: "PENDING" }, data: { reviewDecision: "APPROVING" } });
    if (!claimed.count) {
      out.push({ id, ok: false, problems: ["Another reviewer is approving this question."] });
      continue;
    }

    try {
      const exam = eq.pyqExamRef!;
      const answers = eq.correctAnswer.split(",");
      let questionId: string;
      let linked = false;

      if (eq.duplicateDecision === "LINKED" && eq.duplicateOfQuestionId) {
        questionId = eq.duplicateOfQuestionId;
        linked = true;
      } else {
        const label = formatOccurrenceLabel({ examName: exam.name, year: eq.pyqYear, session: eq.pyqSession, shift: eq.pyqShift, paper: eq.pyqPaper });
        const now = new Date();
        const created = await withNewQuestionCode(eq.subject, (questionCode) =>
          prisma.question.create({
            data: {
              questionCode,
              subject: eq.subject,
              chapter: eq.chapter,
              topic: eq.topic,
              subTopic: eq.subTopic,
              type: toQuestionType(eq.questionType || (answers.length > 1 ? "MULTIPLE_CORRECT" : "SINGLE_CORRECT")),
              difficulty: toDifficulty(eq.difficulty),
              category: `${exam.legacyCode ?? exam.slug.toUpperCase()}_PYQ`,
              pyqExam: exam.legacyCode ?? exam.name,
              pyqYear: eq.pyqYear,
              pyqMonth: eq.pyqSession,
              pyqQuestionNumber: eq.pyqQuestionNumber,
              pyqSource: `${label} — Q.${eq.pyqQuestionNumber ?? eq.originalNumber}`,
              examLevel: exam.canonicalType === "NEET_UG" ? "NEET" : exam.canonicalType === "JEE_MAIN" ? "JEE_MAIN" : exam.canonicalType === "JEE_ADVANCED" ? "JEE_ADVANCED" : "OTHER",
              solution: eq.solution,
              imageUrl: eq.imageUrl,
              tags: ["PYQ", exam.name, String(eq.pyqYear), `Source:${eq.sourceName}`].join(", "),
              contentFingerprint: eq.contentFingerprint,
              status: publish ? "PUBLISHED" : "DRAFT",
              isPublished: publish,
              publishedAt: publish ? now : null,
              publishedById: publish ? userId : null,
              createdById: userId,
              translations: {
                create: [
                  ...(!/[ऀ-ॿ]/.test(eq.statement)
                    ? [{ language: "ENGLISH", statement: eq.statement, options: eq.options as Prisma.InputJsonValue, correctOptionIds: answers, solution: eq.solution }]
                    : []),
                  ...(eq.statementHi || /[ऀ-ॿ]/.test(eq.statement)
                    ? [{ language: "HINDI", statement: eq.statementHi || eq.statement, options: eq.options as Prisma.InputJsonValue, correctOptionIds: answers, solution: eq.solutionHi ?? eq.solution }]
                    : []),
                ],
              },
            },
          })
        );
        questionId = created.id;
        triggerQuestionVerification(created.id, { triggerSource: "PYQ_IMPORT", userId }).catch((err) => console.error("[PYQReviewService] Trigger failed:", err));
        if (eq.duplicateDecision === "KEEP_SEPARATE" && eq.duplicateOfQuestionId) {
          const [a, b] = [eq.duplicateOfQuestionId, questionId].sort();
          await prisma.questionDuplicateCandidate
            .create({ data: { questionAId: a!, questionBId: b!, category: "NEEDS_MANUAL_REVIEW", score: eq.duplicateScore ?? 0, method: "PYQ_IMPORT", language: "ENGLISH", note: "Kept separate during PYQ import review", status: "KEEP_BOTH", decidedById: userId, decidedAt: now } })
            .catch(() => undefined);
        }

        // Folder / Coaching Module Collection Association
        const collName = eq.job.sourceName?.trim() || eq.sourceName?.trim();
        if (collName) {
          try {
            let coll = await prisma.questionCollection.findFirst({ where: { name: collName } });
            if (!coll) {
              coll = await prisma.questionCollection.create({
                data: {
                  name: collName,
                  description: `Questions imported from ${eq.job.fileName || collName}`,
                  createdById: userId,
                },
              });
            }
            await prisma.questionCollectionItem.upsert({
              where: {
                collectionId_questionId: {
                  collectionId: coll.id,
                  questionId,
                },
              },
              create: {
                collectionId: coll.id,
                questionId,
                addedById: userId,
              },
              update: {},
            });
          } catch (collErr) {
            console.warn("[review-service] Failed to link question to collection:", collErr);
          }
        }
      }

      const occurrenceKey = buildOccurrenceKey({
        questionId,
        examId: exam.id,
        year: eq.pyqYear,
        session: eq.pyqSession,
        shift: eq.pyqShift,
        paper: eq.pyqPaper,
        questionNumber: eq.pyqQuestionNumber ?? String(eq.originalNumber),
      });
      await prisma.pyqOccurrence.upsert({
        where: { occurrenceKey },
        create: {
          questionId,
          examId: exam.id,
          year: eq.pyqYear,
          session: eq.pyqSession,
          shift: eq.pyqShift,
          paper: eq.pyqPaper,
          questionNumber: eq.pyqQuestionNumber ?? String(eq.originalNumber),
          sourceLabel: eq.sectionLabel ?? eq.pyqExam,
          sourceReference: eq.job.sourceReference ?? eq.job.sourceName,
          sourcePage: eq.sourcePage,
          extractionJobId: eq.jobId,
          extractedQuestionId: eq.id,
          verificationStatus: "VERIFIED",
          detectionMethod: eq.metadataMethod ?? "MANUAL",
          occurrenceKey,
          verifiedById: userId,
          verifiedAt: new Date(),
          createdById: userId,
        },
        update: { verificationStatus: "VERIFIED", verifiedById: userId, verifiedAt: new Date() },
      });

      await prisma.extractedQuestion.update({
        where: { id },
        data: { reviewDecision: "APPROVED", status: "IMPORTED", draftQuestionId: questionId, reviewedById: userId, reviewedAt: new Date() },
      });
      out.push({ id, ok: true, questionId, linked });
    } catch (err) {
      await prisma.extractedQuestion.update({ where: { id }, data: { reviewDecision: "PENDING" } }).catch(() => undefined);
      out.push({ id, ok: false, problems: [err instanceof Error ? err.message : String(err)] });
    }
  }
  return out;
}

/** CSV of every extracted question in an import with its review state. */
export async function importReportCsv(jobId: string): Promise<string> {
  const rows = await prisma.extractedQuestion.findMany({ where: { jobId }, orderBy: [{ sourcePage: "asc" }, { originalNumber: "asc" }] });
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;
  const head = ["Source page", "Q.No", "Exam", "Year", "Session", "Shift", "Paper", "Subject", "Chapter", "Topic", "Answer", "Method", "Metadata", "Review", "Duplicate", "Issues", "Question"];
  const lines = rows.map((r) =>
    [r.sourcePage, r.originalNumber, r.pyqExam, r.pyqYear, r.pyqSession, r.pyqShift, r.pyqPaper, r.subject, r.chapter, r.topic, r.correctAnswer, r.extractionMethod, r.metadataMethod, r.reviewDecision, r.duplicateOfQuestionId ? `${r.duplicateScore}% (${r.duplicateDecision})` : "", ((r.reviewReasons as string[] | null) ?? []).join(" | "), r.statement.slice(0, 200)]
      .map(esc)
      .join(",")
  );
  return [head.map(esc).join(","), ...lines].join("\r\n");
}
