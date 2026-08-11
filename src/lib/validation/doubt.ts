import { z } from "zod";

export const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Biology", "Maths", "Other"] as const;

export const doubtCreateSchema = z.object({
  subject: z.enum(SUBJECT_OPTIONS).optional(),
  body: z.string().min(10, "Please describe your doubt in a bit more detail (10+ characters)"),
});

export type DoubtCreateInput = z.infer<typeof doubtCreateSchema>;

export const doubtResolveSchema = z.object({
  status: z.enum(["RESOLVED", "FLAGGED"]),
  expertExplanation: z.string().optional(),
  videoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type DoubtResolveInput = z.infer<typeof doubtResolveSchema>;
