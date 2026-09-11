/**
 * The DESIGN half of the creative system (spec section 4: "the system must
 * separate CONTENT DATA from DESIGN TEMPLATE"). A CreativeTemplate row's
 * `layoutConfig` JSON is shaped like this — a small, structured set of
 * fields an admin picks from a form, NOT freeform pixel-drag state (spec
 * section 27: this is deliberately not a graphic-design editor).
 */

export type EducatorShape = "circle" | "rounded" | "rect" | "cutout";
export type EducatorFit = "cover" | "contain";
export type HAlign = "left" | "center" | "right";

/**
 * ONE area for however many educators the content actually has — not one
 * slot per educator. A batch with 2 assigned teachers and one with 5 use
 * the exact same template; the renderer evenly distributes whatever count
 * it's given across this area (up to `maxCount`), which is what makes
 * "educator added/removed -> creative updates automatically" (spec section
 * 6) a property of the render step rather than something a template author
 * has to hand-position for every possible headcount.
 */
export interface EducatorArea {
  shape: EducatorShape;
  /** Percent of the canvas width/height (0-100), so one config works at every output size. */
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  /** Per-educator cell size within the area, as a percent of the area itself. */
  itemWidthPct: number;
  itemHeightPct: number;
  maxCount: number;
  fit: EducatorFit;
  /** Only meaningful for fit "contain" — anchors the person within their cell so a full-body PNG doesn't get cropped oddly. */
  anchor?: "bottom" | "center" | "top";
  borderColor?: string;
  borderWidthPx?: number;
  gapPct?: number;
}

export interface TextBlock {
  /** Which content field this renders — resolved by the engine, not hardcoded per template. */
  field:
    | "title"
    | "subtitle"
    | "educatorName"
    | "educatorNames"
    | "batchName"
    | "chapterName"
    | "subjectName"
    | "lectureLabel"
    | "lectureTitle"
    | "lectureCount"
    | "examOrCourse";
  xPct: number;
  yPct: number;
  maxWidthPct: number;
  fontSizePx: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  color: string;
  align: HAlign;
  letterSpacingPx?: number;
  uppercase?: boolean;
  /** Small pill/badge background behind the text, e.g. "12 LECTURES". */
  badge?: { backgroundColor: string; paddingXPx: number; paddingYPx: number; radiusPx: number };
}

export interface LayoutConfig {
  /** Output canvas — actual pixel size the engine renders at for this template. */
  width: number;
  height: number;
  educatorArea: EducatorArea;
  text: TextBlock[];
  /** Optional platform logo, positioned like an educator slot but always "contain". */
  logo?: { xPct: number; yPct: number; widthPct: number; heightPct: number };
  /** Rendering order, back to front. Anything not listed renders in a sane default order. */
  layerOrder?: Array<"background" | "decorative" | "logo" | "text" | "educators" | "badges">;
}

export const DEFAULT_LAYER_ORDER: NonNullable<LayoutConfig["layerOrder"]> = [
  "background",
  "decorative",
  "logo",
  "text",
  "educators",
  "badges",
];
