export interface MusicProviderCapabilities {
  provider: "ELEVENLABS_MUSIC" | "REPLICATE_MUSICGEN" | "SUNO";
  label: string;
  envKeyRef: string;
  supportsMusic: boolean;
  supportsSfx: boolean;
  supportsVocals: boolean;
  supportsBpm: boolean;
  supportsVariations: boolean;
  maxDurationSec: number;
  estimatedCostPerGenUsd: number;
  licenseType: string;
  licenseTermsUrl: string;
  commercialAllowed: boolean | null;
}

export const MUSIC_PROVIDER_CAPABILITIES: Record<string, MusicProviderCapabilities> = {
  ELEVENLABS_MUSIC: {
    provider: "ELEVENLABS_MUSIC",
    label: "ElevenLabs Sound & Music",
    envKeyRef: "ELEVENLABS_API_KEY",
    supportsMusic: true,
    supportsSfx: true,
    supportsVocals: false,
    supportsBpm: false,
    supportsVariations: true,
    maxDurationSec: 22,
    estimatedCostPerGenUsd: 0.04,
    licenseType: "ElevenLabs Commercial Terms (verify plan tier)",
    licenseTermsUrl: "https://elevenlabs.io/terms-of-use",
    commercialAllowed: null,
  },
  REPLICATE_MUSICGEN: {
    provider: "REPLICATE_MUSICGEN",
    label: "Replicate MusicGen",
    envKeyRef: "REPLICATE_API_TOKEN",
    supportsMusic: true,
    supportsSfx: false,
    supportsVocals: false,
    supportsBpm: false,
    supportsVariations: true,
    maxDurationSec: 30,
    estimatedCostPerGenUsd: 0.03,
    licenseType: "CC-BY-NC 4.0 (Non-Commercial unless commercial weights used)",
    licenseTermsUrl: "https://replicate.com/meta/musicgen",
    commercialAllowed: false,
  },
  SUNO: {
    provider: "SUNO",
    label: "Suno Music API",
    envKeyRef: "SUNO_API_KEY",
    supportsMusic: true,
    supportsSfx: false,
    supportsVocals: true,
    supportsBpm: true,
    supportsVariations: true,
    maxDurationSec: 120,
    estimatedCostPerGenUsd: 0.05,
    licenseType: "Suno Pro/Premier Commercial License (verify account tier)",
    licenseTermsUrl: "https://suno.com/terms",
    commercialAllowed: null,
  },
};

export const MUSIC_PRESETS = [
  "Motivational",
  "Cinematic",
  "Epic",
  "Emotional",
  "Inspirational",
  "Calm",
  "Ambient",
  "Educational",
  "Lo-Fi",
  "Energetic",
  "Suspense",
  "Documentary",
  "Trailer",
  "Corporate",
  "Piano",
  "Orchestral",
] as const;

export const SFX_CATEGORIES = [
  "Whoosh",
  "Impact",
  "Rise",
  "Transition",
  "Cinematic Boom",
  "Atmosphere",
  "Notification",
  "Ambient Sound",
  "Educational Animation",
] as const;

export const MUSIC_STRUCTURES = [
  "Calm opening",
  "Gradual build",
  "Emotional rise",
  "Powerful climax",
  "Outro",
] as const;
