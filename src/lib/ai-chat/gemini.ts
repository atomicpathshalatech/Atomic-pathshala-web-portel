import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGeminiErrorDetails,
  isRetryableGeminiError,
  mapGeminiError,
} from "@/lib/ai-chat/errors";
import { getSystemPrompt } from "@/lib/ai-chat/prompts";
import type {
  ChatRequestAttachment,
  ChatRequestBody,
  Language,
  StudentProfile,
} from "@/types/ai-chat";

// Ordered fallback chain of models. If ALL API keys are exhausted for a
// given model, we move on to the next model in this list.
const MODEL_FALLBACKS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
] as const;
const RETRY_BASE_DELAY_MS = 800; // small backoff between key attempts
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const TRANSIENT_COOLDOWN_MS = 15_000;
const retryCooldownUntil = new Map<string, number>();

type ContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

const MEDIA_ONLY_PROMPTS: Record<Language, string> = {
  english:
    "Please analyze the attached academic material carefully and solve my doubt step by step.",
  hindi:
    "कृपया संलग्न शैक्षणिक सामग्री को ध्यान से पढ़कर मेरा सवाल चरणबद्ध तरीके से हल करें।",
  hinglish:
    "Please attached academic material ko carefully analyze karke mera doubt step-by-step solve karo.",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads all configured Gemini API keys. Supports:
 *  - GEMINI_API_KEYS=key1,key2,key3   (preferred, comma-separated)
 *  - GEMINI_API_KEY=key1              (legacy, single key, still works)
 * Both can be present; results are merged and de-duplicated, preserving order.
 */
function getApiKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS?.trim();
  const single = process.env.GEMINI_API_KEY?.trim();

  const raw = [
    ...(multi ? multi.split(",") : []),
    ...(single ? [single] : []),
  ]
    .map((k) => k.trim())
    .filter((k) => k && !k.includes("your_gemini_api_key") && !k.includes("_gemini_api_key"));

  const uniqueKeys = [...new Set(raw)];

  if (uniqueKeys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY to your .env.local file."
    );
  }

  return uniqueKeys;
}

function maskKey(key: string) {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function retryCooldownKey(modelName: string, apiKey: string) {
  return `${modelName}:${apiKey}`;
}

function retryReason(error: unknown) {
  const lower = getGeminiErrorDetails(error).toLowerCase();

  if (lower.includes("quota")) return "quota";
  if (lower.includes("rate limit") || lower.includes("429")) return "rate limit";
  if (lower.includes("503") || lower.includes("overloaded") || lower.includes("unavailable")) {
    return "model overloaded";
  }

  return "transient";
}

function retryCooldownMs(error: unknown) {
  const reason = retryReason(error);
  return reason === "quota" || reason === "rate limit"
    ? RATE_LIMIT_COOLDOWN_MS
    : TRANSIENT_COOLDOWN_MS;
}

function availableKeysForModel(modelName: string, apiKeys: string[]) {
  const now = Date.now();
  const available = apiKeys.filter((apiKey) => {
    const retryAt = retryCooldownUntil.get(retryCooldownKey(modelName, apiKey));
    return !retryAt || retryAt <= now;
  });

  return available.length ? available : apiKeys;
}

function markRetryableFailure(modelName: string, apiKey: string, error: unknown) {
  const cooldownMs = retryCooldownMs(error);
  retryCooldownUntil.set(
    retryCooldownKey(modelName, apiKey),
    Date.now() + cooldownMs
  );

  console.warn(
    `[Gemini] Key ${maskKey(apiKey)} failed on model "${modelName}" (${retryReason(error)}). Cooling down for ${Math.round(cooldownMs / 1000)}s before retrying it.`
  );
}

function createModel(body: ChatRequestBody, modelName: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: getSystemPrompt(body.language, body.studentProfile),
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.1,
      topP: 0.95,
    },
  });
}

function profileContext(profile?: StudentProfile) {
  if (!profile) return "";

  const lines = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.className ? `Class: ${profile.className}` : null,
    profile.target ? `Target: ${profile.target}` : null,
    profile.board ? `Board: ${profile.board}` : null,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) return "";

  return `\n\nStudent profile:\n${lines.join("\n")}`;
}

