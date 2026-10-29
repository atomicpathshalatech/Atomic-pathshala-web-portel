import "server-only";
import OpenAI from "openai";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { buildNotesPrompt, parseNotesResponse } from "./ai/format";
import { SummaryUnavailableError, summaryAiConfigured } from "./summary";

const TIMEOUT_MS = 110_000;

function openAiKey(): string | null {
  let k = (process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || "").trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1).trim();
  return k || null;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SummaryUnavailableError("The AI took too long. Try again in a minute.", "TIMEOUT")), TIMEOUT_MS);
    }),
  ]).finally(() => timer && clearTimeout(timer));
}

/**
 * Class notes from what the teacher wrote on the board and dictated.
 * Written by OpenAI (OPENAI_MODEL, default gpt-4o) — the strongest at
 * clean, faithful structuring of this text — with Gemini as the fallback
 * when OpenAI is not configured or fails. Never returns made-up notes.
 */
export async function generateLectureNotes(p: {
  source: string;
  title: string;
  subject: string;
  chapter: string;
  language: string;
}): Promise<{ markdown: string; provider: string; model: string }> {
  if (p.source.trim().length < 40) {
    throw new SummaryUnavailableError("The AI found almost nothing written on the board or dictated in this lecture, so there are no notes to make.", "INSUFFICIENT");
  }
  const prompt = buildNotesPrompt(p);
  const system = "You write faithful NEET/JEE class notes from a teacher's board writing and dictation. Return strictly JSON.";
  const errors: string[] = [];

  const key = openAiKey();
  if (key) {
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    try {
      const res = await withTimeout(
        new OpenAI({ apiKey: key }).chat.completions.create({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        })
      );
      const parsed = parseNotesResponse(parseAiJson(res.choices[0]?.message?.content || "{}"));
      if (parsed.ok) return { markdown: parsed.markdown, provider: "openai", model };
      if (parsed.empty) throw new SummaryUnavailableError(parsed.error, "INSUFFICIENT");
      errors.push(parsed.error);
    } catch (err) {
      if (err instanceof SummaryUnavailableError && err.code === "INSUFFICIENT") throw err;
      errors.push(`OpenAI: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
    }
  }

  if (summaryAiConfigured()) {
    let usedModel = "";
    try {
      const raw = await withTimeout(
        executeGeminiWithFailover(async (client, modelName) => {
          const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction: system,
            generationConfig: { responseMimeType: "application/json", temperature: 0.1, ...lightThinking(modelName, "low") },
          });
          const res = await model.generateContent(prompt);
          usedModel = modelName;
          return res.response.text();
        })
      );
      const parsed = parseNotesResponse(parseAiJson(String(raw).replace(/```json|```/gi, "").trim()));
      if (parsed.ok) return { markdown: parsed.markdown, provider: "gemini", model: usedModel || "gemini" };
      if (parsed.empty) throw new SummaryUnavailableError(parsed.error, "INSUFFICIENT");
      errors.push(parsed.error);
    } catch (err) {
      if (err instanceof SummaryUnavailableError && (err.code === "INSUFFICIENT" || err.code === "TIMEOUT")) throw err;
      errors.push(`Gemini: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
    }
  }

  if (!key && !summaryAiConfigured()) throw new SummaryUnavailableError("No AI provider is configured on the server (OpenAI / Gemini keys missing).", "AI_NOT_CONFIGURED");
  console.error("[lecture-notes] generation failed:", errors.join(" | "));
  throw new SummaryUnavailableError("The AI could not make the notes right now. Try again shortly.", "AI_FAILED");
}
