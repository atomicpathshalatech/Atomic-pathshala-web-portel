import { z } from "zod";

export const bannerStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const bannerCreateSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150),
  subtitle: z.string().max(300).optional(),
  imageUrl: z.string().url("Provide a valid image URL"),
  mobileImageUrl: z.string().url().optional(),
  ctaText: z.string().max(60).optional(),
  ctaUrl: z.string().max(500).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  priority: z.number().int().optional(),
  status: bannerStatusSchema.optional(),
  targetAudience: z.string().max(150).optional(),
  openInNewTab: z.boolean().optional(),
  order: z.number().int().optional(),
});
export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;

export const bannerUpdateSchema = bannerCreateSchema.partial();
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
