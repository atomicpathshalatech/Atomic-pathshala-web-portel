import { z } from "zod";

/**
 * `Doubt.subject` is a free-text `String?` in the schema (not a Prisma
 * enum), but the create form is constrained to this fixed list for a
 * consistent dropdown rather than free-typed subject names that would be
 * hard to filter/report on later. Kept as `SUBJECT_OPTIONS` — the name the
 * existing `DoubtForm.tsx` already imports.
 */
export const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Biology", "Mathematics", "General/Foundation"] as const;

export const doubtCreateSchema = z.object({
  subject: z.enum(SUBJECT_OPTIONS).optional(),
  body: z
    .string()
    .min(10, "Describe your doubt in at least 10 characters")
    .max(2000, "Keep it under 2000 characters"),
  // Optional + defaulted so the existing DoubtForm (which doesn't send this
  // field at all) keeps working unchanged — it just always creates NORMAL
  // priority doubts, same as before this field existed.
  priority: z.enum(["NORMAL", "HIGH"]).default("NORMAL"),
  // Set by DoubtForm after it uploads the student's photo via
  // /api/doubts/attachment — never a raw file here, just the resulting URL.
  attachmentUrl: z.string().url().optional().or(z.literal("")),
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
});

export type DoubtResolveInput = z.infer<typeof doubtResolveSchema>;
