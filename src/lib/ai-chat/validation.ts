import { z } from "zod";

/**
 * Trimmed port of `_import_atomic-ai-chat`'s `auth-schemas.ts`. Dropped
 * credentialsSchema/signUpSchema/forgotPasswordSchema/resetPasswordSchema —
 * all only served the source app's own credentials-auth flow, which isn't
 * ported (AI Chat authenticates through atomic-ops's existing User).
 */

export const languageSchema = z.enum(["english", "hindi", "hinglish"]);
export const targetSchema = z.enum(["NEET", "JEE", "Board", "Other"]);
export const atomicBatchSchema = z.enum([
  "SELECTION_PRO",
  "SELECTION_1_0",
  "ARAMBH",
  "MANZIL",
  "UDAAN",
  "NO_BATCH",
]);

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  className: z.string().trim().max(60).nullable().optional(),
  target: targetSchema.optional(),
  atomicBatch: atomicBatchSchema.optional(),
  board: z.string().trim().max(80).nullable().optional(),
  preferredLanguage: languageSchema.optional(),
  preferredTeachers: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  strongChapters: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  weakChapters: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  favoriteSubject: z.string().trim().max(80).nullable().optional(),
  learningPreferences: z.record(z.string(), z.unknown()).nullable().optional(),
  recentActivity: z.unknown().nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: languageSchema.optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
});

export const classScheduleSchema = z.object({
  batch: atomicBatchSchema,
  classDate: z.string().min(1, "Date is required."),
  startTime: z.string().min(1, "Start time is required."),
  endTime: z.string().optional(),
  subject: z.string().trim().min(1, "Subject is required.").max(60),
  teacherName: z.string().trim().max(80).optional(),
  teacherPhotoUrl: z.string().trim().url("Enter a valid image URL.").optional().or(z.literal("")),
  topic: z.string().trim().min(1, "Topic is required.").max(200),
  youtubeLink: z.string().trim().url("Enter a valid URL.").optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});
