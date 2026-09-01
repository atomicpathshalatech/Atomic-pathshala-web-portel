import { z } from "zod";

export const questionTypeEnumV2 = z.enum([
  "SINGLE_CORRECT",
  "MULTIPLE_CORRECT",
  "INTEGER",
  "NUMERICAL",
  "STATEMENT_BASED",
  "MATCH_COLUMN",
  "ASSERTION_REASON",
]);
export const difficultyEnumV2 = z.enum(["EASY", "MEDIUM", "HARD"]);
export const languageEnumV2 = z.enum(["HINDI", "ENGLISH"]);

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export const translationSchema = z.object({
  language: languageEnumV2,
  statement: z.string().trim().min(5, "Question text should be at least 5 characters"),
  optionA: z.string().trim().optional().or(z.literal("")),
  optionB: z.string().trim().optional().or(z.literal("")),
  optionC: z.string().trim().optional().or(z.literal("")),
  optionD: z.string().trim().optional().or(z.literal("")),
  correctOptionIds: z.array(z.string()).min(1, "Mark at least one correct answer"),
  solution: z.string().trim().optional().or(z.literal("")),
});

/**
 * Full bilingual Question Bank v2 schema — replaces the flat single-
 * language shim (`@/lib/validation/question.ts`) that Phase A's Question
 * Bank UI was built against. A question can carry one or both of
 * Hindi/English as separate QuestionTranslation rows, plus the PYQ/
 * classification fields the source Test Portal schema added.
 */
export const bilingualQuestionSchema = z
  .object({
    type: questionTypeEnumV2.default("SINGLE_CORRECT"),
    difficulty: difficultyEnumV2.default("MEDIUM"),
    subjectId: z.string().optional().or(z.literal("")),
    chapterId: z.string().optional().or(z.literal("")),
    topic: z.string().trim().max(200).optional().or(z.literal("")),
    subTopic: z.string().trim().max(200).optional().or(z.literal("")),
    category: z.string().trim().max(120).optional().or(z.literal("")),
    pyqSource: z.string().trim().max(200).optional().or(z.literal("")),
    questionCode: z.string().trim().max(60).optional().or(z.literal("")),
    tags: z.array(z.string()).default([]),
    translations: z.array(translationSchema).min(1, "Add at least one language"),
  })
  .superRefine((data, ctx) => {
    const needsOptions = data.type !== "INTEGER" && data.type !== "NUMERICAL";
    data.translations.forEach((t, i) => {
      if (needsOptions && (!t.optionA || !t.optionB)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options A and B are required for this question type",
          path: ["translations", i, "optionA"],
        });
      }
    });
    const languages = data.translations.map((t) => t.language);
    if (new Set(languages).size !== languages.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each language can only be added once",
        path: ["translations"],
      });
    }
  });

export type BilingualQuestionInput = z.infer<typeof bilingualQuestionSchema>;
