import "server-only";
import OpenAI from "openai";
import { assertStudioBudget, recordStudioUsage } from "../budget";
import { StudioProviderError } from "../types";
import { VOICE_PROVIDER_CAPABILITIES } from "./capabilities";

function cleanKey(envRef: string): string | null {
  const raw = process.env[envRef];
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

export function isVoiceProviderConfigured(provider: string): boolean {
  const cap = VOICE_PROVIDER_CAPABILITIES[provider];
  if (!cap) return false;
  return Boolean(cleanKey(cap.envKeyRef));
}

export async function synthesizeVoiceSegment(params: {
  provider: string;
  model: string;
  voiceId: string;
  text: string;
  format: "mp3" | "wav";
  speed?: number;
  stability?: number;
  styleExaggeration?: number;
  pitch?: number;
  instructions?: string;
  userId: string;
  roleName?: string;
  projectId?: string;
}): Promise<{ buffer: Buffer; mimeType: string; durationMs: number; costUsd: number }> {
  const cap = VOICE_PROVIDER_CAPABILITIES[params.provider];
  if (!cap) {
    throw new StudioProviderError(`Unknown voice provider: ${params.provider}`, "NOT_CONFIGURED", params.provider, false);
  }

  const modelMeta = cap.models.find((m) => m.id === params.model) || cap.models[0];
  const ratePer1K = modelMeta?.costPer1KCharsUsd ?? 0.015;
  const costUsd = Number(((params.text.length / 1000) * ratePer1K).toFixed(6));

  await assertStudioBudget({
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
    estimatedCostUsd: costUsd,
  });

  const apiKey = cleanKey(cap.envKeyRef);
  if (!apiKey) {
    throw new StudioProviderError(
      `${cap.label} is not configured (${cap.envKeyRef} missing).`,
      "NOT_CONFIGURED",
      params.provider,
      false
    );
  }

  const start = Date.now();
  try {
    let buffer: Buffer;
    let mimeType = params.format === "wav" ? "audio/wav" : "audio/mpeg";

    if (params.provider === "OPENAI") {
      const client = new OpenAI({ apiKey });
      const speech = await client.audio.speech.create({
        model: params.model || "tts-1",
        voice: (params.voiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer") || "nova",
        input: params.text,
        speed: params.speed ?? 1.0,
        response_format: params.format,
        ...(params.model === "gpt-4o-mini-tts" && params.instructions
          ? { instructions: params.instructions }
          : {}),
      });
      buffer = Buffer.from(await speech.arrayBuffer());
    } else if (params.provider === "ELEVENLABS") {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(params.voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: mimeType,
          },
          body: JSON.stringify({
            text: params.text,
            model_id: params.model || "eleven_multilingual_v2",
            voice_settings: {
              stability: params.stability ?? 0.5,
              similarity_boost: 0.75,
              style: params.styleExaggeration ?? 0.0,
              speed: params.speed ?? 1.0,
            },
          }),
          signal: AbortSignal.timeout(45000),
        }
      );
      if (!res.ok) {
        throw new Error(`ElevenLabs returned ${res.status}: ${await res.text()}`);
      }
      buffer = Buffer.from(await res.arrayBuffer());
    } else if (params.provider === "SARVAM") {
      const res = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [params.text],
          target_language_code: "hi-IN",
          speaker: params.voiceId || "anushka",
          pace: params.speed ?? 1.0,
          pitch: params.pitch ?? 0,
          model: params.model || "bulbul:v2",
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        throw new Error(`Sarvam returned ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as { audios?: string[] };
      const b64 = data.audios?.[0];
      if (!b64) throw new Error("Sarvam returned empty audio payload");
      buffer = Buffer.from(b64, "base64");
      mimeType = "audio/wav";
    } else {
      throw new StudioProviderError(`Unsupported voice provider ${params.provider}`, "NOT_CONFIGURED", params.provider, false);
    }

    const durationMs = Date.now() - start;
    await recordStudioUsage({
      feature: "CONTENT_STUDIO_VOICE",
      provider: params.provider,
      model: params.model,
      modality: "VOICE",
      userId: params.userId,
      projectId: params.projectId,
      durationMs,
      costUsd,
      ok: true,
    });

    return { buffer, mimeType, durationMs, costUsd };
  } catch (err) {
    await recordStudioUsage({
      feature: "CONTENT_STUDIO_VOICE",
      provider: params.provider,
      model: params.model,
      modality: "VOICE",
      userId: params.userId,
      projectId: params.projectId,
      durationMs: Date.now() - start,
      costUsd: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
