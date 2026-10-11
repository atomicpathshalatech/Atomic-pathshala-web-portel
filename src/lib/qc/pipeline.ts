import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DIRECTOR_PROMPT_VERSION, EXPERT_PROMPT_VERSION } from "./agents";
import { derivedLabel } from "./decide";
import { callQcModel, type QcModelUsage } from "./model";
import { normalizeAnswerKeys, qcContentHash, toQcQuestion, type QcQuestionInput } from "./question";
import { findNcertPassages, renderPassages } from "./references";
import { QcReviewError, reviewQuestion } from "./review";

/**
 * Runs QC Expert + QC Director on a Question Bank row and stores everything:
 * both reviews, every finding with the Director's verdict, proposed
 * corrections, model usage, and the question's QC status.
 *
 * The question's content is never changed here. A correction is a proposal;
 * applyCorrection() (a person's decision) is the only thing that edits a
 * question, and it keeps the previous version.
 */

const QUESTION_SELECT = {
  id: true,
  questionCode: true,
  subject: true,
  chapter: true,
  topic: true,
  subTopic: true,
  microConcept: true,
  type: true,
  difficulty: true,
  examLevel: true,
  imageUrl: true,
  solution: true,
  version: true,
  translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
} satisfies Prisma.QuestionSelect;

export async function loadQcQuestion(questionId: string): Promise<QcQuestionInput | null> {
  const row = await prisma.question.findUnique({ where: { id: questionId }, select: QUESTION_SELECT });
  return row ? toQcQuestion({ ...row, type: String(row.type), difficulty: String(row.difficulty) }) : null;
}

export type QcRunResult = {
  questionId: string;
  status: "VERIFIED" | "FAILED" | "NEEDS_HUMAN_REVIEW" | "ERROR" | "SKIPPED";
  reused: boolean;
  message?: string;
  findings?: number;
  corrections?: number;
};

const json = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;

async function logUsage(usage: QcModelUsage[], questionId: string) {
  if (usage.length === 0) return;
  await prisma.aiUsageLog
    .createMany({
      data: usage.map((u) => ({
        feature: u.feature,
        provider: u.provider,
        model: u.model,
        questionId,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        durationMs: u.durationMs,
        ok: u.ok,
        error: u.error ?? null,
      })),
    })
    .catch((err) => console.warn("[qc_usage_log_warning]", err instanceof Error ? err.message : err));
}

