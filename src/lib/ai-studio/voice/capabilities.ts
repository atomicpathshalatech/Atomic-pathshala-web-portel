export interface VoiceProviderCapabilities {
  provider: "OPENAI" | "ELEVENLABS" | "SARVAM";
  label: string;
  envKeyRef: string;
  models: Array<{ id: string; label: string; costPer1KCharsUsd: number }>;
  formats: Array<"mp3" | "wav">;
  supportsSpeed: boolean;
  speedRange: [number, number];
  supportsStability: boolean;
  supportsStyleExaggeration: boolean;
  supportsPitch: boolean;
  supportsEmotion: boolean;
  supportsInstructions: boolean;
  supportsCloning: boolean;
  languages: string[];
}

export const VOICE_PROVIDER_CAPABILITIES: Record<string, VoiceProviderCapabilities> = {
  OPENAI: {
    provider: "OPENAI",
    label: "OpenAI TTS",
    envKeyRef: "OPENAI_API_KEY",
    models: [
      { id: "tts-1", label: "TTS-1 (Standard)", costPer1KCharsUsd: 0.015 },
      { id: "tts-1-hd", label: "TTS-1 HD", costPer1KCharsUsd: 0.03 },
      { id: "gpt-4o-mini-tts", label: "GPT-4o Mini TTS (Instructable)", costPer1KCharsUsd: 0.015 },
    ],
    formats: ["mp3", "wav"],
    supportsSpeed: true,
    speedRange: [0.5, 2.0],
    supportsStability: false,
    supportsStyleExaggeration: false,
    supportsPitch: false,
    supportsEmotion: false,
    supportsInstructions: true,
    supportsCloning: false,
    languages: ["en", "hi", "hinglish"],
  },
  ELEVENLABS: {
    provider: "ELEVENLABS",
    label: "ElevenLabs",
    envKeyRef: "ELEVENLABS_API_KEY",
    models: [
      { id: "eleven_multilingual_v2", label: "Multilingual v2", costPer1KCharsUsd: 0.18 },
      { id: "eleven_flash_v2_5", label: "Flash v2.5", costPer1KCharsUsd: 0.09 },
    ],
    formats: ["mp3", "wav"],
    supportsSpeed: true,
    speedRange: [0.7, 1.2],
    supportsStability: true,
    supportsStyleExaggeration: true,
    supportsPitch: false,
    supportsEmotion: false,
    supportsInstructions: false,
    supportsCloning: true,
    languages: ["en", "hi", "hinglish"],
  },
  SARVAM: {
    provider: "SARVAM",
    label: "Sarvam AI (Indian Voices)",
    envKeyRef: "SARVAM_API_KEY",
    models: [{ id: "bulbul:v2", label: "Bulbul v2", costPer1KCharsUsd: 0.015 }],
    formats: ["wav"],
    supportsSpeed: true,
    speedRange: [0.5, 2.0],
    supportsStability: false,
    supportsStyleExaggeration: false,
    supportsPitch: true,
    supportsEmotion: false,
    supportsInstructions: false,
    supportsCloning: false,
    languages: ["hi", "en", "hinglish"],
  },
};

export const DELIVERY_PRESETS = [
  { id: "MOTIVATIONAL", label: "Motivational", speed: 1.05, instruction: "Speak with inspiring conviction and uplifting energy." },
  { id: "CINEMATIC", label: "Cinematic", speed: 0.92, instruction: "Speak in a deep, dramatic, measured cinematic narrator tone." },
  { id: "EDUCATIONAL", label: "Educational", speed: 1.0, instruction: "Speak clearly, warmly, and articulately like a master educator." },
  { id: "CALM", label: "Calm", speed: 0.94, instruction: "Speak calmly, gently, and reassuringly." },
  { id: "EMOTIONAL", label: "Emotional", speed: 0.95, instruction: "Speak with heartfelt empathy and emotional warmth." },
  { id: "ENERGETIC", label: "Energetic", speed: 1.12, instruction: "Speak with high enthusiasm and crisp pacing." },
  { id: "SERIOUS", label: "Serious", speed: 0.96, instruction: "Speak in a focused, authoritative, serious tone." },
  { id: "ANNOUNCEMENT", label: "Announcement", speed: 1.04, instruction: "Speak like an official, crisp platform announcement." },
  { id: "TRAILER", label: "Trailer", speed: 0.9, instruction: "Speak with intense trailer-style pauses and gravitas." },
  { id: "TEACHER_EXPLANATION", label: "Teacher Explanation", speed: 0.98, instruction: "Explain step-by-step like a classroom teacher emphasizing key concepts." },
] as const;

export const DEFAULT_OPENAI_VOICES = [
  { externalVoiceId: "nova", name: "Nova (Clear Educator)", gender: "Female", tone: "Warm & Clear", accent: "Neutral", language: "en" },
  { externalVoiceId: "onyx", name: "Onyx (Cinematic Deep)", gender: "Male", tone: "Deep & Authoritative", accent: "Neutral", language: "en" },
  { externalVoiceId: "alloy", name: "Alloy (Balanced)", gender: "Neutral", tone: "Balanced", accent: "Neutral", language: "en" },
  { externalVoiceId: "echo", name: "Echo (Conversational)", gender: "Male", tone: "Warm Conversational", accent: "Neutral", language: "en" },
  { externalVoiceId: "shimmer", name: "Shimmer (Energetic)", gender: "Female", tone: "Bright & Expressive", accent: "Neutral", language: "en" },
  { externalVoiceId: "fable", name: "Fable (Storyteller)", gender: "Neutral", tone: "Narrative", accent: "British-leaning", language: "en" },
];
