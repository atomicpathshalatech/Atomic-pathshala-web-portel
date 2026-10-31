import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { questionFingerprint } from "@/lib/pyq/fingerprint";
import { withNewQuestionCode } from "@/lib/questions/create-with-code";

/**
 * ATOMIC QUESTION BANK — centralized question creation service.
 *
 * Every question-producing path (manual, AI generation, PDF extraction, PYQ
 * import, NCERT, Atomic Guru, …) goes through `createQuestion()` so that the
 * three guarantees that were previously applied inconsistently now hold for
 * every source:
 *
 *   1. A `contentFingerprint` is always computed and stored (only 30 of 4,839
 *      live rows had one before this service — the AI/manual paths never set it).
 *   2. The `questionCode` is claimed with `withNewQuestionCode`'s retry-on-P2002
 *      loop, so two questions created in the same instant can no longer collide
 *      on the unique index and get silently dropped.
 *   3. Exact-content duplicates are detected before insert (idempotency): a
 *      repeated/retried submission returns the existing question instead of
 *      creating a second copy. Nothing is ever merged or deleted here — a
 *      near-duplicate only records a reversible `QuestionDuplicateCandidate`.
 *
 * This is the generalization of the one fully-correct existing path,
 * `lib/extraction/draft-importer.ts`.
 *
 * NOTE ON CONCURRENCY: full concurrency-safe exact-dedup needs a DB unique
 * index on `contentFingerprint`. That requires a migration, which is currently
 * blocked by the DIRECT_URL/DATABASE_URL split (see docs/atomic-question-bank-audit.md).
 * Until that index exists, the check below is application-level and covers the
 * common double-submit / client-retry case but not a true simultaneous race.
 */

/** One authored language of a question. `options`/`correctOptionIds` are JSON. */
export interface TranslationInput {
  language: string;
  statement: string;
  options: Prisma.InputJsonValue;
  correctOptionIds: Prisma.InputJsonValue;
  solution?: string | null;
}

/**
 * Scalar Question fields a caller may set. `questionCode` and
 * `contentFingerprint` are managed by the service, and relations
 * (`translations`, `versions`, `assets`) are passed separately.
 */
export type QuestionCreateData = Omit<
  Prisma.QuestionUncheckedCreateInput,
  "id" | "questionCode" | "contentFingerprint" | "translations" | "versions" | "assets" | "createdAt"
> & {
  id?: string;
  /**
   * Optional pre-generated code (legacy paths). Honoured as the first attempt;
   * the service reassigns it via withNewQuestionCode if another insert took it.
   */
  questionCode?: string | null;
};

export type DedupMode =
  /** Return the existing question instead of creating a duplicate (default). */
  | "block-exact"
  /** Still create, but record a QuestionDuplicateCandidate linking the pair. */
  | "warn"
  /** Skip duplicate detection entirely (use only when the caller guarantees uniqueness). */
  | "off";

export interface CreateQuestionOptions {
  /** How to handle an exact-fingerprint match already in the bank. Default "block-exact". */
  dedup?: DedupMode;
  /**
   * Pre-computed fingerprint (e.g. from the extraction snapshot). When omitted,
   * it is derived from the primary translation's statement + options.
   */
  contentFingerprint?: string | null;
  /** Nested relation creates passed straight through to Prisma. */
  versions?: Prisma.QuestionUncheckedCreateInput["versions"];
  assets?: Prisma.QuestionUncheckedCreateInput["assets"];
  /** When set, a global AuditLog row (action QUESTION_CREATE) is written. */
  auditUserId?: string | null;
  /** Extra context recorded on the audit log / duplicate note. */
  sourceLabel?: string;
}

export interface CreateQuestionResult {
  question: { id: string; questionCode: string | null };
  /** true when an existing exact duplicate was returned instead of inserting. */
  deduped: boolean;
  /** the fingerprint that was computed/used. */
  fingerprint: string;
  /** id of the existing exact match, when deduped (block-exact) or warned. */
  duplicateOfId?: string;
}

/**
 * Choose the translation used to compute the canonical fingerprint. English is
 * preferred so the same question authored in Hindi-first vs English-first still
 * fingerprints consistently; falls back to the first translation.
 */
