export type EditorTrackId =
  | "VIDEO_1"
  | "VIDEO_2"
  | "IMAGE"
  | "VOICE"
  | "MUSIC"
  | "SFX"
  | "CAPTION"
  | "TEXT";

export interface EditorTrackMeta {
  id: EditorTrackId;
  label: string;
  kind: "visual" | "audio" | "overlay";
}

export const EDITOR_TRACKS: EditorTrackMeta[] = [
  { id: "VIDEO_1", label: "Video Track 1", kind: "visual" },
  { id: "VIDEO_2", label: "Video Track 2", kind: "visual" },
  { id: "IMAGE", label: "Image Track", kind: "visual" },
  { id: "VOICE", label: "Voice Track", kind: "audio" },
  { id: "MUSIC", label: "Music Track", kind: "audio" },
  { id: "SFX", label: "SFX Track", kind: "audio" },
  { id: "CAPTION", label: "Caption Track", kind: "overlay" },
  { id: "TEXT", label: "Text Track", kind: "overlay" },
];

export interface EditorClip {
  id: string;
  trackId: EditorTrackId;
  name: string;
  assetId?: string;
  mediaUrl?: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  // Audio controls
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  duckUnderVoice?: boolean;
  // Visual / Overlay controls
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
  transition?: "none" | "fade";
  // Text / Caption controls
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
}

export interface EditorTimelineState {
  clips: EditorClip[];
}

export function getExportDimensions(aspectRatio: string, resolution: string): { width: number; height: number } {
  const is1080 = resolution === "1080p";
  if (aspectRatio === "9:16") {
    return is1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (aspectRatio === "1:1") {
    return is1080 ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  return is1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}
