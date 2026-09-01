import { z } from "zod";

export const rankTrendPointSchema = z.object({
  category: z.string().trim().min(1).max(60),
  marks: z.coerce.number().int(),
  expectedRank: z.coerce.number().int().min(1),
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  confidence: z.string().trim().max(30).optional().or(z.literal("")),
  source: z.string().trim().max(200).optional().or(z.literal("")),
});
export type RankTrendPointInput = z.infer<typeof rankTrendPointSchema>;

export const collegeAllotmentSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  round: z.string().trim().min(1).max(60).default("Round 1"),
  rank: z.coerce.number().int().min(1),
  quota: z.string().trim().min(1).max(60),
  instituteName: z.string().trim().min(1).max(300),
  course: z.string().trim().min(1).max(200),
  allottedCategory: z.string().trim().min(1).max(60),
  candidateCategory: z.string().trim().min(1).max(60),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CollegeAllotmentInput = z.infer<typeof collegeAllotmentSchema>;
