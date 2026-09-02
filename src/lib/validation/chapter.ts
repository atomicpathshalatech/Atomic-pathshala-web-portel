import { z } from "zod";

export const MEDIUM_VALUES = ["HINDI", "ENGLISH", "HINGLISH"] as const;
export type MediumValue = (typeof MEDIUM_VALUES)[number];

export const chapterSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  courseId: z.string().optional(),
  subjectId: z.string().min(1, "Subject is required"),
  medium: z.enum(MEDIUM_VALUES).default("ENGLISH"),
  order: z.coerce.number().int().min(0).default(0),
  description: z.string().trim().max(4000).optional(),
  learningObjectives: z.string().trim().max(4000).optional(),
  prerequisites: z.string().trim().max(2000).optional(),
});
export type ChapterInput = z.infer<typeof chapterSchema>;

export const chapterUpdateSchema = chapterSchema.partial();
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;

export const CHAPTER_STATUS_VALUES = [
  "DRAFT",
  "LECTURES_IN_PROGRESS",
  "LECTURES_COMPLETE",
  "TESTS_PENDING",
  "READY_TO_PUBLISH",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const chapterStatusTransitionSchema = z.object({
  status: z.enum(CHAPTER_STATUS_VALUES),
});
export type ChapterStatusTransitionInput = z.infer<typeof chapterStatusTransitionSchema>;

// POST /api/team/chapters/:id/review — admin decision on a chapter that is
// UNDER_REVIEW. REJECT/REQUEST_CHANGES require a comment (spec: reviewer
// must explain what's wrong); APPROVE's comment is optional.
export const CHAPTER_REVIEW_ACTIONS = ["APPROVE", "REJECT", "REQUEST_CHANGES"] as const;
export const chapterReviewDecisionSchema = z
  .object({
    action: z.enum(CHAPTER_REVIEW_ACTIONS),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.action === "APPROVE" || Boolean(data.comment?.length), {
    message: "A comment is required when rejecting or requesting changes.",
    path: ["comment"],
  });
export type ChapterReviewDecisionInput = z.infer<typeof chapterReviewDecisionSchema>;