export async function runQcForQuestion(questionId: string, runById: string | null, opts: { force?: boolean } = {}): Promise<QcRunResult> {
  const q = await loadQcQuestion(questionId);
  if (!q) return { questionId, status: "SKIPPED", reused: false, message: "The question has no readable text." };
  const contentHash = qcContentHash(q);

  // A finished review of exactly this content is reused (the hash changes with any edit).
  if (!opts.force) {
    const current = await prisma.question.findUnique({ where: { id: questionId }, select: { qcStatus: true, qcHash: true } });
    if (current?.qcHash === contentHash && current.qcStatus && ["VERIFIED", "FAILED", "NEEDS_HUMAN_REVIEW"].includes(current.qcStatus)) {
      return { questionId, status: current.qcStatus as QcRunResult["status"], reused: true };
    }
  }

  const passages = await findNcertPassages(q);
  const references = passages.map((p) => ({ index: p.index, documentId: p.documentId, pageId: p.pageId, className: p.className, subject: p.subject, chapter: p.chapter, pageNumber: p.pageNumber, fileName: p.fileName, excerpt: p.excerpt }));

  try {
    const r = await reviewQuestion(q, renderPassages(passages), callQcModel);
    const expertUsage = r.usage.filter((u) => u.feature === "QC_EXPERT");
    const directorUsage = r.usage.filter((u) => u.feature !== "QC_EXPERT");
    const sum = (list: QcModelUsage[], key: "inputTokens" | "outputTokens" | "durationMs") => list.reduce((n, u) => n + (u[key] ?? 0), 0);
    // The passage the Expert pointed at — taken from our list, never from the model's words.
    const supporting = r.expert.output.ncert.supportingPassage ? references.find((p) => p.index === r.expert.output.ncert.supportingPassage) ?? null : null;
    const directorFindings = [...r.director.solve.findings, ...r.director.audit.additionalFindings];

    const counts = await prisma.$transaction(async (tx) => {
      const expertReview = await tx.qcReview.create({
        data: {
          questionId,
          agent: "EXPERT",
          status: r.expertStatus.status,
          contentHash,
          model: r.expert.model,
          promptVersion: EXPERT_PROMPT_VERSION,
          storedAnswer: q.storedAnswer.join(", ") || null,
          derivedAnswer: derivedLabel(r.expert.output.derivedAnswer),
          answerMatches: r.expertStatus.comparison === "UNDETERMINED" ? null : r.expertStatus.comparison === "MATCH",
          result: json({ ...r.expert.output, statusReasons: r.expertStatus.reasons, supportingReference: supporting }),
          calcChecks: json(r.expert.calc),
          references: json(references),
          modelConfidence: r.expert.output.confidence,
          inputTokens: sum(expertUsage, "inputTokens"),
          outputTokens: sum(expertUsage, "outputTokens"),
          durationMs: sum(expertUsage, "durationMs"),
          runById,
        },
      });

      for (const f of r.structural) {
        await tx.qcFinding.create({
          data: { reviewId: expertReview.id, questionId, source: "SYSTEM", category: f.category, severity: f.severity, description: f.description, evidence: f.evidence ?? null },
        });
      }
      const expertFindingIds: string[] = [];
      for (let i = 0; i < r.expert.output.findings.length; i++) {
        const f = r.expert.output.findings[i]!;
        const verdict = r.director.audit.verdicts.find((v) => v.finding === i + 1);
        const row = await tx.qcFinding.create({
          data: {
            reviewId: expertReview.id,
            questionId,
            source: "EXPERT",
            category: f.category,
            severity: f.severity,
            description: f.description,
            evidence: f.evidence ?? null,
            proposedCorrection: f.correction ? json(f.correction) : Prisma.JsonNull,
            directorDecision: verdict?.decision ?? null,
            directorReason: verdict?.reason ?? null,
            finalAction: verdict?.finalAction ?? null,
          },
        });
        expertFindingIds.push(row.id);
      }

      const directorReview = await tx.qcReview.create({
        data: {
          questionId,
          agent: "DIRECTOR",
          status: r.decision.status === "VERIFIED" ? "PASS" : r.decision.status === "FAILED" ? "FAIL" : "NEEDS_HUMAN_REVIEW",
          contentHash,
          model: r.director.model,
          promptVersion: DIRECTOR_PROMPT_VERSION,
          storedAnswer: q.storedAnswer.join(", ") || null,
          derivedAnswer: derivedLabel(r.director.solve.derivedAnswer),
          answerMatches: r.decision.directorVsStored === "UNDETERMINED" ? null : r.decision.directorVsStored === "MATCH",
          result: json({ solve: r.director.solve, audit: r.director.audit, decision: r.decision, sameModelAsExpert: r.director.sameModelAsExpert }),
          calcChecks: json(r.director.solveCalc),
          modelConfidence: r.director.solve.confidence,
          inputTokens: sum(directorUsage, "inputTokens"),
          outputTokens: sum(directorUsage, "outputTokens"),
          durationMs: sum(directorUsage, "durationMs"),
          expertReviewId: expertReview.id,
          runById,
        },
      });
      const directorFindingIds: string[] = [];
      for (const f of directorFindings) {
        const row = await tx.qcFinding.create({
          data: {
            reviewId: directorReview.id,
            questionId,
            source: "DIRECTOR",
            category: f.category,
            severity: f.severity,
            description: f.description,
            evidence: f.evidence ?? null,
            proposedCorrection: f.correction ? json(f.correction) : Prisma.JsonNull,
          },
        });
        directorFindingIds.push(row.id);
      }

      // Proposals made for an older version of the question no longer apply.
      await tx.qcCorrection.updateMany({ where: { questionId, status: "PROPOSED", contentHash: { not: contentHash } }, data: { status: "STALE" } });
      await tx.qcCorrection.deleteMany({ where: { questionId, status: "PROPOSED", contentHash } });
      for (const c of r.corrections) {
        const [who, n] = c.from.split(":");
        const findingId = (who === "EXPERT" ? expertFindingIds : directorFindingIds)[Number(n) - 1] ?? null;
        await tx.qcCorrection.create({
          data: {
            questionId,
            findingId,
            contentHash,
            field: c.field,
            language: c.language ?? (["solution", "statement", "options"].includes(c.field) ? q.language : null),
            originalValue: c.originalValue,
            proposedValue: c.proposedValue,
            reason: c.partial ? `${c.reason} (The Director only partly confirmed the finding behind this.)` : c.reason,
            evidence: c.evidence ?? null,
          },
        });
      }

      await tx.question.update({ where: { id: questionId }, data: { qcStatus: r.decision.status, qcHash: contentHash, qcReviewedAt: new Date() } });
      return { findings: r.structural.length + r.expert.output.findings.length + directorFindings.length, corrections: r.corrections.length };
    });

    await logUsage(r.usage, questionId);
    return { questionId, status: r.decision.status, reused: false, ...counts };
  } catch (err) {
    const stage = err instanceof QcReviewError ? err.stage : "EXPERT";
    const usage = err instanceof QcReviewError ? err.usage : [];
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
    // An unfinished review is recorded as such; the question is never marked verified.
    await prisma.qcReview
      .create({
        data: {
          questionId,
          agent: stage,
          status: "ERROR",
          contentHash,
          model: usage[usage.length - 1]?.model ?? "unknown",
          promptVersion: stage === "EXPERT" ? EXPERT_PROMPT_VERSION : DIRECTOR_PROMPT_VERSION,
          storedAnswer: q.storedAnswer.join(", ") || null,
          result: json(err instanceof QcReviewError && err.partial?.expert ? { expert: err.partial.expert.output, expertStatus: err.partial.expertStatus } : {}),
          errorMessage: message,
          runById,
        },
      })
      .catch(() => undefined);
    await prisma.question.update({ where: { id: questionId }, data: { qcStatus: "ERROR", qcHash: contentHash, qcReviewedAt: new Date() } }).catch(() => undefined);
    await logUsage(usage, questionId);
    return { questionId, status: "ERROR", reused: false, message };
  }
}

