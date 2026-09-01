import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ModuleElementInput } from "@/lib/validation/module";
import { MODULE_ELEMENT_TYPES } from "@/lib/validation/module";

// Same fallback model chain as the AI-chat feature (src/lib/ai-chat/gemini.ts)
// but deliberately NOT importing from there — that module's retry/cooldown
// machinery and types are built around the chat request/response shape.
// This is a much lower-volume, one-shot structured-extraction call, so a
// simpler single-pass-with-one-fallback is enough rather than reusing that
// heavier apparatus.
const MODEL_FALLBACKS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"] as const;

// Text-extractable element types only — IMAGE/DIAGRAM/CHEMICAL_STRUCTURE and
// pure layout shapes (SHAPE/LINE/RECTANGLE/CIRCLE/ARROW/TEXT_BOX/
// PAGE_BACKGROUND) need real image/layout analysis this pipeline doesn't do
// (see pdf-text.ts) — asking the model to pick from those anyway would just
// invite it to guess.
const TEXT_ELEMENT_TYPES = MODULE_ELEMENT_TYPES;

function getApiKey(): string {
  const multi = process.env.GEMINI_API_KEYS?.trim();
  const single = process.env.GEMINI_API_KEY?.trim();
  const first = (multi ? multi.split(",")[0] : single)?.trim();
  if (!first) {
    throw new Error("GEMINI_API_KEY is not configured — add GEMINI_API_KEYS or GEMINI_API_KEY to .env.local.");
  }
  return first;
}

const SYSTEM_PROMPT = `You structure raw text extracted from one page of an educational study-module PDF (NEET/JEE coaching material) into a flat, ordered list of content blocks.

Allowed block types: ${TEXT_ELEMENT_TYPES.join(", ")}.

Rules:
- Preserve the original text content verbatim inside each block — do not summarize, translate, or rewrite it.
- Split into blocks at natural boundaries: a HEADING/SUBHEADING starts a new section, each QUESTION is its own block, each answer OPTION (A/B/C/D) is its own block, a SOLUTION explanation is its own block, PARAGRAPH for regular prose, EQUATION/CHEMICAL_EQUATION for standalone formulas, TABLE for tabular data kept as plain text, TEXT as the fallback for anything else.
- Keep the original order (top of page to bottom).
- If the page text is garbled or clearly not real content (e.g. OCR noise), return an empty array rather than inventing content.

Return ONLY a JSON array of {"type": "<one of the allowed types>", "content": "<verbatim text>"} objects. No prose, no markdown fences.`;

export type ExtractionResult = { elements: ModuleElementInput[]; usedFallback: boolean; error: string | null };

/**
 * Structures one page's raw extracted text into typed content blocks via
 * Gemini. Real model call, not a stub — but a genuinely best-effort first
 * pass: every page this touches is stored with needsReview: true so a human
 * always checks it before the module is marked READY, same as this app's
 * existing AI-assisted flows (e.g. Question Bank verification) never
 * auto-trust a model's first output.
 */
export async function structurePageText(pageText: string): Promise<ExtractionResult> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: string | null = null;
  for (let i = 0; i < MODEL_FALLBACKS.length; i++) {
    const modelName = MODEL_FALLBACKS[i]!;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1, responseMimeType: "application/json" },
      });
      const result = await model.generateContent(pageText);
      const raw = result.response.text();
      const parsed = JSON.parse(raw) as { type: string; content: string }[];

      const elements: ModuleElementInput[] = parsed
        .filter((el) => (TEXT_ELEMENT_TYPES as readonly string[]).includes(el.type) && typeof el.content === "string" && el.content.trim().length > 0)
        .map((el, idx) => ({
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
          type: el.type as ModuleElementInput["type"],
          order: idx,
          content: el.content,
        }));

      return { elements, usedFallback: i > 0, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
    }
  }

  return { elements: [], usedFallback: true, error: lastError };
}
