import { z } from "zod";

export const LANGUAGE_OPTIONS = ["English", "Hindi", "Hinglish"] as const;

/**
 * `teacherId` is optional here on purpose: for the common case (a teacher
 * uploading their own lecture) the API route resolves it server-side from
 * the signed-in user's own Teacher profile and ignores whatever the client
 * sent. It's only read from the body when the caller has no Teacher profile
 * of their own (an admin-tier user attributing the lecture to someone else)
 * — see the POST route for the exact rule.
 */
export const lectureCreateSchema = z.object({
  chapterId: z.string().min(1, "Chapter is required"),
  teacherId: z.string().min(1).optional(),
  title: z.string().min(1, "Title is required").max(200),
  language: z.enum(LANGUAGE_OPTIONS).default("English"),
  order: z.number().int().min(0).max(9999).default(0),
  videoUrl: z.string().url("Enter a valid video URL").max(2000),
  educatorVideoUrl: z.string().url("Enter a valid video URL").max(2000).optional().or(z.literal("")),
  slidesUrl: z.string().url("Enter a valid URL").max(2000).optional().or(z.literal("")),
});
export type LectureCreateInput = z.infer<typeof lectureCreateSchema>;

export const lectureUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  language: z.enum(LANGUAGE_OPTIONS).optional(),
  order: z.number().int().min(0).max(9999).optional(),
  videoUrl: z.string().url("Enter a valid video URL").max(2000).optional(),
  educatorVideoUrl: z.string().url("Enter a valid video URL").max(2000).optional().or(z.literal("")),
  slidesUrl: z.string().url("Enter a valid URL").max(2000).optional().or(z.literal("")),
});
export type LectureUpdateInput = z.infer<typeof lectureUpdateSchema>;

export const lectureIssueReportSchema = z.object({
  note: z.string().min(1, "Please describe the issue").max(2000),
});
export type LectureIssueReportInput = z.infer<typeof lectureIssueReportSchema>;

export const LECTURE_STATUS_OPTIONS = ["DRAFT", "PUBLISHED"] as const;
