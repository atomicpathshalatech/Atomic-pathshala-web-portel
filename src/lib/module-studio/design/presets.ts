import type { DesignSection, DesignTheme, ModuleDesign, SectionKind, TemplateStyle } from "./model";
import { PAGE_SIZES, designSchema } from "./model";

/** Subject themes in one Atomic Pathshala design language; every value can be changed in the studio. */
export const THEME_PRESETS: Record<string, DesignTheme> = {
  CHEMISTRY: { name: "Chemistry — green", primary: "#047857", deep: "#064e3b", soft: "#ecfdf5", accent: "#f59e0b", ink: "#0f172a", paper: "#ffffff", headingFont: "Poppins", bodyFont: "Noto Sans", baseSizePt: 10.5, lineHeight: 1.6, radiusMm: 3, borderWidthPt: 0.8, borderStyle: "solid", background: "PLAIN", accentShape: "BAR" },
  PHYSICS: { name: "Physics — blue", primary: "#1d4ed8", deep: "#172554", soft: "#eff6ff", accent: "#f97316", ink: "#0f172a", paper: "#ffffff", headingFont: "Poppins", bodyFont: "Noto Sans", baseSizePt: 10.5, lineHeight: 1.6, radiusMm: 3, borderWidthPt: 0.8, borderStyle: "solid", background: "PLAIN", accentShape: "BAR" },
  BIOLOGY: { name: "Biology — purple", primary: "#7e22ce", deep: "#3b0764", soft: "#faf5ff", accent: "#16a34a", ink: "#18181b", paper: "#ffffff", headingFont: "Poppins", bodyFont: "Noto Sans", baseSizePt: 10.5, lineHeight: 1.6, radiusMm: 3, borderWidthPt: 0.8, borderStyle: "solid", background: "PLAIN", accentShape: "BAR" },
  MATHEMATICS: { name: "Mathematics — crimson", primary: "#be123c", deep: "#4c0519", soft: "#fff1f2", accent: "#0ea5e9", ink: "#111827", paper: "#ffffff", headingFont: "Poppins", bodyFont: "Noto Serif", baseSizePt: 10.5, lineHeight: 1.6, radiusMm: 2, borderWidthPt: 0.8, borderStyle: "solid", background: "GRID", accentShape: "TAB" },
  ATOMIC: { name: "Atomic Pathshala — orange", primary: "#ea580c", deep: "#7c2d12", soft: "#fff7ed", accent: "#2563eb", ink: "#1c1917", paper: "#ffffff", headingFont: "Poppins", bodyFont: "Noto Sans", baseSizePt: 10.5, lineHeight: 1.6, radiusMm: 3, borderWidthPt: 0.8, borderStyle: "solid", background: "PLAIN", accentShape: "PILL" },
};

/** Matches a subject name ("Chemistry", "रसायन विज्ञान", "Maths") to its preset. */
export function presetForSubject(subject: string | null | undefined): string {
  const s = (subject || "").toLowerCase();
  if (/chem|रसायन/.test(s)) return "CHEMISTRY";
  if (/phys|भौतिक/.test(s)) return "PHYSICS";
  if (/bio|botany|zoology|जीव/.test(s)) return "BIOLOGY";
  if (/math|गणित/.test(s)) return "MATHEMATICS";
  return "ATOMIC";
}

/** How each template style changes a theme (so "Exam practice" stays plain even on a colourful subject). */
export const STYLE_INFO: Record<TemplateStyle, { label: string; description: string }> = {
  MINIMAL: { label: "Minimal", description: "Lots of white space, thin rules, one accent colour." },
  PREMIUM: { label: "Premium academic", description: "Colour bands, numbered headings, soft boxes." },
  CLASSROOM: { label: "Colourful classroom", description: "Bright boxes, rounded cards, playful accents." },
  EXAM: { label: "Exam practice", description: "Compact, black-on-white, two columns, OMR-like answer grids." },
};

