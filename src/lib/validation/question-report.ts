import { z } from "zod";

// Mirrors the source Test Portal's ReportQuestionButton reason set.
export const QUESTION_REPORT_REASONS = [
  "WRONG_ANSWER",
  "INCORRECT_QUESTION",
  "IMAGE_MISSING",
  "TYPO",
  "WRONG_OPTION",
  "WRONG_SOLUTION",
  "LANGUAGE_ISSUE",
  "OUT_OF_SYLLABUS",
  "DUPLICATE_QUESTION",
  "OTHER",
] as const;

export const questionReportCreateSchema = z.object({
  testId: z.string().optional(),
  reasonTags: z.array(z.enum(QUESTION_REPORT_REASONS)).min(1, "Select at least one issue."),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
});

export type QuestionReportCreateInput = z.infer<typeof questionReportCreateSchema>;

export const QUESTION_REPORT_STATUSES = ["NEW", "CLAIMED", "RESOLVED", "REJECTED"] as const;
export const QUESTION_REPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const questionReportUpdateSchema = z.object({
  action: z.enum(["CLAIM", "UNCLAIM", "RESOLVE", "REJECT", "NOTE"]),
  teacherNotes: z.string().trim().max(2000).optional(),
  priority: z.enum(QUESTION_REPORT_PRIORITIES).optional(),
});

export type QuestionReportUpdateInput = z.infer<typeof questionReportUpdateSchema>;
