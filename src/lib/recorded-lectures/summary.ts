import "server-only";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import {
  buildSummaryPrompt,
  buildVideoSummaryPrompt,
  buildSummaryTranslationPrompt,
  checkSummaryTranslation,
  parseSummaryResponse,
  summaryToMarkdown,
  aboutWordCount,
  MIN_ABOUT_WORDS,
} from "./summary-format";

export class SummaryUnavailableError extends Error {
  constructor(message: string, public code: "AI_NOT_CONFIGURED" | "AI_FAILED" | "TIMEOUT" | "INSUFFICIENT" | "INVALID") {
    super(message);
    this.name = "SummaryUnavailableError";
  }
}

const TIMEOUT_MS = 90_000;

/** Is an AI provider configured at all? (The existing Gemini setup.) */
export function summaryAiConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEYS?.trim() ||
      process.env.GEMINI_FREE_KEYS?.trim() ||
      process.env.GEMINI_PAID_KEYS?.trim()
  );
}

/**
 * Generates a summary from the teacher's About — through the app's existing
 * Gemini integration (key rotation + model fallback), nothing new. Throws
 * SummaryUnavailableError with a clear reason; never returns made-up text.
 */
export async function generateLectureSummary(p: {
  about: string;
  title: string;
  subject: string;
  chapter: string;
  language: string;
}): Promise<{ markdown: string; provider: string; model: string }> {
  if (aboutWordCount(p.about) < MIN_ABOUT_WORDS) {
    throw new SummaryUnavailableError(
      `The About has ${aboutWordCount(p.about)} words. Write at least ${MIN_ABOUT_WORDS} words about what was taught (topics, formulas, examples, exam points) so the summary can be made from it.`,
      "INSUFFICIENT"
    );
  }
  if (!summaryAiConfigured()) {
    throw new SummaryUnavailableError("No AI provider is configured on the server (Gemini keys missing). The About is saved; the summary can be generated once AI is set up.", "AI_NOT_CONFIGURED");
  }

  return runSummaryPrompt(buildSummaryPrompt(p), p.language);
}

/**
 * Generates a summary from the lecture itself (transcript + board from the
 * AI pass), the About as a hint. Same checks and errors as from the About.
 */
export async function generateVideoSummary(p: {
  source: string;
  about: string | null;
  title: string;
  subject: string;
  chapter: string;
  language: string;
}): Promise<{ markdown: string; provider: string; model: string }> {
  if (p.source.trim().length < 200) {
    throw new SummaryUnavailableError("The lecture transcript is too short to summarise. Check that the video has the teacher's voice.", "INSUFFICIENT");
  }
  if (!summaryAiConfigured()) {
    throw new SummaryUnavailableError("No AI provider is configured on the server (Gemini keys missing).", "AI_NOT_CONFIGURED");
  }
  return runSummaryPrompt(buildVideoSummaryPrompt(p), p.language);
}

async function runSummaryPrompt(prompt: string, language: string): Promise<{ markdown: string; provider: string; model: string }> {
  let usedModel = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SummaryUnavailableError("The AI took too long. Try again in a minute.", "TIMEOUT")), TIMEOUT_MS);
  });
  let raw: string;
  try {
    raw = await Promise.race([
      executeGeminiWithFailover(async (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, ...lightThinking(modelName, "low") },
        });
        const res = await model.generateContent(prompt);
        usedModel = modelName;
        return res.response.text();
      }),
      timeout,
    ]);
  } catch (err) {
    if (err instanceof SummaryUnavailableError) throw err;
    throw new SummaryUnavailableError("The AI service could not make the summary right now. The About is saved — try again shortly.", "AI_FAILED");
  } finally {
    if (timer) clearTimeout(timer);
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseAiJson(String(raw).replace(/```json|```/gi, "").trim());
  } catch {
    throw new SummaryUnavailableError("The AI answer could not be read. Try generating again.", "INVALID");
  }
  const parsed = parseSummaryResponse(parsedJson);
  if (!parsed.ok) throw new SummaryUnavailableError(parsed.error, parsed.insufficient ? "INSUFFICIENT" : "INVALID");
  return { markdown: summaryToMarkdown(parsed.sections, language), provider: "gemini", model: usedModel || "gemini" };
}

/**
 * Translates a summary to Hindi or English, NCERT style. Two tries: the
 * translation must keep every heading, point and formula of the original.
 */
export async function translateLectureSummary(p: { markdown: string; to: "hi" | "en"; subject: string }): Promise<{ markdown: string; provider: string; model: string }> {
  if (!summaryAiConfigured()) throw new SummaryUnavailableError("No AI provider is configured on the server (Gemini keys missing).", "AI_NOT_CONFIGURED");
  const prompt = buildSummaryTranslationPrompt(p);
  for (let attempt = 0; attempt < 2; attempt++) {
    let usedModel = "";
    let raw: string;
    try {
      raw = await executeGeminiWithFailover(async (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json", temperature: 0.1, ...lightThinking(modelName, "low") },
        });
        const res = await model.generateContent(prompt);
        usedModel = modelName;
        return res.response.text();
      });
    } catch {
      throw new SummaryUnavailableError("The AI service could not translate the summary right now. Try again shortly.", "AI_FAILED");
    }
    let parsed: unknown;
    try {
      parsed = (parseAiJson(String(raw).replace(/```json|```/gi, "").trim()) as { markdown?: unknown })?.markdown;
    } catch {
      continue;
    }
    const ok = checkSummaryTranslation(p.markdown, parsed);
    if (ok) return { markdown: ok, provider: "gemini", model: usedModel || "gemini" };
  }
  throw new SummaryUnavailableError("The translation did not keep all headings, points and formulas. Try again.", "INVALID");
}
