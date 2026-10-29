import { z } from "zod";

export const LECTURE_LANGUAGES = ["English", "Hindi", "Bilingual"] as const;

const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .optional()
  .transform((t) => Array.from(new Set(t ?? [])));

/** New recorded lecture (draft) — the video is uploaded to it afterwards. */
export const recordedLectureCreateSchema = z.object({
  // Same id on a retried request: the existing draft is returned, not a second one.
  requestId: z.string().trim().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(3, "Enter the lecture title").max(200),
  // Lectures are added inside a chapter; the chapter's batches decide who
  // sees them. A batch here limits the lecture to that one batch.
  batchId: z.string().trim().min(1).nullish(),
  chapterId: z.string().trim().min(1, "Choose the chapter"),
  teacherId: z.string().trim().min(1, "Choose the teacher"),
  language: z.enum(LECTURE_LANGUAGES),
  about: z.string().trim().min(1, "Write what the lecture covers").max(20000),
  lectureNumber: z.number().int().min(1).max(9999).nullish(),
  sequenceNumber: z.number().int().min(0).max(9999).nullish(),
  tags,
  additionalNotes: z.string().trim().max(5000).nullish(),
});

export const recordedLectureUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    batchId: z.string().trim().min(1),
    chapterId: z.string().trim().min(1),
    teacherId: z.string().trim().min(1),
    language: z.enum(LECTURE_LANGUAGES),
    lectureNumber: z.number().int().min(1).max(9999).nullable(),
    sequenceNumber: z.number().int().min(0).max(9999).nullable(),
    tags,
    additionalNotes: z.string().trim().max(5000).nullable(),
  })
  .partial();

export const recordedStatusSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive", "restore"]),
});

export const uploadActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("init"),
    fileName: z.string().trim().min(1).max(300),
    size: z.number().int().positive(),
    type: z.string().max(100).default(""),
    durationSec: z.number().int().min(1).max(24 * 3600).nullish(),
  }),
  z.object({ action: z.literal("sign"), partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(50) }),
  z.object({ action: z.literal("parts") }),
  z.object({
    action: z.literal("complete"),
    parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10000), etag: z.string().min(1).max(200) })).min(1).max(10000),
  }),
  z.object({ action: z.literal("abort") }),
  z.object({ action: z.literal("thumbnail"), type: z.string().max(100), size: z.number().int().positive() }),
  z.object({ action: z.literal("thumbnail-done"), key: z.string().min(1).max(300) }),
]);

export const aboutSaveSchema = z.object({
  content: z.string().max(20000),
  // The revision the editor loaded — refuses to overwrite a newer save.
  baseRevision: z.number().int().min(0),
});

export const summaryActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate") }),
  z.object({ action: z.literal("save"), summaryId: z.string().min(1), content: z.string().trim().min(1).max(30000) }),
  z.object({ action: z.literal("approve"), summaryId: z.string().min(1) }),
  z.object({ action: z.literal("publish"), summaryId: z.string().min(1) }),
  z.object({ action: z.literal("unpublish"), summaryId: z.string().min(1) }),
]);