function attachmentContext(attachments: ChatRequestAttachment[] = []) {
  if (attachments.length === 0) return "";

  const summary = attachments
    .map((attachment, index) => {
      const label = attachment.kind === "pdf" ? "PDF" : "Image";
      const extractedText = attachment.extractedText?.trim()
        ? `\nExtracted text:\n${attachment.extractedText.trim()}`
        : "";

      return `${index + 1}. ${label}: ${attachment.name}${extractedText}`;
    })
    .join("\n");

  return `\n\nAttached material:\n${summary}\n\nFor PDFs, extract all readable text first. If the PDF is scanned or handwritten, perform OCR from the visual pages before solving.`;
}

function buildParts(
  language: Language,
  content: string,
  attachments: ChatRequestAttachment[] = [],
  studentProfile?: StudentProfile,
  legacyImageBase64?: string,
  legacyImageMimeType?: string
): ContentPart[] {
  const parts: ContentPart[] = [];

  attachments.forEach((attachment) => {
    if (!attachment.base64) return;

    parts.push({
      inlineData: {
        data: attachment.base64,
        mimeType: attachment.mimeType,
      },
    });
  });

  if (legacyImageBase64 && legacyImageMimeType) {
    parts.push({
      inlineData: {
        data: legacyImageBase64,
        mimeType: legacyImageMimeType,
      },
    });
  }

  const promptText = [
    content.trim() || MEDIA_ONLY_PROMPTS[language],
    attachmentContext(attachments),
    profileContext(studentProfile),
  ]
    .filter(Boolean)
    .join("");

  parts.push({ text: promptText });

  return parts;
}

function buildChat(body: ChatRequestBody, modelName: string, apiKey: string) {
  const model = createModel(body, modelName, apiKey);
  const history = body.messages.slice(0, -1).map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("model" as const),
    parts: buildParts(
      body.language,
      message.content,
      message.attachments,
      body.studentProfile,
      message.imageBase64,
      message.imageMimeType
    ),
  }));

  const lastMessage = body.messages[body.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("Last message must be from the user.");
  }

  return {
    chat: model.startChat({ history }),
    lastParts: buildParts(
      body.language,
      lastMessage.content,
      lastMessage.attachments,
      body.studentProfile,
      lastMessage.imageBase64,
      lastMessage.imageMimeType
    ),
  };
}

function assertNonEmptyResponse(text: string, blockReason?: string) {
  if (text.trim()) return;

  if (blockReason) {
    throw new Error(`Response blocked: ${blockReason}`);
  }

  throw new Error("Empty response from Gemini.");
}

export async function generateChatResponse(body: ChatRequestBody): Promise<string> {
  const apiKeys = getApiKeys(); // throws immediately if none configured
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    const availableKeys = availableKeysForModel(modelName, apiKeys);

    for (let i = 0; i < availableKeys.length; i++) {
      // i < availableKeys.length by the loop bound, so this index is
      // always in range — noUncheckedIndexedAccess just can't see that.
      const apiKey = availableKeys[i]!;
      try {
        const { chat, lastParts } = buildChat(body, modelName, apiKey);
        const result = await chat.sendMessage(lastParts);
        const response = result.response;
        const text = response.text();

        assertNonEmptyResponse(text, response.promptFeedback?.blockReason);

        return text.trim();
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error)) {
          throw mapGeminiError(error);
        }

        markRetryableFailure(modelName, apiKey, error);

        const isLastKeyForModel = i === availableKeys.length - 1;
        if (!isLastKeyForModel) {
          await sleep(RETRY_BASE_DELAY_MS);
        }
        // else: fall through to try the next model with all keys again
      }
    }
  }

  throw mapGeminiError(lastError);
}

