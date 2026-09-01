import { z } from "zod";

export const MODULE_ELEMENT_TYPES = [
  "TEXT",
  "HEADING",
  "SUBHEADING",
  "PARAGRAPH",
  "QUESTION",
  "OPTION",
  "SOLUTION",
  "IMAGE",
  "DIAGRAM",
  "EQUATION",
  "CHEMICAL_EQUATION",
  "CHEMICAL_STRUCTURE",
  "TABLE",
] as const;

// Metadata-only create — the source PDF itself is a separate multipart
// upload (see /api/team/modules POST), same split as every other
// upload-plus-metadata route in this app (doubts attachment, profile
// photo).
export const moduleCreateSchema = z.object({
  title: z.string().min(2, "Title is required"),
  subject: z.string().optional(),
  class: z.string().optional(),
  batch: z.string().optional(),
  chapter: z.string().optional(),
  facultyName: z.string().optional(),
  academicYear: z.string().optional(),
  brandProfileId: z.string().optional(),
});
export type ModuleCreateInput = z.infer<typeof moduleCreateSchema>;

export const moduleUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  subject: z.string().optional(),
  class: z.string().optional(),
  batch: z.string().optional(),
  chapter: z.string().optional(),
  facultyName: z.string().optional(),
  academicYear: z.string().optional(),
  brandProfileId: z.string().nullable().optional(),
});
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;

export const MODULE_STATUS_VALUES = [
  "DRAFT",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
  "FAILED",
] as const;

export const moduleStatusUpdateSchema = z.object({
  status: z.enum(MODULE_STATUS_VALUES),
});

// Per-element typography. Deliberately restricted to the three font
// families jsPDF's base-14 set can actually render (Helvetica, Times,
// Courier) — offering arbitrary Google Fonts in the on-screen canvas would
// look right in the editor and then silently fall back to a different font
// in the exported PDF, which is exactly the kind of "looks done, isn't"
// gap this build tries to avoid. Every field is optional: an element with
// no style falls back to its type's existing default look (see
// DEFAULT_ELEMENT_STYLE on the client and wrapAndStyle in pdf-export.ts).
export const MODULE_FONT_FAMILIES = ["helvetica", "times", "courier"] as const;
export const MODULE_TEXT_ALIGN = ["left", "center", "right", "justify"] as const;

export const moduleElementStyleSchema = z.object({
  fontFamily: z.enum(MODULE_FONT_FAMILIES).optional(),
  fontSize: z.number().min(6).max(48).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  align: z.enum(MODULE_TEXT_ALIGN).optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  letterSpacing: z.number().min(-2).max(10).optional(),
});
export type ModuleElementStyle = z.infer<typeof moduleElementStyleSchema>;

// One structured content block on a page. No x/y/width/height — this
// pipeline extracts and re-flows content (via pdfjs-dist + an AI
// structuring pass), it does not do pixel-level layout/image analysis of
// the source PDF, so there is no real source position data to store or
// reproduce. The canvas and the PDF export both lay elements out as a
// flowing document (like a word processor page), not a freeform
// drag-anywhere canvas — see pdf-export.ts's file comment for what that
// means for the exported PDF's layout.
//
// Content conventions (shared with the Question Bank's own formula
// renderer, src/lib/test-portal/formula.ts, so authors already know this
// syntax): `$inline math$`, `$$block math$$`, `**bold**`, and
// `![](imageUrl)` all work inside TEXT/HEADING/SUBHEADING/PARAGRAPH/
// QUESTION/OPTION/SOLUTION content. EQUATION content is raw LaTeX (no `$`
// delimiters needed, always rendered in display mode). TABLE content is
// ignored in favor of the separate `tableData` grid.
export const moduleElementSchema = z.object({
  id: z.string(),
  type: z.enum(MODULE_ELEMENT_TYPES),
  order: z.number().int().min(0),
  content: z.string(),
  style: moduleElementStyleSchema.optional(),
  tableData: z.array(z.array(z.string())).optional(),
});
export type ModuleElementInput = z.infer<typeof moduleElementSchema>;

export const modulePageUpdateSchema = z.object({
  elements: z.array(moduleElementSchema),
  needsReview: z.boolean().optional(),
});

export const brandProfileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1A73E8")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1A73E8")
    .optional()
    .or(z.literal("")),
  fontFamily: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  tagline: z.string().max(200).optional(),
  isDefault: z.boolean().optional(),
});
export type BrandProfileInput = z.infer<typeof brandProfileSchema>;

export const moduleExportSchema = z.object({
  versionId: z.string().optional(),
  includedFrontPage: z.boolean().optional(),
  includedWatermark: z.boolean().optional(),
});

export const moduleVersionCreateSchema = z.object({
  label: z.string().min(1, "Label is required"),
});
