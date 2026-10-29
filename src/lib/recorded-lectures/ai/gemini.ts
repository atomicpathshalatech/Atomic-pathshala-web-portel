import "server-only";
import { readGeminiKeys } from "@/lib/ai/gemini-models";
import { pcmToWav } from "./format";

/**
 * The Gemini REST calls the lecture AI pass needs that the app's SDK helper
 * does not cover: the Files API (resumable upload of a large video) and
 * text-to-speech. Keys come from the existing Gemini configuration.
 */

const API = "https://generativelanguage.googleapis.com";

export const VIDEO_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3-flash-preview"] as const;
export const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-tts"] as const;
export const MAX_AI_FILE_BYTES = 2 * 1024 ** 3; // Files API limit per file

export class GeminiHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GeminiHttpError";
  }
  get quota() {
    return this.status === 429;
  }
}

export function geminiKeys(): string[] {
  return readGeminiKeys();
}

async function fail(res: Response, what: string): Promise<never> {
  const body = (await res.text().catch(() => "")).slice(0, 300);
  throw new GeminiHttpError(res.status, `${what} failed (HTTP ${res.status}) ${body.replace(/key=[^&\s"]+/g, "key=…")}`);
}

/** Starts a resumable upload; returns the session URL and the chunk size it accepts. */
export async function startFileUpload(key: string, p: { size: number; mimeType: string; displayName: string }) {
  const res = await fetch(`${API}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(p.size),
      "X-Goog-Upload-Header-Content-Type": p.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: p.displayName.slice(0, 120) } }),
  });
  if (!res.ok) await fail(res, "Starting the AI upload");
  const url = res.headers.get("x-goog-upload-url");
  if (!url) throw new GeminiHttpError(502, "The AI did not return an upload address.");
  const granularity = Number(res.headers.get("x-goog-upload-chunk-granularity")) || 8 * 1024 * 1024;
  return { url, granularity };
}

/** Sends one chunk at `offset`; on the last one returns the stored file. */
export async function uploadFileChunk(uploadUrl: string, offset: number, bytes: Uint8Array, last: boolean) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": String(offset),
      "X-Goog-Upload-Command": last ? "upload, finalize" : "upload",
    },
    body: bytes,
  });
  if (!res.ok) await fail(res, "Sending the video to the AI");
  if (!last) return null;
  const json = (await res.json()) as { file?: { name: string; uri: string } };
  if (!json.file?.name) throw new GeminiHttpError(502, "The AI did not confirm the uploaded file.");
  return json.file;
}

export async function getAiFile(key: string, name: string) {
  const res = await fetch(`${API}/v1beta/${name}?key=${key}`);
  if (!res.ok) await fail(res, "Checking the AI file");
  const f = (await res.json()) as { state?: string; uri?: string; videoMetadata?: { videoDuration?: string }; error?: { message?: string } };
  const dur = Number(String(f.videoMetadata?.videoDuration ?? "").replace(/s$/, ""));
  return { state: f.state ?? "STATE_UNSPECIFIED", uri: f.uri ?? null, durationSec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null, error: f.error?.message ?? null };
}

export async function deleteAiFile(key: string, name: string) {
  await fetch(`${API}/v1beta/${name}?key=${key}`, { method: "DELETE" }).catch(() => null);
}

/** One JSON answer about a clip of the uploaded video. */
export async function askAboutVideo(
  key: string,
  model: string,
  p: { fileUri: string; mimeType: string; from: number; to: number; prompt: string }
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: p.fileUri, mimeType: p.mimeType }, videoMetadata: { startOffset: `${Math.floor(p.from)}s`, endOffset: `${Math.ceil(p.to)}s` } },
            { text: p.prompt },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 32768, mediaResolution: "MEDIA_RESOLUTION_LOW" },
    }),
  });
  if (!res.ok) await fail(res, `Reading the lecture (${model})`);
  const json = (await res.json()) as any;
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join("");
  if (!text) throw new GeminiHttpError(502, `The AI returned no transcript (${json.candidates?.[0]?.finishReason ?? "no answer"}).`);
  return { text, tokensIn: json.usageMetadata?.promptTokenCount ?? 0, tokensOut: json.usageMetadata?.candidatesTokenCount ?? 0 };
}

let ttsCursor = 0;

/**
 * Speaks with whichever key and TTS model has quota: keys rotate (newest
 * first — the oldest are the depleted free keys), a key out of quota or
 * credit is skipped. Throws a 429 GeminiHttpError when every key is spent.
 */
export async function speakAnyKey(text: string, lang: "hi" | "en") {
  const keys = geminiKeys().slice().reverse();
  if (!keys.length) throw new GeminiHttpError(503, "No Gemini keys are configured.");
  let lastErr: unknown = null;
  for (let n = 0; n < keys.length; n++) {
    const key = keys[(ttsCursor + n) % keys.length]!;
    for (const model of TTS_MODELS) {
      try {
        const out = await speak(key, model, text, lang);
        ttsCursor = (ttsCursor + n + 1) % keys.length;
        return out;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof GeminiHttpError) || ![400, 402, 403, 404, 429].includes(err.status)) throw err;
      }
    }
  }
  if (lastErr instanceof GeminiHttpError && [429, 402, 403].includes(lastErr.status)) throw new GeminiHttpError(429, "Every AI voice key is out of quota for now.");
  throw lastErr ?? new GeminiHttpError(502, "AI voice failed.");
}

/** Speaks `text` (Hindi or English) as a teacher; returns a WAV file and its length. */
export async function speak(key: string, model: string, text: string, lang: "hi" | "en"): Promise<{ wav: Uint8Array; seconds: number }> {
  const style =
    lang === "hi"
      ? "Read this aloud in natural Hindi like a friendly Indian teacher explaining to students, at a steady classroom pace:"
      : "Read this aloud in clear Indian English like a friendly teacher explaining to students, at a steady classroom pace:";
  const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${style}\n${text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
    }),
  });
  if (!res.ok) await fail(res, `AI voice (${model})`);
  const json = (await res.json()) as any;
  const part = (json.candidates?.[0]?.content?.parts ?? []).find((x: any) => x.inlineData?.data);
  if (!part) throw new GeminiHttpError(502, "The AI voice returned no audio.");
  const bytes = new Uint8Array(Buffer.from(part.inlineData.data, "base64"));
  const mime = String(part.inlineData.mimeType ?? "");
  // Some models send a ready WAV, others raw 16-bit PCM ("audio/L16;rate=24000").
  const isWav = bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF";
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const wav = isWav ? bytes : pcmToWav(bytes, rate);
  const dataBytes = isWav ? Math.max(0, bytes.length - 44) : bytes.length;
  const wavRate = isWav ? new DataView(bytes.buffer, bytes.byteOffset).getUint32(24, true) || rate : rate;
  return { wav, seconds: dataBytes / (wavRate * 2) };
}
