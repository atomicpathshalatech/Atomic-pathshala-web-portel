import "server-only";
import { assertStudioBudget, recordStudioUsage } from "../budget";
import { StudioProviderError } from "../types";
import { MUSIC_PROVIDER_CAPABILITIES } from "./capabilities";

function cleanKey(envRef: string): string | null {
  const raw = process.env[envRef];
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

export function isMusicProviderConfigured(provider: string): boolean {
  const cap = MUSIC_PROVIDER_CAPABILITIES[provider];
  if (!cap) return false;
  return Boolean(cleanKey(cap.envKeyRef));
}

export async function generateMusicOrSfxAudio(params: {
  provider: string;
  kind: "MUSIC" | "SFX";
  prompt: string;
  durationSec: number;
  userId: string;
  roleName?: string;
  projectId?: string;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  model: string;
  durationMs: number;
  costUsd: number;
}> {
  const cap = MUSIC_PROVIDER_CAPABILITIES[params.provider];
  if (!cap) {
    throw new StudioProviderError(`Unsupported music provider: ${params.provider}`, "NOT_CONFIGURED", params.provider, false);
  }

  await assertStudioBudget({
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
    estimatedCostUsd: cap.estimatedCostPerGenUsd,
  });

  const apiKey = cleanKey(cap.envKeyRef);
  if (!apiKey) {
    throw new StudioProviderError(
      `${cap.label} is not configured (${cap.envKeyRef} missing in environment).`,
      "NOT_CONFIGURED",
      params.provider,
      false
    );
  }

  const start = Date.now();
  const clampedDur = Math.max(2, Math.min(cap.maxDurationSec, params.durationSec));

  try {
    if (params.provider === "ELEVENLABS_MUSIC") {
      const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: params.prompt,
          duration_seconds: clampedDur,
          prompt_influence: 0.4,
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        throw new Error(`ElevenLabs Sound API error ${res.status}: ${await res.text()}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const durationMs = Date.now() - start;
      await recordStudioUsage({
        feature: `CONTENT_STUDIO_${params.kind}`,
        provider: params.provider,
        model: "sound-generation-v1",
        modality: "MUSIC",
        userId: params.userId,
        projectId: params.projectId,
        durationMs,
        costUsd: cap.estimatedCostPerGenUsd,
        ok: true,
      });
      return {
        buffer,
        mimeType: "audio/mpeg",
        model: "sound-generation-v1",
        durationMs,
        costUsd: cap.estimatedCostPerGenUsd,
      };
    }

    if (params.provider === "REPLICATE_MUSICGEN") {
      const createRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "wait=40",
        },
        body: JSON.stringify({
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
          input: {
            prompt: params.prompt,
            duration: clampedDur,
            output_format: "mp3",
          },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!createRes.ok) {
        throw new Error(`Replicate error ${createRes.status}: ${await createRes.text()}`);
      }
      const pred = (await createRes.json()) as { status?: string; output?: string; error?: string };
      if (pred.status !== "succeeded" || !pred.output) {
        throw new Error(pred.error || `Replicate prediction status: ${pred.status}`);
      }
      const audioRes = await fetch(pred.output, { signal: AbortSignal.timeout(20000) });
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      const durationMs = Date.now() - start;
      await recordStudioUsage({
        feature: `CONTENT_STUDIO_${params.kind}`,
        provider: params.provider,
        model: "meta/musicgen",
        modality: "MUSIC",
        userId: params.userId,
        projectId: params.projectId,
        durationMs,
        costUsd: cap.estimatedCostPerGenUsd,
        ok: true,
      });
      return {
        buffer,
        mimeType: "audio/mpeg",
        model: "meta/musicgen",
        durationMs,
        costUsd: cap.estimatedCostPerGenUsd,
      };
    }

    if (params.provider === "SUNO") {
      const baseUrl = process.env.SUNO_BASE_URL || "https://api.sunoapi.org/api/v1";
      const res = await fetch(`${baseUrl}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt,
          instrumental: true,
          model: "V4",
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        throw new Error(`Suno API error ${res.status}: ${await res.text()}`);
      }
      throw new StudioProviderError(
        "Suno async webhook/polling integration requires SUNO_CALLBACK_URL; configure ELEVENLABS_API_KEY or REPLICATE_API_TOKEN for synchronous generation.",
        "NOT_CONFIGURED",
        "SUNO",
        false
      );
    }

    throw new StudioProviderError(`Unsupported provider ${params.provider}`, "NOT_CONFIGURED", params.provider, false);
  } catch (err) {
    await recordStudioUsage({
      feature: `CONTENT_STUDIO_${params.kind}`,
      provider: params.provider,
      model: "default",
      modality: "MUSIC",
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
