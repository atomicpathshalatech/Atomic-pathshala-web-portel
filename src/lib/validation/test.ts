import { z } from "zod";

export const testCreateSchema = z.object({
  batchScheduleId: z.string().min(1, "batchScheduleId is required"),
  title: z.string().min(1, "Title is required").max(200),
  instructions: z.string().max(4000).optional(),
  durationMin: z.number().int().min(1, "Duration must be at least 1 minute").max(600),
});
export type TestCreateInput = z.infer<typeof testCreateSchema>;

export const testUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().max(4000).optional(),
  durationMin: z.number().int().min(1).max(600).optional(),
});

export const testQuestionsAddSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1, "Pick at least one question").max(200),
});

export const testAnswerUpsertSchema = z.object({
  questionId: z.string().min(1),
  // MCQ answers are a single letter key (A/B/C/D); INTEGER-type questions
  // store the typed numeric answer as a string instead — so this stays a
  // generic bounded string rather than a 4-char MCQ-only key. null
  // explicitly clears a previously-saved answer (student changed their mind
  // back to "skip").
  selectedOption: z.string().min(1).max(20).nullable(),
});

export const TEST_STATUS_OPTIONS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
