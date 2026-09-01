import { z } from "zod";

export const chapterSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  subjectId: z.string().min(1, "Subject is required"),
  order: z.coerce.number().int().min(0).default(0),
});
export type ChapterInput = z.infer<typeof chapterSchema>;

export const CHAPTER_STATUS_VALUES = [
  "DRAFT",
  "LECTURES_IN_PROGRESS",
  "LECTURES_COMPLETE",
  "TESTS_PENDING",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const chapterStatusTransitionSchema = z.object({
  status: z.enum(CHAPTER_STATUS_VALUES),
});
export type ChapterStatusTransitionInput = z.infer<typeof chapterStatusTransitionSchema>;