export async function* generateChatResponseStream(
  body: ChatRequestBody,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const apiKeys = getApiKeys(); // throws immediately if none configured
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    const availableKeys = availableKeysForModel(modelName, apiKeys);

    for (let i = 0; i < availableKeys.length; i++) {
      // i < availableKeys.length by the loop bound, so this index is
      // always in range — noUncheckedIndexedAccess just can't see that.
      const apiKey = availableKeys[i]!;
      let yieldedAnythingThisAttempt = false;

      try {
        const { chat, lastParts } = buildChat(body, modelName, apiKey);
        const result = await chat.sendMessageStream(lastParts, { signal });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (!text) continue;

          yieldedAnythingThisAttempt = true;
          yield text;
        }

        const response = await result.response;
        const finalText = response.text();

        if (!yieldedAnythingThisAttempt && finalText.trim()) {
          yield finalText;
          return;
        }

        assertNonEmptyResponse(finalText, response.promptFeedback?.blockReason);
        return; // success
      } catch (error) {
        // Already streamed partial content — can't switch keys/models mid-response.
        if (yieldedAnythingThisAttempt) {
          throw mapGeminiError(error);
        }

        lastError = error;

        if (!isRetryableGeminiError(error)) {
          throw mapGeminiError(error);
        }

        markRetryableFailure(modelName, apiKey, error);

        const isLastKeyForModel = i === availableKeys.length - 1;
        if (!isLastKeyForModel) {
          await sleep(RETRY_BASE_DELAY_MS);
        }
      }
    }
  }

  throw mapGeminiError(lastError);
}

const QUIZ_SYSTEM_INSTRUCTION = `You are a NEET question generator for Atomic Pathshala. You output ONLY valid JSON matching the exact schema requested by the user message. No markdown, no headings, no code fences, no commentary before or after the JSON. Follow the latest NCERT and NTA NEET syllabus. Never invent fake facts. Never fabricate PYQs; generate original NEET-standard practice questions instead.`;

export async function generateQuizQuestions(promptText: string): Promise<string> {
  const apiKeys = getApiKeys();
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    const availableKeys = availableKeysForModel(modelName, apiKeys);

    for (let i = 0; i < availableKeys.length; i++) {
      // i < availableKeys.length by the loop bound, so this index is
      // always in range — noUncheckedIndexedAccess just can't see that.
      const apiKey = availableKeys[i]!;
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: QUIZ_SYSTEM_INSTRUCTION,
          generationConfig: {
            maxOutputTokens: 8192,
           temperature: 0.1,
            topP: 0.95,
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(promptText);
        const text = result.response.text();
        assertNonEmptyResponse(text, result.response.promptFeedback?.blockReason);

        return text.trim();
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error)) {
          throw mapGeminiError(error);
        }

        markRetryableFailure(modelName, apiKey, error);

        const isLastKeyForModel = i === availableKeys.length - 1;
        if (!isLastKeyForModel) {
          await sleep(RETRY_BASE_DELAY_MS);
        }
      }
    }
  }

  throw mapGeminiError(lastError);
}
const BOARD_EXAM_SYSTEM_INSTRUCTION = `You are a board-exam question generator for Atomic Pathshala, covering CBSE and Hindi-medium state boards (UP, Bihar, MP, Rajasthan, Uttarakhand, Haryana, Jharkhand, Chhattisgarh, Himachal, J&K). You output ONLY valid JSON matching the exact schema requested by the user message. No markdown, no headings, no code fences, no commentary before or after the JSON. Follow the latest NCERT/state board syllabus for the given class and subject. Never fabricate or copy actual official past-year questions verbatim - always generate original questions in the same style, difficulty, and pattern instead.`;

export async function generateBoardExamContent(promptText: string): Promise<string> {
  const apiKeys = getApiKeys();
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    const availableKeys = availableKeysForModel(modelName, apiKeys);

    for (let i = 0; i < availableKeys.length; i++) {
      // i < availableKeys.length by the loop bound, so this index is
      // always in range — noUncheckedIndexedAccess just can't see that.
      const apiKey = availableKeys[i]!;
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: BOARD_EXAM_SYSTEM_INSTRUCTION,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1,
            topP: 0.95,
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(promptText);
        const text = result.response.text();
        assertNonEmptyResponse(text, result.response.promptFeedback?.blockReason);

        return text.trim();
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error)) {
          throw mapGeminiError(error);
        }

        markRetryableFailure(modelName, apiKey, error);

        const isLastKeyForModel = i === availableKeys.length - 1;
        if (!isLastKeyForModel) {
          await sleep(RETRY_BASE_DELAY_MS);
        }
      }
    }
  }

  throw mapGeminiError(lastError);
}
