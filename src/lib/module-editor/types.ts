import { z } from "zod";

/**
 * Supported Subject Theming Palettes for Atomic Pathshala Modules.
 * Themes apply STRUCTURAL styling (headers, borders, badges, dividers, light paper tint)
 * and MUST NEVER flood the entire page with solid dark backgrounds.
 */
export type SubjectThemeType = "CHEMISTRY" | "PHYSICS" | "BIOLOGY" | "CLASSIC";

export interface ThemeColors {
  primary: string;         // Main accent color for headers, key badges, lines
  secondary: string;       // Secondary accent color for subheadings, icons
  accent: string;          // Bright highlight color for pills, highlights
  border: string;          // Border color for cards, tables, callout boxes
  lightTint: string;       // Extremely light background tint for callouts (e.g. #ecfdf5)
  paperBg: string;         // Subtle paper background (e.g. #ffffff or #fdfdfd)
  headerBannerBg: string;  // Header banner background (subtle light tint)
  headingText: string;     // Text color for styled headings
  bodyText: string;        // Regular body text color (dark gray / near black)
  tagBg: string;           // Badge / pill background color
  tagText: string;         // Badge / pill text color
}

export interface ModuleTheme {
  type: SubjectThemeType;
  name: string;
  colors: ThemeColors;
  structuralDividerThickness: number;
  headerBorderThickness: number;
  badgeBorderRadius: number;
  enableSubtlePaperTint: boolean;
}

/**
 * Standard PDF & UI Coordinate Box
 */
export interface BoundingBox {
  x: number;      // Points from left
  y: number;      // Points from top (UI) or bottom (PDF)
  width: number;
  height: number;
}

export interface Transform {
  x: number;           // X in points
  y: number;           // Y in points (from top-left in UI coordinates)
  width: number;       // Width in points
  height: number;      // Height in points
  rotation?: number;   // Rotation in degrees (0 = standard orientation)
  scale?: number;      // Scale multiplier (default 1.0)
  opacity?: number;    // Opacity from 0.0 to 1.0
}

/**
 * Layer types defining the strict visual rendering order in the Module Editor
 */
export enum VisualLayer {
  BACKGROUND = 0,         // Page background color / subtle paper tint
  BASE_PDF = 10,          // Original PDF content
  BEHIND_WATERMARK = 20,  // Watermark placed behind content
  REMOVAL_MASKS = 30,     // Whiteout / redactions / old header-footer removal
  GLOBAL_REMOVALS = 40,   // Global logo & text removals
  HEADER_FOOTER = 50,     // New running header and footer banners
  EDIT_OBJECTS = 60,      // Custom inserted images, text edits, shapes
  ABOVE_WATERMARK = 70,   // Watermark placed above content
  INTERACTION_HANDLES = 80 // UI selection and resize handles
}

export type LayerOrderAction = "BRING_TO_FRONT" | "BRING_FORWARD" | "SEND_BACKWARD" | "SEND_TO_BACK";

export type PageRangeType = "ALL" | "ODD" | "EVEN" | "CUSTOM";

/**
 * Base properties for all editable objects
 */
export interface BaseEditorObject {
  id: string;
  pageNumber: number;          // 1-indexed page number (or 0 for global)
  pageRange?: PageRangeType;   // "ALL" | "ODD" | "EVEN" | "CUSTOM"
  customPages?: number[];      // Specific page numbers if pageRange is "CUSTOM"
  zIndex: number;              // Relative z-index within the layer
  layer: VisualLayer;          // Defined layer
  transform: Transform;
  isDeleted: boolean;          // Soft/real delete flag
  createdAt: string;
  updatedAt: string;
}

export interface TextObject extends BaseEditorObject {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: "helvetica" | "times" | "courier";
  color: string;               // Hex color
  isBold?: boolean;
  isItalic?: boolean;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  hideOriginalUnderneath?: boolean;
  backgroundColor?: string;
  isHeading?: boolean;
  headingLevel?: 1 | 2 | 3;
}

export interface ImageObject extends BaseEditorObject {
  type: "image";
  imageUrl?: string;
  base64Data?: string;
  altText?: string;
  preserveAspectRatio?: boolean;
}

