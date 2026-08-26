import { z } from "zod";

export const homeSectionTypeSchema = z.enum([
  "HERO",
  "IMAGE_BANNER",
  "TEXT_IMAGE",
  "FEATURES",
  "COURSE_GRID",
  "BATCH_GRID",
  "TEACHER_GRID",
  "CATEGORY_GRID",
  "STATISTICS",
  "TESTIMONIALS",
  "ANNOUNCEMENT",
  "VIDEO",
  "APP_DOWNLOAD",
  "BLOG",
  "FAQ",
  "LOGO_PARTNERS",
  "CTA",
  "CONTACT",
  "SOCIAL_LINKS",
  "CUSTOM_HTML",
]);

// `config` is intentionally z.record(z.unknown()) rather than a discriminated
// union keyed off `type` — each section type's shape is validated by its own
// admin editor component client-side, and the renderer defensively reads
// fields with fallbacks. A strict server-side per-type schema would need to
// be duplicated/kept in sync with 20 editor components for very little real
// safety benefit, since this is trusted team-portal input, not public input.
export const sectionCreateSchema = z.object({
  type: homeSectionTypeSchema,
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  visibleDesktop: z.boolean().optional(),
  visibleMobile: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  background: z.string().max(120).optional(),
  padding: z.string().max(60).optional(),
});
export type SectionCreateInput = z.infer<typeof sectionCreateSchema>;

export const sectionUpdateSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  visible: z.boolean().optional(),
  visibleDesktop: z.boolean().optional(),
  visibleMobile: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  background: z.string().max(120).nullable().optional(),
  padding: z.string().max(60).nullable().optional(),
});
export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>;

export const sectionReorderSchema = z.object({
  order: z
    .array(z.object({ id: z.string().cuid(), order: z.number().int().min(0) }))
    .min(1, "Nothing to reorder"),
});
export type SectionReorderInput = z.infer<typeof sectionReorderSchema>;

export const homepagePublishSchema = z.object({
  note: z.string().max(300).optional(),
});
export type HomepagePublishInput = z.infer<typeof homepagePublishSchema>;
