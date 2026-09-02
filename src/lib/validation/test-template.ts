import { z } from "zod";

export const templateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").max(100),
  subject: z.string().min(1, "Subject is required").max(100),
  targetCount: z.number().int().min(1, "Target count must be at least 1").max(200),
  marksPerQuestion: z.number().min(0, "Marks per question must be positive").default(4),
  negativeMarks: z.number().default(-1),
  order: z.number().int().default(0),
});

export const testTemplateCreateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  sections: z.array(templateSectionSchema).min(1, "At least one section is required"),
});

export const testTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  sections: z.array(templateSectionSchema).min(1).optional(),
});

export const applyTemplateSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
});

export type TemplateSectionInput = z.infer<typeof templateSectionSchema>;
export type TestTemplateCreateInput = z.infer<typeof testTemplateCreateSchema>;
export type TestTemplateUpdateInput = z.infer<typeof testTemplateUpdateSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