export interface ShapeObject extends BaseEditorObject {
  type: "shape";
  shapeType: "rect" | "circle" | "line" | "highlight" | "callout" | "divider";
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface RedactionObject extends BaseEditorObject {
  type: "redaction";
  color: string;               // Default "#ffffff"
  isRealDelete: boolean;       // If true, underlying content is excised
}

export type ModuleEditorObject = TextObject | ImageObject | ShapeObject | RedactionObject;

/**
 * Header and Footer Configuration
 */
export interface HeaderFooterConfig {
  enabled?: boolean;
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  headerHeightPt?: number;        // Default 36pt
  headerTopOffsetPt?: number;     // Margin from top of page (default 0pt)
  headerImageBase64?: string;
  headerImageUrl?: string;
  headerImagePosition?: "left" | "center" | "right";
  headerImageHeight?: number;

  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  footerHeightPt?: number;        // Default 28pt
  footerBottomOffsetPt?: number;  // Margin from bottom of page (default 0pt)
  footerImageBase64?: string;
  footerImageUrl?: string;
  footerImagePosition?: "left" | "center" | "right";
  footerImageHeight?: number;

  removeOldHeader?: boolean;
  removeOldFooter?: boolean;
  oldHeaderHeightPt?: number;     // Height of old header area to clear
  oldFooterHeightPt?: number;     // Height of old footer area to clear

