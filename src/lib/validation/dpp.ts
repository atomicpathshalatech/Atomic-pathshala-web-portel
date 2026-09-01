import { z } from "zod";

export const dppSchema = z.object({
  name: z.string().trim().min(3, "DPP name is required").max(200),
  subjectId: z.string().min(1, "Subject is required"),
  chapterId: z.string().optional().or(z.literal("")),
  topics: z.array(z.string().trim().min(1)).default([]),
  facultyName: z.string().trim().max(120).optional().or(z.literal("")),
  languageMode: z.enum(["HINDI", "ENGLISH", "BOTH"]).default("BOTH"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  questionTargetCount: z.coerce.number().int().min(1).max(200).default(10),
  estimatedTimeMin: z.coerce.number().int().min(1).max(300).default(30),
  correctMarks: z.coerce.number().default(4),
  incorrectMarks: z.coerce.number().default(-1),
  negativeMarkingEnabled: z.boolean().default(true),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  instructions: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type DppInput = z.infer<typeof dppSchema>;
