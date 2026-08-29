import "server-only";
import type { Question, QuestionTranslation, PrismaClient } from "@prisma/client";

// Narrowed to just the two delegates these helpers use, reusing the real
// generated Prisma types — a hand-rolled `(args: unknown) => ...` duck-type
// doesn't structurally match Prisma's delegate methods (their `args`
// parameter isn't `unknown`), so passing the real `prisma` client fails.
type SubjectChapterClient = Pick<PrismaClient, "subject" | "chapter">;

/**
 * Compatibility shim between the old flat Question shape (body/optionA-D/
 * correctOption/explanation/status) that the Question Bank UI and API
 * routes were built against, and the new bilingual schema introduced by the
 * Test Portal merge (Question + QuestionTranslation rows, isPublished
 * boolean instead of a 3-state status). Lets the existing UI keep working
 * unchanged while the data underneath is now translation rows. Full
 * bilingual Question Bank UI is deferred to Phase D — this shim is the
 * bridge until then.
 */

export type LegacyOptionKey = "A" | "B" | "C" | "D";
type OptionsJson = Partial<Record<LegacyOptionKey, string>>;

export type LegacyQuestionInput = {
  body: string;
  type: "MCQ" | "INTEGER";
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption: string;
  explanation?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
};

export type LegacyQuestion = {
  id: string;
  body: string;
  type: "MCQ" | "INTEGER";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string;
  difficulty: string;
  tags: string[];
  subject: string | null;
  chapter: string | null;
  isPublished: boolean;
};

/** Prisma's QuestionType enum value for a legacy MCQ/INTEGER type. */
export function legacyTypeToQuestionType(type: LegacyQuestionInput["type"]) {
  return type === "MCQ" ? "SINGLE_CORRECT" : "INTEGER";
}

/** Reverse of the above, for display in the old UI vocabulary. */
export function questionTypeToLegacyType(type: string): "MCQ" | "INTEGER" {
  return type === "SINGLE_CORRECT" || type === "MULTIPLE_CORRECT" ? "MCQ" : "INTEGER";
}

export function legacyTagsToString(tags: string[]): string | null {
  return tags.length > 0 ? tags.join(",") : null;
}

export function stringToLegacyTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Build the nested ENGLISH QuestionTranslation.create payload from legacy flat input. */
export function legacyToTranslationCreate(input: LegacyQuestionInput) {
  const options: OptionsJson =
    input.type === "MCQ"
      ? {
          A: input.optionA ?? "",
          B: input.optionB ?? "",
          C: input.optionC ?? "",
          D: input.optionD ?? "",
        }
      : {};

  return {
    language: "ENGLISH",
    statement: input.body,
    options,
    correctOptionIds: [input.correctOption],
    solution: input.explanation || null,
  };
}

/** Reconstruct the old flat shape from a Question + its translations, for the existing UI/API. */
export function toLegacyQuestion(
  question: Question & { translations: QuestionTranslation[] }
): LegacyQuestion {
  const en =
    question.translations.find((t) => t.language === "ENGLISH") ?? question.translations[0] ?? null;
  const options = (en?.options as OptionsJson | null) ?? {};
  const correctOptionIds = (en?.correctOptionIds as string[] | null) ?? [];

  return {
    id: question.id,
    body: en?.statement ?? "",
    type: questionTypeToLegacyType(question.type),
    optionA: options.A ?? "",
    optionB: options.B ?? "",
    optionC: options.C ?? "",
    optionD: options.D ?? "",
    correctOption: correctOptionIds[0] ?? "",
    explanation: en?.solution ?? "",
    difficulty: question.difficulty,
    tags: stringToLegacyTags(question.tags),
    subject: question.subject,
    chapter: question.chapter,
    isPublished: question.isPublished,
  };
}

/** Look up Subject/Chapter titles by id, for storing on Question as plain strings. */
export async function resolveSubjectChapterNames(
  prisma: SubjectChapterClient,
  subjectId?: string,
  chapterId?: string
): Promise<{ subject: string; chapter: string | null }> {
  let subject = "Unclassified";
  let chapter: string | null = null;

  if (subjectId) {
    const s = await prisma.subject.findUnique({ where: { id: subjectId }, select: { title: true } });
    if (s) subject = s.title;
  }
  if (chapterId) {
    const c = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { title: true } });
    if (c) chapter = c.title;
  }

  return { subject, chapter };
}

/** Best-effort reverse lookup (title -> id) so the edit form can preselect Subject/Chapter dropdowns. */
export async function reverseResolveSubjectChapterIds(
  prisma: SubjectChapterClient,
  subjectTitle: string | null,
  chapterTitle: string | null
): Promise<{ subjectId: string; chapterId: string }> {
  let subjectId = "";
  let chapterId = "";

  if (subjectTitle) {
    const s = await prisma.subject.findFirst({ where: { title: subjectTitle }, select: { id: true } });
    if (s) subjectId = s.id;
  }
  if (chapterTitle) {
    const c = await prisma.chapter.findFirst({ where: { title: chapterTitle }, select: { id: true } });
    if (c) chapterId = c.id;
  }

  return { subjectId, chapterId };
}
