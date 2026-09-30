import { z } from "zod";

/**
 * `Doubt.subject` is a free-text `String?` in the schema (not a Prisma
 * enum), but the create form is constrained to this fixed list for a
 * consistent dropdown rather than free-typed subject names that would be
 * hard to filter/report on later. Kept as `SUBJECT_OPTIONS` — the name the
 * existing `DoubtForm.tsx` already imports.
 */
export const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Biology", "Mathematics", "General/Foundation"] as const;

// Uploads come back as an absolute object-storage URL, or as a root-relative
// "/uploads/..." path when the app runs with the local-disk fallback.
const uploadedUrl = z
  .string()
  .max(2048)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/uploads/"), "Invalid upload URL");

export const doubtCreateSchema = z
  .object({
    subject: z.enum(SUBJECT_OPTIONS).optional(),
    // May be left empty only when the student attached a photo or a voice
    // note instead (see the refine below) — the route then stores a short
    // placeholder since Doubt.body is required.
    body: z.string().trim().max(2000, "Keep it under 2000 characters").default(""),
    // Optional + defaulted so the existing DoubtForm (which doesn't send this
    // field at all) keeps working unchanged — it just always creates NORMAL
    // priority doubts, same as before this field existed.
    priority: z.enum(["NORMAL", "HIGH"]).default("NORMAL"),
    // Set by DoubtForm after it uploads the student's photo via
    // /api/doubts/attachment — never a raw file here, just the resulting URL.
    attachmentUrl: uploadedUrl.optional().or(z.literal("")),
    // Set only when a doubt is submitted from inside the Classroom module's
    // Doubt sidebar panel — reuses this exact inbox/queue rather than a
    // separate Classroom-only doubt system. Validated against real access in
    // the route (never trusted as-is), same caution as any other client id.
    classroomSessionId: z.string().cuid().optional(),
    // Set by the recorded-class player's Doubt tab. The schedule id is
    // checked against the student's batch access in the route, like
    // classroomSessionId above.
    batchScheduleId: z.string().min(1).max(64).optional(),
    videoTimestampSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
    studentVoiceUrl: uploadedUrl.optional(),
    studentVoiceDurationSec: z.number().int().min(1).max(600).optional(),
  })
  .refine((d) => d.body.length >= 10 || Boolean(d.attachmentUrl) || Boolean(d.studentVoiceUrl), {
    message: "Describe your doubt in at least 10 characters, or attach a photo / voice note",
    path: ["body"],
  });

export type DoubtCreateInput = z.infer<typeof doubtCreateSchema>;

/**
 * Restored verbatim — used by the team-side resolve route
 * (`/api/team/doubts/[id]/resolve`), which was already live before this
 * update package and must keep working unchanged.
 */
export const doubtResolveSchema = z.object({
  status: z.enum(["RESOLVED", "FLAGGED"]),
  expertExplanation: z.string().optional(),
  videoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  voiceUrl: z.string().url("Enter a valid voice URL").optional().or(z.literal("")).nullable(),
  voiceDurationSec: z.number().int().nonnegative().optional().nullable(),
});

export type DoubtResolveInput = z.infer<typeof doubtResolveSchema>;
