import { z } from "zod";

/**
 * A module's design: how its content (the editable blocks from the block
 * editor) is laid out as a printed / digital document. It is data — a list of
 * sections, each using a page template and style — and is rendered to PDF by
 * render-pdf.ts. Shared by the Design Studio (browser) and the renderer.
 */

export const SECTION_KINDS = [
  "COVER",
  "CONTENTS",
  "CHAPTER_INTRO",
  "THEORY",
  "QUESTIONS",
  "PYQ",
  "PRACTICE",
  "ANSWER_KEY",
  "SOLUTIONS",
  "SUMMARY",
  "FORMULA_SHEET",
  "REVISION",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const TEMPLATE_STYLES = ["MINIMAL", "PREMIUM", "CLASSROOM", "EXAM"] as const;
export type TemplateStyle = (typeof TEMPLATE_STYLES)[number];

/** Fonts the renderer embeds (all SIL Open Font License, which allows embedding). Hindi always falls back to Noto Sans / Noto Serif Devanagari. */
export const DESIGN_FONTS = ["Poppins", "Noto Sans", "Noto Serif", "Mukta", "Hind", "Inter", "Merriweather"] as const;
export type DesignFont = (typeof DESIGN_FONTS)[number];

export const PAGE_SIZES = { A4: [210, 297], A5: [148, 210], LETTER: [215.9, 279.4], LEGAL: [215.9, 355.6], B5: [176, 250] } as const;
export type PageSizeName = keyof typeof PAGE_SIZES | "CUSTOM";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeSchema = z.object({
  name: z.string().max(60),
  primary: hex,
  deep: hex,
  soft: hex,
  accent: hex,
  ink: hex,
  paper: hex,
  headingFont: z.enum(DESIGN_FONTS),
  bodyFont: z.enum(DESIGN_FONTS),
  baseSizePt: z.number().min(8).max(14),
  lineHeight: z.number().min(1.1).max(2.2),
  radiusMm: z.number().min(0).max(8),
  borderWidthPt: z.number().min(0).max(4),
  borderStyle: z.enum(["solid", "dashed", "dotted", "double", "none"]),
  background: z.enum(["PLAIN", "GRID", "DOTS", "LINES", "TINT"]),
  accentShape: z.enum(["BAR", "PILL", "UNDERLINE", "TAB", "NONE"]),
});
export type DesignTheme = z.infer<typeof themeSchema>;

/** A placed object on a template page (logo, picture, shape, text) — moved, resized, grouped in the studio. */
export const graphicSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["LOGO", "IMAGE", "RECT", "ELLIPSE", "LINE", "TEXT"]),
  /** mm from the top-left of the page's trim box */
  x: z.number(),
  y: z.number(),
  w: z.number().min(1),
  h: z.number().min(0.5),
  z: z.number(),
  locked: z.boolean().optional(),
  groupId: z.string().max(80).nullable().optional(),
  src: z.string().max(2000).optional(),
  text: z.string().max(500).optional(),
  fill: hex.nullable().optional(),
  stroke: hex.nullable().optional(),
  strokeWidthPt: z.number().min(0).max(10).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontSizePt: z.number().min(4).max(96).optional(),
  color: hex.optional(),
  bold: z.boolean().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});
export type DesignGraphic = z.infer<typeof graphicSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(SECTION_KINDS),
  style: z.enum(TEMPLATE_STYLES),
  title: z.string().max(200),
  enabled: z.boolean(),
  /** Which module pages feed this section (1-based, inclusive); empty = whole module. */
  fromPage: z.number().int().min(1).nullable().optional(),
  toPage: z.number().int().min(1).nullable().optional(),
  columns: z.union([z.literal(1), z.literal(2)]),
  /** Per-section look (overrides the module theme). */
  themeOverride: themeSchema.partial().optional(),
  /** Graphics on every page of this section (master page); on the cover, on the cover. Negative z = behind the text. */
  graphics: z.array(graphicSchema).max(80),
  /** For SUMMARY / FORMULA_SHEET / REVISION: also free text the teacher writes here. */
  note: z.string().max(4000).optional(),
});
export type DesignSection = z.infer<typeof sectionSchema>;

export const designSchema = z.object({
  version: z.literal(1),
  setup: z.object({
    subject: z.string().max(80),
    className: z.string().max(80),
    batch: z.string().max(120),
    /** id of an AcademicChapter (or Chapter) row when picked from the list */
    chapterRef: z.string().max(80).nullable(),
    chapterName: z.string().max(200),
    moduleNumber: z.string().max(40),
    title: z.string().max(200),
    author: z.string().max(120),
    logoUrl: z.string().max(2000).nullable(),
    session: z.string().max(40),
    language: z.enum(["ENGLISH", "HINDI", "BILINGUAL"]),
  }),
  themeId: z.string().max(40),
  theme: themeSchema,
  page: z.object({
    size: z.enum(["A4", "A5", "LETTER", "LEGAL", "B5", "CUSTOM"]),
    widthMm: z.number().min(90).max(500),
    heightMm: z.number().min(90).max(700),
    orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
    marginTopMm: z.number().min(5).max(50),
    marginBottomMm: z.number().min(5).max(50),
    marginLeftMm: z.number().min(5).max(50),
    marginRightMm: z.number().min(5).max(50),
  }),
  headerFooter: z.object({
    headerLeft: z.string().max(200),
    headerRight: z.string().max(200),
    footerLeft: z.string().max(200),
    footerRight: z.string().max(200),
    /** Page numbers count from the first page after the cover. */
    numbering: z.enum(["ARABIC", "NONE"]),
  }),
  watermark: z.object({
    enabled: z.boolean(),
    text: z.string().max(80),
    imageUrl: z.string().max(2000).nullable(),
    opacity: z.number().min(0.02).max(0.4),
    angle: z.number().min(-90).max(90),
  }),
  rules: z.object({
    keepQuestionTogether: z.boolean(),
    keepOptionsTogether: z.boolean(),
    keepSolutionHeading: z.boolean(),
    avoidSplittingTables: z.boolean(),
    avoidSplittingFigures: z.boolean(),
    headingWithNext: z.boolean(),
  }),
  output: z.object({
    mode: z.enum(["DIGITAL", "PRINT"]),
    bleedMm: z.number().min(0).max(10),
    cropMarks: z.boolean(),
  }),
  sections: z.array(sectionSchema).min(1).max(40),
});
export type ModuleDesign = z.infer<typeof designSchema>;

/** Page box in mm (portrait/landscape applied). */
export function pageBox(d: Pick<ModuleDesign, "page">) {
  const { widthMm, heightMm, orientation } = d.page;
  const [w, h] = orientation === "LANDSCAPE" ? [Math.max(widthMm, heightMm), Math.min(widthMm, heightMm)] : [Math.min(widthMm, heightMm), Math.max(widthMm, heightMm)];
  return { w, h };
}

/** `{chapter}`-style labels in headers and footers. */
export function fillTokens(template: string, d: ModuleDesign, extra: Record<string, string> = {}): string {
  const map: Record<string, string> = {
    title: d.setup.title,
    chapter: d.setup.chapterName,
    subject: d.setup.subject,
    class: d.setup.className,
    batch: d.setup.batch,
    module: d.setup.moduleNumber,
    author: d.setup.author,
    session: d.setup.session,
    ...extra,
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k]! : m));
}
