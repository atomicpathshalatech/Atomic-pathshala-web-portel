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

  if (provider === "GEMINI") {
    const apiKey = cleanEnvKey(envKeyRef) || cleanEnvKey("GEMINI_API_KEY");
    if (!apiKey) {
      throw new StudioProviderError(`Missing key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
    }

    // Try Imagen 3 predict endpoint first, then Gemini native image generation
    const aspectRatio =
      request.size === "1792x1024" ? "16:9" : request.size === "1024x1792" ? "9:16" : "1:1";

    const imagenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelId || "imagen-3.0-generate-002"
      )}:predict?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: request.prompt }],
          parameters: { sampleCount: 1, aspectRatio },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    if (imagenRes.ok) {
      const json = (await imagenRes.json()) as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };
      const b64 = json.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        return {
          buffer: Buffer.from(b64, "base64"),
          mimeType: json.predictions?.[0]?.mimeType || "image/png",
          durationMs: Date.now() - start,
        };
      }
    }

    // Fallback to Gemini 2.0 Flash image generation
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      throw new StudioProviderError(
        `Gemini image generation failed (${geminiRes.status}): ${errText.slice(0, 200)}`,
        "PROVIDER_UNAVAILABLE",
        provider,
        true
      );
    }

    const gJson = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
        };
      }>;
    };
    const inline = gJson.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      throw new StudioProviderError("Gemini image generation returned empty payload", "PROVIDER_UNAVAILABLE", provider, true);
    }
    return {
      buffer: Buffer.from(inline.data, "base64"),
      mimeType: inline.mimeType || "image/png",
      durationMs: Date.now() - start,
    };
  }

  if (provider !== "OPENAI") {
    throw new StudioProviderError(
      `Image provider ${provider} adapter not yet enabled. Configure OPENAI or GEMINI.`,
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
