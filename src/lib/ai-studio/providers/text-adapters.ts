import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { readGeminiKeys } from "@/lib/ai/gemini-models";
import { StudioProviderError, StudioTextRequest } from "../types";

export interface RawTextAdapterResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

function cleanEnvKey(envKeyRef: string): string | null {
  const raw = process.env[envKeyRef];
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

function classifyProviderError(err: unknown, provider: string): StudioProviderError {
  if (err instanceof StudioProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return new StudioProviderError(msg, "RATE_LIMIT", provider, true);
  }
  if (lower.includes("quota") || lower.includes("insufficient_quota") || lower.includes("billing")) {
    return new StudioProviderError(msg, "QUOTA_EXCEEDED", provider, true);
  }
  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("aborted")) {
    return new StudioProviderError(msg, "TIMEOUT", provider, true);
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("api key") || lower.includes("unauthorized")) {
    return new StudioProviderError(msg, "AUTH_ERROR", provider, false);
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("overloaded")) {
    return new StudioProviderError(msg, "PROVIDER_UNAVAILABLE", provider, true);
  }
  return new StudioProviderError(msg, "PROVIDER_UNAVAILABLE", provider, true);
}

export function isEnvKeyConfigured(envKeyRef: string): boolean {
  if (envKeyRef === "GEMINI_API_KEY" || envKeyRef === "GEMINI_API_KEYS") {
    return Boolean(cleanEnvKey(envKeyRef)) || readGeminiKeys().length > 0;
  }
  return Boolean(cleanEnvKey(envKeyRef));
}

export async function invokeTextProvider(params: {
  provider: string;
  modelId: string;
  envKeyRef: string;
  request: StudioTextRequest;
}): Promise<RawTextAdapterResult> {
  const { provider, modelId, envKeyRef, request } = params;
  const start = Date.now();

  try {
    if (provider === "GEMINI") {
      const directKey = cleanEnvKey(envKeyRef);
      const key = directKey || readGeminiKeys()[0];
      if (!key) {
        throw new StudioProviderError(`Missing Gemini key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
      }
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: modelId,
        ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
        generationConfig: {
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { maxOutputTokens: request.maxTokens } : {}),
          ...(request.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
        },
      });
      const result = await model.generateContent(request.prompt);
      const response = result.response;
      const usage = response.usageMetadata;
      return {
        text: response.text(),
        inputTokens: usage?.promptTokenCount ?? Math.ceil(request.prompt.length / 4),
        outputTokens: usage?.candidatesTokenCount ?? Math.ceil(response.text().length / 4),
        durationMs: Date.now() - start,
      };
    }

    if (provider === "OPENAI" || provider === "XAI_GROK" || provider === "GROQ") {
      const apiKey = cleanEnvKey(envKeyRef);
      if (!apiKey) {
        throw new StudioProviderError(`Missing key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
      }
      const baseURL =
        provider === "XAI_GROK"
          ? process.env.XAI_BASE_URL || process.env.GROK_BASE_URL || "https://api.x.ai/v1"
          : provider === "GROQ"
            ? process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
            : undefined;

      const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      if (request.systemPrompt) messages.push({ role: "system", content: request.systemPrompt });
      messages.push({ role: "user", content: request.prompt });

      const completion = await client.chat.completions.create({
        model: modelId,
        messages,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
        ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      });

      const text = completion.choices[0]?.message?.content ?? "";
      return {
        text,
        inputTokens: completion.usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4),
        outputTokens: completion.usage?.completion_tokens ?? Math.ceil(text.length / 4),
        durationMs: Date.now() - start,
      };
    }

    if (provider === "ANTHROPIC") {
      const apiKey = cleanEnvKey(envKeyRef);
      if (!apiKey) {
        throw new StudioProviderError(`Missing key (${envKeyRef})`, "NOT_CONFIGURED", provider, true);
      }
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: modelId,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        messages: [{ role: "user", content: request.prompt }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return {
        text,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        durationMs: Date.now() - start,
      };
    }

    throw new StudioProviderError(`Unsupported text provider: ${provider}`, "NOT_CONFIGURED", provider, false);
  } catch (err) {
    throw classifyProviderError(err, provider);
  }
}
