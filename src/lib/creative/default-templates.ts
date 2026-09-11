import type { LayoutConfig } from "./layout-types";

/**
 * Seeded default templates — one per CreativeType, matching the visual
 * hierarchies from the spec's own examples. These are what
 * prisma/seed-creatives.ts writes as CreativeTemplate rows (isSystem
 * default, isDefault: true) so the system is usable without an admin
 * authoring anything first. Admins can add more later via the Templates
 * admin page; these stay as the always-available fallback.
 */

const CARD: Pick<LayoutConfig, "width" | "height"> = { width: 1200, height: 675 };
const SLIDE: Pick<LayoutConfig, "width" | "height"> = { width: 1280, height: 720 };

export const DEFAULT_BATCH_TEMPLATE: LayoutConfig = {
  ...CARD,
  educatorArea: {
    shape: "rounded",
    xPct: 8,
    yPct: 46,
    widthPct: 84,
    heightPct: 40,
    itemWidthPct: 26,
    itemHeightPct: 100,
    maxCount: 4,
    fit: "cover",
    anchor: "top",
    gapPct: 3,
    borderColor: "#f8fafc",
    borderWidthPx: 4,
  },
  text: [
    { field: "examOrCourse", xPct: 6, yPct: 6, maxWidthPct: 50, fontSizePx: 22, fontWeight: 700, color: "#93c5fd", align: "left", uppercase: true, letterSpacingPx: 2 },
    { field: "batchName", xPct: 6, yPct: 14, maxWidthPct: 88, fontSizePx: 52, fontWeight: 800, color: "#f8fafc", align: "left" },
    { field: "educatorNames", xPct: 6, yPct: 90, maxWidthPct: 88, fontSizePx: 20, fontWeight: 600, color: "#e2e8f0", align: "left" },
  ],
};

export const DEFAULT_TEST_SERIES_TEMPLATE: LayoutConfig = {
  ...CARD,
  educatorArea: {
    shape: "rounded",
    xPct: 8,
    yPct: 44,
    widthPct: 84,
    heightPct: 40,
    itemWidthPct: 26,
    itemHeightPct: 100,
    maxCount: 4,
    fit: "cover",
    anchor: "top",
    gapPct: 3,
    borderColor: "#f8fafc",
    borderWidthPx: 4,
  },
  text: [
    { field: "examOrCourse", xPct: 6, yPct: 6, maxWidthPct: 50, fontSizePx: 22, fontWeight: 700, color: "#fca5a5", align: "left", uppercase: true, letterSpacingPx: 2 },
    { field: "title", xPct: 6, yPct: 14, maxWidthPct: 88, fontSizePx: 46, fontWeight: 800, color: "#f8fafc", align: "left" },
    { field: "educatorNames", xPct: 6, yPct: 90, maxWidthPct: 88, fontSizePx: 20, fontWeight: 600, color: "#e2e8f0", align: "left" },
  ],
};

export const DEFAULT_CHAPTER_TEMPLATE: LayoutConfig = {
  ...CARD,
  educatorArea: {
    shape: "circle",
    xPct: 6,
    yPct: 14,
    widthPct: 32,
    heightPct: 72,
    itemWidthPct: 90,
    itemHeightPct: 90,
    maxCount: 1,
    fit: "cover",
    anchor: "top",
    borderColor: "#f8fafc",
    borderWidthPx: 6,
  },
  text: [
    { field: "subjectName", xPct: 42, yPct: 18, maxWidthPct: 52, fontSizePx: 20, fontWeight: 700, color: "#93c5fd", align: "left", uppercase: true, letterSpacingPx: 2 },
    { field: "chapterName", xPct: 42, yPct: 28, maxWidthPct: 54, fontSizePx: 48, fontWeight: 800, color: "#f8fafc", align: "left" },
    {
      field: "lectureCount",
      xPct: 42,
      yPct: 78,
      maxWidthPct: 40,
      fontSizePx: 20,
      fontWeight: 700,
      color: "#0f172a",
      align: "left",
      badge: { backgroundColor: "#facc15", paddingXPx: 18, paddingYPx: 8, radiusPx: 999 },
    },
    { field: "educatorName", xPct: 42, yPct: 88, maxWidthPct: 52, fontSizePx: 20, fontWeight: 600, color: "#e2e8f0", align: "left" },
  ],
};

export const DEFAULT_LECTURE_TEMPLATE: LayoutConfig = {
  ...CARD,
  educatorArea: {
    shape: "circle",
    xPct: 6,
    yPct: 14,
    widthPct: 32,
    heightPct: 72,
    itemWidthPct: 90,
    itemHeightPct: 90,
    maxCount: 1,
    fit: "cover",
    anchor: "top",
    borderColor: "#f8fafc",
    borderWidthPx: 6,
  },
  text: [
    {
      field: "lectureLabel",
      xPct: 42,
      yPct: 16,
      maxWidthPct: 40,
      fontSizePx: 18,
      fontWeight: 700,
      color: "#0f172a",
      align: "left",
      badge: { backgroundColor: "#4ade80", paddingXPx: 16, paddingYPx: 6, radiusPx: 999 },
    },
    { field: "chapterName", xPct: 42, yPct: 30, maxWidthPct: 54, fontSizePx: 40, fontWeight: 800, color: "#f8fafc", align: "left" },
    { field: "lectureTitle", xPct: 42, yPct: 48, maxWidthPct: 54, fontSizePx: 22, fontWeight: 500, color: "#cbd5e1", align: "left" },
    { field: "batchName", xPct: 42, yPct: 88, maxWidthPct: 52, fontSizePx: 20, fontWeight: 600, color: "#e2e8f0", align: "left" },
  ],
};

export const DEFAULT_LECTURE_START_SLIDE_TEMPLATE: LayoutConfig = {
  ...SLIDE,
  educatorArea: {
    shape: "circle",
    xPct: 38,
    yPct: 8,
    widthPct: 24,
    heightPct: 38,
    itemWidthPct: 100,
    itemHeightPct: 100,
    maxCount: 1,
    fit: "cover",
    anchor: "top",
    borderColor: "#f8fafc",
    borderWidthPx: 6,
  },
  text: [
    { field: "educatorName", xPct: 10, yPct: 50, maxWidthPct: 80, fontSizePx: 34, fontWeight: 700, color: "#f8fafc", align: "center" },
    { field: "chapterName", xPct: 10, yPct: 60, maxWidthPct: 80, fontSizePx: 44, fontWeight: 800, color: "#facc15", align: "center", uppercase: true },
    { field: "lectureLabel", xPct: 10, yPct: 70, maxWidthPct: 80, fontSizePx: 26, fontWeight: 700, color: "#e2e8f0", align: "center", letterSpacingPx: 2 },
    { field: "batchName", xPct: 10, yPct: 82, maxWidthPct: 80, fontSizePx: 22, fontWeight: 600, color: "#93c5fd", align: "center" },
  ],
};

export const DEFAULT_TEMPLATES_BY_TYPE = {
  BATCH: DEFAULT_BATCH_TEMPLATE,
  TEST_SERIES: DEFAULT_TEST_SERIES_TEMPLATE,
  CHAPTER: DEFAULT_CHAPTER_TEMPLATE,
  LECTURE: DEFAULT_LECTURE_TEMPLATE,
  LECTURE_START_SLIDE: DEFAULT_LECTURE_START_SLIDE_TEMPLATE,
} as const;
