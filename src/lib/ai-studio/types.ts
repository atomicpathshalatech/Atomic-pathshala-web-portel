import "server-only";

export type StudioModality =
  | "TEXT"
  | "IMAGE"
  | "VOICE"
  | "MUSIC"
  | "VIDEO"
  | "SLIDE"
  | "RESEARCH";

export type StudioTaskType =
  | "GENERAL"
  | "RESEARCH"
  | "TOPIC_ANALYSIS"
  | "SCRIPT_WRITING"
  | "SEO"
  | "CHEMISTRY_VERIFICATION"
  | "THUMBNAIL_PROMPT"
  | "CONTENT_PLANNING"
  | "SUMMARIZATION";

export type StudioProviderId =
  | "GEMINI"
  | "OPENAI"
  | "XAI_GROK"
  | "ANTHROPIC"
  | "GROQ"
  | "ELEVENLABS"
  | "SARVAM"
  | "SUNO"
  | "RUNWAY"
  | "KLING";

export type StudioErrorCode =
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_INPUT"
  | "BUDGET_EXCEEDED"
  | "NOT_CONFIGURED";

export class StudioProviderError extends Error {
  public readonly code: StudioErrorCode;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: StudioErrorCode,
    provider: string,
    retryable = false
  ) {
    super(message);
    this.name = "StudioProviderError";
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
  }
}

export interface StudioProviderDescriptor {
  id?: string;
  provider: string;
  modality: StudioModality;
  taskType?: StudioTaskType | string;
  modelId: string;
  displayName: string;
  envKeyRef: string;
  priority: number;
  isEnabled: boolean;
  isDefault: boolean;
  fallbackConfigId?: string | null;
  fallbackProvider?: string | null;
  fallbackModelId?: string | null;
  timeoutMs?: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  unitCostUsd: number;
  configJson?: Record<string, unknown> | null;
}

export interface StudioTextRequest {
  prompt: string;
  systemPrompt?: string;
  taskType?: StudioTaskType;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  responseFormat?: "text" | "json";
  preferredProvider?: string;
  preferredModel?: string;
  feature: string;
  userId: string;
  roleName?: string;
  projectId?: string;
  jobId?: string;
}

export interface StudioTextResponse {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number | null;
  costInr: number | null;
  isFallback: boolean;
}

export interface StudioImageRequest {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  preferredProvider?: string;
  preferredModel?: string;
  feature: string;
  userId: string;
  roleName?: string;
  projectId?: string;
  jobId?: string;
}

export interface StudioImageResponse {
  buffer: Buffer;
  mimeType: string;
  revisedPrompt?: string;
  provider: string;
  model: string;
  durationMs: number;
  costUsd: number;
  costInr: number;
  isFallback: boolean;
}

export interface StudioVoiceRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  format?: "mp3" | "wav" | "opus";
  preferredProvider?: string;
  preferredModel?: string;
  feature: string;
  userId: string;
  roleName?: string;
  projectId?: string;
  jobId?: string;
}

export interface StudioVoiceResponse {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
  durationMs: number;
  costUsd: number;
  costInr: number;
  isFallback: boolean;
}
