export type ThumbnailLayerType =
  | "BACKGROUND"
  | "TEACHER_IMAGE"
  | "LOGO"
  | "TEXT"
  | "CHEMISTRY_STRUCTURE"
  | "DIAGRAM"
  | "GRAPHIC"
  | "DECORATIVE"
  | "GLOW"
  | "SHADOW"
  | "OVERLAY";

export interface ThumbnailLayer {
  id: string;
  type: ThumbnailLayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  // Text properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  glowColor?: string;
  glowBlur?: number;
  align?: "left" | "center" | "right";
  // Image / Shape properties
  imageUrl?: string;
  fillColor?: string;
  gradientEndColor?: string;
  borderRadius?: number;
}

export interface ThumbnailConcept {
  id: string;
  style: string;
  headlineText: string;
  subText?: string;
  compositionNote: string;
  backgroundPrompt: string;
  primaryColor: string;
  accentColor: string;
}

export const THUMBNAIL_DIMENSIONS = [
  { id: "YOUTUBE", label: "YouTube (1280 × 720)", width: 1280, height: 720 },
  { id: "INSTAGRAM", label: "Instagram Post (1080 × 1080)", width: 1080, height: 1080 },
  { id: "SHORTS", label: "Shorts / Reels Cover (1080 × 1920)", width: 1080, height: 1920 },
  { id: "COMMUNITY", label: "Community Post (1200 × 900)", width: 1200, height: 900 },
] as const;

export const THUMBNAIL_PROJECT_TYPES = [
  "NEET_CHEMISTRY",
  "NEET_BIOLOGY",
  "NEET_PHYSICS",
  "JEE",
  "BOARDS",
  "LECTURE",
  "ONE_SHOT",
  "PYQ",
  "REVISION",
  "MOTIVATION",
  "BATCH_LAUNCH",
  "COURSE_PROMOTION",
  "LIVE_CLASS",
] as const;
