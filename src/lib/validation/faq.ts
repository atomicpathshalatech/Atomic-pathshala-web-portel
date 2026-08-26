import { z } from "zod";

export const faqCategoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  order: z.number().int().optional(),
});
export type FaqCategoryCreateInput = z.infer<typeof faqCategoryCreateSchema>;

export const faqCategoryUpdateSchema = faqCategoryCreateSchema.partial();
export type FaqCategoryUpdateInput = z.infer<typeof faqCategoryUpdateSchema>;

export const faqCreateSchema = z.object({
  categoryId: z.string().cuid().optional(),
  question: z.string().trim().min(3, "Question is required").max(300),
  answer: z.string().trim().min(3, "Answer is required").max(3000),
  order: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});
export type FaqCreateInput = z.infer<typeof faqCreateSchema>;

export const faqUpdateSchema = faqCreateSchema.partial().extend({
  categoryId: z.string().cuid().nullable().optional(),
});
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