  fontSize?: number;
  fontFamily?: "helvetica" | "times" | "courier";
  accentColor?: string;
  excludeFirstPage?: boolean;
  pageRange?: PageRangeType;
  customPages?: number[];
}

/**
 * Watermark Configuration
 */
export interface WatermarkConfig {
  enabled?: boolean;
  type?: "text" | "image";
  text?: string;
  imageUrl?: string;
  base64Data?: string;
  width?: number;
  height?: number;
  imageWidth?: number;
  imageHeight?: number;
  scale?: number;
  opacity?: number;               // Default 0.08 (8%)
  rotation?: number;              // Degrees (0 = strictly normal unrotated orientation)
  position?: "CENTER" | "TOP" | "BOTTOM" | "CUSTOM";
  customX?: number;
  customY?: number;
  layer?: "BEHIND_CONTENT" | "ABOVE_CONTENT";
  fontSize?: number;
  color?: string;
  excludeFirstPage?: boolean;
  pageRange?: PageRangeType;
  customPages?: number[];
}

/**
 * Front Cover Page Configuration
 */
export interface CoverPageConfig {
  enabled: boolean;
  action?: "PREPEND" | "REPLACE_FIRST" | "DELETE_FIRST" | "NONE";
  subject: string;
  chapter: string;
  moduleNumber: string;
  teacher?: string;
  batch?: string;
  targetExam?: string;
  academicYear?: string;
}

/**
 * Automatic Heading Detection Configuration & Result
 */
export interface HeadingRule {
  id: string;
  pattern: string;               // Regex or keyword
  level: 1 | 2 | 3;
  minFontSize?: number;
  isUppercaseOnly?: boolean;
  style: {
    addAccentBadge?: boolean;
    addLeftBorder?: boolean;
    addBottomDivider?: boolean;
    accentColor?: string;
  };
}

export interface DetectedHeading {
  id: string;
  pageNumber: number;
  text: string;
  boundingBox: BoundingBox;
  level: 1 | 2 | 3;
  ruleMatched: string;
  appliedStyle: {
    badgeColor?: string;
    borderColor?: string;
    textColor: string;
  };
}

/**
 * Module Metadata & Variables
 */
export interface ModuleVariables {
  page: number;
  totalPages: number;
  subject: string;
  chapter: string;
  teacher: string;
  date: string;
  moduleNumber: string;
  targetExam?: string;
}

/**
 * Full Serialized State of Module Editor (for Save / Reopen)
 */
export interface ModuleEditorState {
  version: number;
  documentId: string;
  pageCount: number;
  pageSize: {
    width: number;
    height: number;
  };
  theme: ModuleTheme;
  headerFooter: HeaderFooterConfig;
  watermark: WatermarkConfig;
  coverPage: CoverPageConfig;
  objects: ModuleEditorObject[];
  pageRotations: Record<number, number>;
  deletedPages: number[];
  pageOrder: number[];
  headingDetectionEnabled: boolean;
  headingRules: HeadingRule[];
  savedAt: string;
  lastModifiedBy?: string;
}

// Zod Validation Schema for ModuleEditorState Round-trip Integrity
export const ModuleEditorStateSchema = z.object({
  version: z.number().int().min(1),
  documentId: z.string().min(1),
  pageCount: z.number().int().min(0),
  pageSize: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  theme: z.object({
    type: z.enum(["CHEMISTRY", "PHYSICS", "BIOLOGY", "CLASSIC"]),
    name: z.string(),
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      border: z.string(),
      lightTint: z.string(),
      paperBg: z.string(),
      headerBannerBg: z.string(),
      headingText: z.string(),
      bodyText: z.string(),
      tagBg: z.string(),
      tagText: z.string(),
    }),
    structuralDividerThickness: z.number(),
    headerBorderThickness: z.number(),
    badgeBorderRadius: z.number(),
    enableSubtlePaperTint: z.boolean(),
  }),
  headerFooter: z.object({
    enabled: z.boolean(),
    headerLeft: z.string(),
    headerCenter: z.string(),
    headerRight: z.string(),
    headerHeightPt: z.number(),
    headerTopOffsetPt: z.number(),
    headerImageBase64: z.string().optional(),
    headerImageUrl: z.string().optional(),
    headerImagePosition: z.enum(["left", "center", "right"]).optional(),
    headerImageHeight: z.number().optional(),
    footerLeft: z.string(),
    footerCenter: z.string(),
    footerRight: z.string(),
    footerHeightPt: z.number(),
    footerBottomOffsetPt: z.number(),
    footerImageBase64: z.string().optional(),
    footerImageUrl: z.string().optional(),
    footerImagePosition: z.enum(["left", "center", "right"]).optional(),
    footerImageHeight: z.number().optional(),
    removeOldHeader: z.boolean(),
    removeOldFooter: z.boolean(),
    oldHeaderHeightPt: z.number(),
    oldFooterHeightPt: z.number(),
    fontSize: z.number(),
    fontFamily: z.enum(["helvetica", "times", "courier"]),
    accentColor: z.string().optional(),
    excludeFirstPage: z.boolean(),
    pageRange: z.enum(["ALL", "ODD", "EVEN", "CUSTOM"]),
    customPages: z.array(z.number()).optional(),
  }),
  watermark: z.object({
    enabled: z.boolean(),
    type: z.enum(["text", "image"]),
    text: z.string().optional(),
    imageUrl: z.string().optional(),
    base64Data: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    scale: z.number().optional(),
    opacity: z.number().min(0).max(1),
    rotation: z.number(),
    position: z.enum(["CENTER", "TOP", "BOTTOM", "CUSTOM"]),
    customX: z.number().optional(),
    customY: z.number().optional(),
    layer: z.enum(["BEHIND_CONTENT", "ABOVE_CONTENT"]),
    fontSize: z.number().optional(),
    color: z.string().optional(),
    excludeFirstPage: z.boolean(),
    pageRange: z.enum(["ALL", "ODD", "EVEN", "CUSTOM"]),
    customPages: z.array(z.number()).optional(),
  }),
  coverPage: z.object({
    enabled: z.boolean(),
    action: z.enum(["PREPEND", "REPLACE_FIRST", "DELETE_FIRST", "NONE"]),
    subject: z.string(),
    chapter: z.string(),
    moduleNumber: z.string(),
    teacher: z.string(),
    batch: z.string().optional(),
    targetExam: z.string().optional(),
    academicYear: z.string().optional(),
  }),
  objects: z.array(
    z.object({
      id: z.string(),
      pageNumber: z.number(),
      pageRange: z.enum(["ALL", "ODD", "EVEN", "CUSTOM"]).optional(),
      customPages: z.array(z.number()).optional(),
      zIndex: z.number(),
      layer: z.nativeEnum(VisualLayer),
      transform: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        rotation: z.number().optional(),
        scale: z.number().optional(),
        opacity: z.number().optional(),
      }),
      isDeleted: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
      type: z.enum(["text", "image", "shape", "redaction"]),
    }).passthrough()
  ),
  pageRotations: z.record(z.string(), z.number()).or(z.record(z.number(), z.number())),
  deletedPages: z.array(z.number()),
  pageOrder: z.array(z.number()),
  headingDetectionEnabled: z.boolean(),
  headingRules: z.array(z.any()),
  savedAt: z.string(),
  lastModifiedBy: z.string().optional(),
});