export const KIND_INFO: Record<SectionKind, { label: string; description: string; defaultStyle: TemplateStyle; columns: 1 | 2 }> = {
  COVER: { label: "Cover page", description: "Title, chapter, subject, module number, author, logo.", defaultStyle: "PREMIUM", columns: 1 },
  CONTENTS: { label: "Contents", description: "Made from the headings, with their real page numbers.", defaultStyle: "PREMIUM", columns: 1 },
  CHAPTER_INTRO: { label: "Chapter introduction", description: "Chapter title, what students will learn, prerequisites.", defaultStyle: "PREMIUM", columns: 1 },
  THEORY: { label: "Theory pages", description: "Headings, text, boxes, tables, figures and equations.", defaultStyle: "PREMIUM", columns: 1 },
  QUESTIONS: { label: "Question pages", description: "Questions with their options, kept together.", defaultStyle: "PREMIUM", columns: 1 },
  PYQ: { label: "PYQ pages", description: "Previous-year questions (marked NEET/JEE/AIPMT + year, or a page range you choose).", defaultStyle: "EXAM", columns: 2 },
  PRACTICE: { label: "Practice sheet", description: "Questions without answers, with a name/date strip.", defaultStyle: "EXAM", columns: 2 },
  ANSWER_KEY: { label: "Answer key", description: "Grid of question number → answer.", defaultStyle: "EXAM", columns: 1 },
  SOLUTIONS: { label: "Detailed solutions", description: "Each question with its full solution.", defaultStyle: "PREMIUM", columns: 1 },
  SUMMARY: { label: "Chapter summary", description: "Summary and key-point boxes from the chapter, plus your notes.", defaultStyle: "CLASSROOM", columns: 1 },
  FORMULA_SHEET: { label: "Formula sheet", description: "Every formula and equation of the chapter on one sheet.", defaultStyle: "CLASSROOM", columns: 2 },
  REVISION: { label: "Final revision", description: "Remember / tip / caution boxes and key points.", defaultStyle: "CLASSROOM", columns: 2 },
};

let n = 0;
export const designId = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newSection(kind: SectionKind, style?: TemplateStyle): DesignSection {
  const info = KIND_INFO[kind];
  return {
    id: designId("sec"),
    kind,
    style: style ?? info.defaultStyle,
    title: info.label,
    enabled: true,
    fromPage: null,
    toPage: null,
    columns: info.columns,
    graphics: kind === "COVER" ? [{ id: designId("g"), kind: "LOGO", x: 18, y: 18, w: 30, h: 30, z: 1 }] : [],
  };
}

/** A complete design for a module, from what is known about it. */
export function defaultDesign(m: { title: string; subject?: string | null; class?: string | null; batch?: string | null; chapter?: string | null; facultyName?: string | null; academicYear?: string | null; code?: string | null; logoUrl?: string | null }): ModuleDesign {
  const themeId = presetForSubject(m.subject);
  const [w, h] = PAGE_SIZES.A4;
  return {
    version: 1,
    setup: {
      subject: m.subject || "",
      className: m.class || "",
      batch: m.batch || "",
      chapterRef: null,
      chapterName: m.chapter || "",
      moduleNumber: "01",
      title: m.title,
      author: m.facultyName || "",
      logoUrl: m.logoUrl ?? null,
      session: m.academicYear || "",
      language: "ENGLISH",
    },
    themeId,
    theme: { ...THEME_PRESETS[themeId]! },
    page: { size: "A4", widthMm: w, heightMm: h, orientation: "PORTRAIT", marginTopMm: 18, marginBottomMm: 16, marginLeftMm: 14, marginRightMm: 14 },
    headerFooter: { headerLeft: "Atomic Pathshala", headerRight: "{chapter}", footerLeft: "{subject} · Module {module}", footerRight: "Page {page}", numbering: "ARABIC" },
    watermark: { enabled: false, text: "ATOMIC PATHSHALA", imageUrl: null, opacity: 0.06, angle: -30 },
    rules: { keepQuestionTogether: true, keepOptionsTogether: true, keepSolutionHeading: true, avoidSplittingTables: true, avoidSplittingFigures: true, headingWithNext: true },
    output: { mode: "DIGITAL", bleedMm: 0, cropMarks: false },
    sections: (["COVER", "CONTENTS", "CHAPTER_INTRO", "THEORY", "QUESTIONS", "ANSWER_KEY", "SOLUTIONS", "FORMULA_SHEET", "SUMMARY"] as SectionKind[]).map((k) => newSection(k)),
  };
}

/** Same design with fresh ids (duplicating a design or a page section). */
export function cloneSection(s: DesignSection): DesignSection {
  const groups = new Map<string, string>();
  return {
    ...s,
    id: designId("sec"),
    title: `${s.title} (copy)`,
    graphics: s.graphics.map((g) => ({ ...g, id: designId("g"), groupId: g.groupId ? (groups.get(g.groupId) ?? (groups.set(g.groupId, designId("grp")), groups.get(g.groupId)!)) : null })),
  };
}

/** A template keeps the look, not the module: title, chapter and other details are left out. */
export function designToTemplateData(d: ModuleDesign) {
  const { setup, ...rest } = d;
  return { ...rest, setup: { logoUrl: setup.logoUrl, language: setup.language } };
}

/** Applies a template's look to a module's design, keeping the module's own details. */
export function applyTemplateData(current: ModuleDesign, data: any): ModuleDesign {
  const merged = { ...current, ...data, setup: { ...current.setup, ...(data?.setup?.logoUrl ? { logoUrl: data.setup.logoUrl } : {}), ...(data?.setup?.language ? { language: data.setup.language } : {}) }, version: 1 };
  const p = designSchema.safeParse(merged);
  if (!p.success) throw new Error("This template is not compatible with the current design format.");
  return p.data;
}