/** Fields a correction can be written back to automatically. Others are approved and then edited by hand. */
const AUTO_APPLY_FIELDS = new Set(["correctAnswer", "solution", "topic", "subTopic", "microConcept", "difficulty"]);

export class CorrectionError extends Error {}

/**
 * A person's decision on a proposed correction.
 * approve → the question is edited (the previous version is kept in
 * QuestionVersion) for the fields that can be written back; for statement /
 * options the proposal is marked APPROVED for a person to edit in the editor.
 * reject  → nothing changes.
 */
export async function decideCorrection(correctionId: string, userId: string, action: "approve" | "reject", note?: string) {
  const correction = await prisma.qcCorrection.findUnique({ where: { id: correctionId } });
  if (!correction) throw new CorrectionError("Correction not found.");
  if (correction.status !== "PROPOSED") throw new CorrectionError(`This correction is already ${correction.status.toLowerCase()}.`);

  if (action === "reject") {
    return prisma.qcCorrection.update({ where: { id: correctionId }, data: { status: "REJECTED", decidedById: userId, decidedAt: new Date(), decisionNote: note ?? null } });
  }

  const question = await prisma.question.findUnique({ where: { id: correction.questionId }, include: { translations: true } });
  if (!question) throw new CorrectionError("The question no longer exists.");
  const current = toQcQuestion({ ...question, type: String(question.type), difficulty: String(question.difficulty) });
  if (!current || qcContentHash(current) !== correction.contentHash) {
    await prisma.qcCorrection.update({ where: { id: correctionId }, data: { status: "STALE" } });
    throw new CorrectionError("The question was edited after this correction was proposed. Run QC again on the current version.");
  }

  if (!AUTO_APPLY_FIELDS.has(correction.field)) {
    return prisma.qcCorrection.update({
      where: { id: correctionId },
      data: { status: "APPROVED", decidedById: userId, decidedAt: new Date(), decisionNote: note ?? "Approved — edit the question text in the question editor." },
    });
  }

  const proposed = correction.proposedValue.trim();
  let answerKeys: string[] | null = null;
  if (correction.field === "correctAnswer") {
    const isValue = current.options.length === 0;
    answerKeys = isValue ? [proposed] : normalizeAnswerKeys(proposed.split(/[,\s/&]+|\band\b/i).map((s) => s.replace(/[^A-Za-z0-9.+-]/g, "")).filter(Boolean));
    const valid = new Set(current.options.map((o) => o.key));
    if (!isValue && (answerKeys.length === 0 || answerKeys.some((k) => !valid.has(k)))) {
      throw new CorrectionError(`"${proposed}" is not a valid answer key for this question's options (${[...valid].join(", ")}).`);
    }
  }
  if (correction.field === "difficulty" && !["EASY", "MEDIUM", "HARD"].includes(proposed.toUpperCase())) {
    throw new CorrectionError(`"${proposed}" is not a difficulty.`);
  }

  const versionNumber = question.version || 1;
  return prisma.$transaction(async (tx) => {
    // The version before this change (skipped if that version number is already saved).
    const saved = await tx.questionVersion.findUnique({ where: { questionId_versionNumber: { questionId: question.id, versionNumber } } });
    if (!saved) {
      await tx.questionVersion.create({
        data: {
          questionId: question.id,
          versionNumber,
          editedById: userId,
          reason: `QC correction (${correction.field}): ${correction.reason}`.slice(0, 500),
          changeType: "QC_CORRECTION",
          snapshot: json({
            subject: question.subject,
            chapter: question.chapter,
            topic: question.topic,
            subTopic: question.subTopic,
            microConcept: question.microConcept,
            difficulty: question.difficulty,
            type: question.type,
            questionCode: question.questionCode,
            translations: question.translations,
          }),
        },
      });
    }

    if (correction.field === "correctAnswer" && answerKeys) {
      // The key is the same in every language of the question.
      await tx.questionTranslation.updateMany({ where: { questionId: question.id }, data: { correctOptionIds: answerKeys } });
    } else if (correction.field === "solution") {
      const lang = (correction.language ?? current.language).toUpperCase();
      const target = question.translations.find((t) => t.language.toUpperCase() === lang);
      if (!target) throw new CorrectionError(`The question has no ${lang} version to put the solution in.`);
      await tx.questionTranslation.update({ where: { id: target.id }, data: { solution: proposed } });
    }
    await tx.question.update({
      where: { id: question.id },
      data: {
        ...(correction.field === "topic" && { topic: proposed }),
        ...(correction.field === "subTopic" && { subTopic: proposed }),
        ...(correction.field === "microConcept" && { microConcept: proposed }),
        ...(correction.field === "difficulty" && { difficulty: proposed.toUpperCase() as never }),
        version: versionNumber + 1,
        editedById: userId,
        editedAt: new Date(),
        // The content changed: it has to be reviewed again before it counts as verified.
        qcStatus: "UNREVIEWED",
        needsReaudit: true,
      },
    });
    // Open proposals for OTHER fields still describe the question correctly, so they
    // stay open (moved to the new content); another proposal for this same field does not.
    const updated = await tx.question.findUnique({ where: { id: question.id }, include: { translations: true } });
    const next = updated ? toQcQuestion({ ...updated, type: String(updated.type), difficulty: String(updated.difficulty) }) : null;
    const open = { questionId: question.id, status: "PROPOSED", id: { not: correctionId } };
    await tx.qcCorrection.updateMany({ where: next ? { ...open, field: correction.field } : open, data: { status: "STALE" } });
    if (next) await tx.qcCorrection.updateMany({ where: { ...open, field: { not: correction.field } }, data: { contentHash: qcContentHash(next) } });
    return tx.qcCorrection.update({
      where: { id: correctionId },
      data: { status: "APPLIED", decidedById: userId, decidedAt: new Date(), decisionNote: note ?? null, appliedVersion: versionNumber + 1 },
    });
  });
}
