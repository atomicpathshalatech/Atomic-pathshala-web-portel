import { z } from "zod";

export const testimonialCreateSchema = z.object({
  studentName: z.string().trim().min(2, "Name is required").max(120),
  photoUrl: z.string().url().optional(),
  studentClass: z.string().max(40).optional(),
  targetExam: z.string().max(40).optional(),
  quote: z.string().trim().min(5, "Quote is required").max(1000),
  rating: z.number().int().min(1).max(5).optional(),
  videoUrl: z.string().url().optional(),
  order: z.number().int().optional(),
  isApproved: z.boolean().optional(),
});
export type TestimonialCreateInput = z.infer<typeof testimonialCreateSchema>;

export const testimonialUpdateSchema = testimonialCreateSchema.partial();
export type TestimonialUpdateInput = z.infer<typeof testimonialUpdateSchema>;
