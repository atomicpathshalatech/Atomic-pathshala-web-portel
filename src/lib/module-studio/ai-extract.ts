import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ModuleElementInput } from "@/lib/validation/module";
import { MODULE_ELEMENT_TYPES } from "@/lib/validation/module";
import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { GEMINI_TEXT_MODELS, classifyGeminiFailure, usableModels } from "@/lib/ai/gemini-models";

const TEXT_ELEMENT_TYPES = MODULE_ELEMENT_TYPES;

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
 * Structures one page's raw extracted text into typed content blocks via Gemini with Key Rotation.
 */
export async function structurePageText(pageText: string): Promise<ExtractionResult> {
  return geminiKeyManager.executeWithRotation(async (genAI: GoogleGenerativeAI, meta) => {
    let lastError: string | null = null;
    const models = usableModels(GEMINI_TEXT_MODELS);
    for (let i = 0; i < models.length; i++) {
      const modelName = models[i]!;
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: { maxOutputTokens: 16384, temperature: 0.1, responseMimeType: "application/json" },
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
      } catch (err: any) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        const msg = (err?.message || String(err)).toLowerCase();
        // A blocked key or a rate limit: let the key manager try the next key.
        if (classifyGeminiFailure(err, meta.key, modelName) === "next-key") throw err;
        if (msg.includes("429") || msg.includes("quota")) {
          throw err;
        }
      }
    }

    return { elements: [], usedFallback: true, error: lastError };
  });
}
