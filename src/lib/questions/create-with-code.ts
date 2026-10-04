import { Prisma } from "@prisma/client";
import { QuestionType, Difficulty } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateQuestionId } from "./id-generator";

/**
 * Every new Question gets its 8-digit Question ID (questionCode) here.
 *
 * generateQuestionId() reads the highest code and adds one — two questions
 * created at the same moment (an AI batch, a PDF import and a teacher saving)
 * got the SAME code; the second insert failed on the unique index, and the
 * AI worker swallowed that error, so questions silently went missing. Several
 * create paths also never assigned a code at all. This claims a code and
 * retries with a fresh one if another insert took it first.
 */
export async function withNewQuestionCode<T>(subject: string | null | undefined, create: (questionCode: string) => Promise<T>, firstCode?: string): Promise<T> {
  let code = firstCode ?? (await generateQuestionId(prisma, subject));
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await create(code);
    } catch (err) {
      if (!isQuestionCodeConflict(err) || attempt === 7) throw err;
      // Someone else claimed it — back off a little and take the next free one.
      await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 80)));
      code = await generateQuestionId(prisma, subject);
    }
  }
  throw new Error("Could not assign a Question ID.");
}

function isQuestionCodeConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((f) => f.includes("questionCode") || f.includes("question_code"));
}

/** One mapping from the many AI / extractor type names to the Question.type enum. */
export function toQuestionType(t?: string | null): QuestionType {
  const upper = (t || "").toUpperCase().replace(/[\s-]+/g, "_");
  if ((upper.includes("MULTI") && upper.includes("CORRECT")) || upper === "MULTIPLE_CHOICE_MULTIPLE") return QuestionType.MULTIPLE_CORRECT;
  if (upper.includes("INTEGER")) return QuestionType.INTEGER;
  if (upper.includes("NUMERICAL")) return QuestionType.NUMERICAL;
  if (upper.includes("ASSERTION")) return QuestionType.ASSERTION_REASON;
  if (upper.includes("MATCH")) return QuestionType.MATCH_COLUMN;
  if (upper.includes("STATEMENT")) return QuestionType.STATEMENT_BASED;
  return QuestionType.SINGLE_CORRECT;
}

export function toDifficulty(d?: string | null): Difficulty {
  const upper = (d || "").toUpperCase();
  if (upper === "EASY") return Difficulty.EASY;
  if (upper === "HARD" || upper === "ULTRA" || upper === "VERY_HARD") return Difficulty.HARD;
  return Difficulty.MEDIUM;
}

/** Answer-free types (the student types a number) — everything else must have options + a correct option. */
export function isOptionBasedType(t?: string | null): boolean {
  const type = toQuestionType(t);
  return type !== QuestionType.INTEGER && type !== QuestionType.NUMERICAL;
}

/**
 * A question is ready for tests / DPPs once it is published. Older rows were
 * sometimes published with the toggle (isPublished = true) while `status`
 * stayed at its review stage, so either flag counts.
 */
export function isUsableQuestion(q: { isPublished: boolean; status: string }): boolean {
  return q.isPublished || q.status === "PUBLISHED";
}