function primaryTranslation(translations: TranslationInput[]): TranslationInput | undefined {
  if (translations.length === 0) return undefined;
  return (
    translations.find((t) => t.language?.toUpperCase() === "ENGLISH") ?? translations[0]
  );
}

function optionsRecord(options: Prisma.InputJsonValue): Record<string, string> | null {
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(options as Record<string, unknown>)) {
      out[k] = String(v ?? "");
    }
    return out;
  }
  return null;
}

/**
 * Centralized question creation. See file header for the guarantees.
 */
export async function createQuestion(
  data: QuestionCreateData,
  translations: TranslationInput[],
  options: CreateQuestionOptions = {}
): Promise<CreateQuestionResult> {
  const { dedup = "block-exact", sourceLabel } = options;

  // 1. Canonical, metadata-independent fingerprint (statement + options).
  const primary = primaryTranslation(translations);
  const fingerprint =
    options.contentFingerprint ??
    questionFingerprint(primary?.statement ?? "", primary ? optionsRecord(primary.options) : null);

  // 2. Exact-duplicate idempotency check.
  if (dedup !== "off" && fingerprint) {
    const existing = await prisma.question.findFirst({
      where: { contentFingerprint: fingerprint },
      select: { id: true, questionCode: true },
    });
    if (existing) {
      if (dedup === "block-exact") {
        // Idempotent: a retried / double submission returns the existing row.
        return {
          question: existing,
          deduped: true,
          fingerprint,
          duplicateOfId: existing.id,
        };
      }
      // "warn": create below, but remember to link the pair afterwards.
      const result = await insert(data, translations, fingerprint, options);
      await recordDuplicateCandidate(existing.id, result.question.id, primary?.language ?? "ENGLISH", sourceLabel);
      return { ...result, duplicateOfId: existing.id };
    }
  }

  return insert(data, translations, fingerprint, options);
}

/** The actual create, with a concurrency-safe questionCode claim. */
async function insert(
  data: QuestionCreateData,
  translations: TranslationInput[],
  fingerprint: string,
  options: CreateQuestionOptions
): Promise<CreateQuestionResult> {
  const question = await withNewQuestionCode(
    data.subject,
    (questionCode) =>
      prisma.question.create({
        data: {
          ...data,
          questionCode,
          contentFingerprint: fingerprint || null,
          translations: { create: translations },
          ...(options.versions ? { versions: options.versions } : {}),
          ...(options.assets ? { assets: options.assets } : {}),
        },
        select: { id: true, questionCode: true },
      }),
    // If the caller already assigned a code (legacy pre-generated paths),
    // honour it as the first attempt; the retry loop reassigns on conflict.
    typeof (data as { questionCode?: string }).questionCode === "string"
      ? (data as { questionCode?: string }).questionCode
      : undefined
  );

  if (options.auditUserId) {
    // Best-effort creation audit; never fail the create because the log failed.
    try {
      await prisma.auditLog.create({
        data: {
          userId: options.auditUserId,
          action: "QUESTION_CREATE",
          entityType: "Question",
          entityId: question.id,
          metadata: {
            questionCode: question.questionCode,
            source: options.sourceLabel ?? data.category ?? "unknown",
            fingerprint,
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* audit is non-critical */
    }
  }

  return { question, deduped: false, fingerprint };
}

/**
 * Record a reversible duplicate-candidate row (never deletes/merges). Stored
 * with questionAId < questionBId so each pair exists once, matching the
 * @@unique([questionAId, questionBId]) constraint.
 */
async function recordDuplicateCandidate(
  aId: string,
  bId: string,
  language: string,
  sourceLabel?: string
): Promise<void> {
  const [questionAId, questionBId] = aId < bId ? [aId, bId] : [bId, aId];
  try {
    await prisma.questionDuplicateCandidate.upsert({
      where: { questionAId_questionBId: { questionAId, questionBId } },
      update: {},
      create: {
        questionAId,
        questionBId,
        category: "EXACT_DUPLICATE",
        score: 100,
        method: "contentFingerprint",
        language,
        note: `Identical content fingerprint on create${sourceLabel ? ` (${sourceLabel})` : ""}.`,
        status: "PENDING",
      },
    });
  } catch {
    /* candidate logging is non-critical */
  }
}
