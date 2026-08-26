import { z } from "zod";

export const pageSeoUpsertSchema = z.object({
  pageKey: z.string().trim().min(1).max(60),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(200).optional(),
  keywords: z.string().max(300).optional(),
  ogTitle: z.string().max(70).optional(),
  ogDescription: z.string().max(200).optional(),
  ogImageUrl: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
  robotsDirective: z.string().max(60).optional(),
});
export type PageSeoUpsertInput = z.infer<typeof pageSeoUpsertSchema>;
