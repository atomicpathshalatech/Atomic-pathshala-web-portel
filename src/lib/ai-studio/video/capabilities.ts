export interface VideoProviderCapabilities {
  provider: "RUNWAY" | "KLING" | "REPLICATE_VIDEO" | "GOOGLE_VEO";
  label: string;
  envKeyRef: string;
  models: Array<{ id: string; label: string; costPerSecUsd: number | null }>;
  aspectRatios: string[];
  durations: number[];
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsReferenceConsistency: boolean;
  supportsCameraControls: boolean;
  supportsLightingControls: boolean;
  supportsExtend: boolean;
  supportsCancel: boolean;
}

export const VIDEO_PROVIDER_CAPABILITIES: Record<string, VideoProviderCapabilities> = {
  RUNWAY: {
    provider: "RUNWAY",
    label: "Runway ML",
    envKeyRef: "RUNWAY_API_KEY",
    models: [
      { id: "gen4_turbo", label: "Gen-4 Turbo", costPerSecUsd: 0.05 },
      { id: "gen3a_turbo", label: "Gen-3 Alpha Turbo", costPerSecUsd: 0.05 },
    ],
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsReferenceConsistency: false,
    supportsCameraControls: true,
    supportsLightingControls: true,
    supportsExtend: true,
    supportsCancel: true,
  },
  KLING: {
    provider: "KLING",
    label: "Kling AI",
    envKeyRef: "KLING_API_KEY",
    models: [
      { id: "kling-v2", label: "Kling v2", costPerSecUsd: 0.04 },
      { id: "kling-v1.6", label: "Kling v1.6", costPerSecUsd: 0.035 },
    ],
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsReferenceConsistency: true,
    supportsCameraControls: true,
    supportsLightingControls: true,
    supportsExtend: true,
    supportsCancel: false,
  },
  REPLICATE_VIDEO: {
    provider: "REPLICATE_VIDEO",
    label: "Replicate Video (Minimax / Wan)",
    envKeyRef: "REPLICATE_API_TOKEN",
    models: [
      { id: "minimax/video-01", label: "Minimax Video-01", costPerSecUsd: 0.03 },
      { id: "wavespeedai/wan-2.1-t2v-480p", label: "Wan 2.1", costPerSecUsd: 0.025 },
    ],
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 6],
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsReferenceConsistency: false,
    supportsCameraControls: false,
    supportsLightingControls: false,
    supportsExtend: false,
    supportsCancel: true,
  },
  GOOGLE_VEO: {
    provider: "GOOGLE_VEO",
    label: "Google Veo (Gemini API)",
    envKeyRef: "GEMINI_API_KEY",
    models: [{ id: "veo-2.0-generate-001", label: "Veo 2.0", costPerSecUsd: null }],
    aspectRatios: ["16:9", "9:16"],
    durations: [5, 8],
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsReferenceConsistency: false,
    supportsCameraControls: false,
    supportsLightingControls: false,
    supportsExtend: false,
    supportsCancel: false,
  },
};

export const CAMERA_MOVEMENTS = [
  "Static",
  "Slow Push In (Dolly)",
  "Slow Pull Out",
  "Pan Left",
  "Pan Right",
  "Zoom In",
  "Zoom Out",
  "Tracking Shot",
  "Aerial Rise",
] as const;

export const LIGHTING_STYLES = [
  "Cinematic Warm",
  "Studio Softbox",
  "Dramatic Rim Light",
  "Golden Hour",
  "High-Contrast Neon",
  "Natural Daylight",
] as const;
