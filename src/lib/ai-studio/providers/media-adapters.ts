import "server-only";
import OpenAI from "openai";
import { StudioImageRequest, StudioProviderError, StudioVoiceRequest } from "../types";

function cleanEnvKey(envKeyRef: string): string | null {
  const raw = process.env[envKeyRef];
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

export async function invokeImageProvider(params: {
  provider: string;
  modelId: string;
  envKeyRef: string;
  request: StudioImageRequest;
}): Promise<{ buffer: Buffer; mimeType: string; revisedPrompt?: string; durationMs: number }> {
  const { provider, modelId, envKeyRef, request } = params;
  const start = Date.now();

  if (provider !== "OPENAI") {
    throw new StudioProviderError(
      `Image provider ${provider} adapter not yet enabled. Configure OPENAI or add adapter in Phase 03.`,
      "NOT_CONFIGURED",
      provider,
      true
    );
  }

  const apiKey = cleanEnvKey(envKeyRef);
  if (!apiKey) {
    throw new StudioProviderError(`Missing key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
  }

  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model: modelId,
    prompt: request.prompt,
    size: request.size || "1024x1024",
    quality: request.quality || "standard",
    response_format: "b64_json",
    n: 1,
  });

  const item = result.data?.[0];
  if (!item?.b64_json) {
    throw new StudioProviderError("OpenAI image generation returned empty payload", "PROVIDER_UNAVAILABLE", provider, true);
  }

  return {
    buffer: Buffer.from(item.b64_json, "base64"),
    mimeType: "image/png",
    revisedPrompt: item.revised_prompt,
    durationMs: Date.now() - start,
  };
}

export async function invokeVoiceProvider(params: {
  provider: string;
  modelId: string;
  envKeyRef: string;
  request: StudioVoiceRequest;
}): Promise<{ buffer: Buffer; mimeType: string; durationMs: number }> {
  const { provider, modelId, envKeyRef, request } = params;
  const start = Date.now();

  if (provider !== "OPENAI") {
    throw new StudioProviderError(
      `Voice provider ${provider} adapter not yet enabled. Configure OPENAI or add ElevenLabs/Sarvam adapter in Phase 04.`,
      "NOT_CONFIGURED",
      provider,
      true
    );
  }

  const apiKey = cleanEnvKey(envKeyRef);
  if (!apiKey) {
    throw new StudioProviderError(`Missing key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
  }

  const client = new OpenAI({ apiKey });
  const format = request.format || "mp3";
  const speech = await client.audio.speech.create({
    model: modelId,
    voice: (request.voiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer") || "nova",
    input: request.text,
    speed: request.speed ?? 1.0,
    response_format: format,
  });

  const arrayBuffer = await speech.arrayBuffer();
  const mimeType = format === "wav" ? "audio/wav" : format === "opus" ? "audio/opus" : "audio/mpeg";
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
    durationMs: Date.now() - start,
  };
}
