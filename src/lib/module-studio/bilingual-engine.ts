import "server-only";
import type { ModuleElementInput } from "@/lib/validation/module";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";

export interface TranslateAstOptions {
  targetLanguage: "HINDI" | "ENGLISH";
  subject?: string;
  onProgress?: (processed: number, total: number) => void;
}

const TRANSLATION_PROMPT = `You are a Senior Academic Translator specializing in NEET and JEE preparation materials (Physics, Chemistry, Biology).
Your task is to translate an array of academic text items into the target language.

STRICT RULES:
1. PRESERVE all LaTeX formulas intact (e.g. $F = ma$, $\\Delta H$, $\\int x dx$, etc.). DO NOT translate or alter formulas.
2. PRESERVE chemical equations and formulas intact (e.g. $H_2SO_4$, $CH_3COOH$).
3. PRESERVE question identifiers and option indicators (e.g., Q.1, Q.2, (A), (B), (C), (D), (1), (2), (3), (4)).
4. Use standard NCERT academic terminology (e.g. for Hindi: वेग (velocity), त्वरण (acceleration), संकरण (hybridization), समस्थानिक (isotopes), कोशिका (cell), आनुवंशिकी (genetics)).
5. Return a JSON object with a "translations" array containing the exact same number of items with identical indices:
{
  "translations": [
    { "index": 0, "translatedText": "..." },
    { "index": 1, "translatedText": "..." }
  ]
}
`;

/**
 * Translates an entire structured AST from English to Hindi or Hindi to English in cost-efficient batches.
 */
export async function translateStructuredAST(
  elements: ModuleElementInput[],
  options: TranslateAstOptions
): Promise<ModuleElementInput[]> {
  const targetLangStr = options.targetLanguage === "HINDI" ? "Hindi (Devanagari script)" : "English";
  const BATCH_SIZE = 15;

  // Clone elements array
  const translatedElements: ModuleElementInput[] = JSON.parse(JSON.stringify(elements));

  // Identify translatable elements (ignore purely visual/empty elements)
  const translatableIndices: number[] = [];
  for (let i = 0; i < translatedElements.length; i++) {
    const el = translatedElements[i]!;
    if (el.content && typeof el.content === "string" && el.content.trim().length > 0) {
      translatableIndices.push(i);
    }
  }

  // Process in batches
  for (let b = 0; b < translatableIndices.length; b += BATCH_SIZE) {
    const batchIndices = translatableIndices.slice(b, b + BATCH_SIZE);
    const batchPayload = batchIndices.map((origIdx, localIdx) => ({
      index: localIdx,
      type: translatedElements[origIdx]!.type,
      text: translatedElements[origIdx]!.content,
    }));

    try {
      const rawAiResponse = await executeGeminiWithFailover(async (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 8192,
            ...lightThinking(modelName, "low"),
          } as Record<string, unknown>,
        });

        const prompt = `${TRANSLATION_PROMPT}\nTarget Language: ${targetLangStr}\nSubject: ${options.subject || "General Science"}\n\nINPUT ITEMS TO TRANSLATE:\n${JSON.stringify(batchPayload, null, 2)}`;
        const res = await model.generateContent([prompt]);
        return res.response?.text() || "";
      });

      const parsed = parseAiJson<{ translations?: { index: number; translatedText: string }[] }>(
        rawAiResponse.replace(/```json|```/gi, "").trim()
      );

      const translationsList = parsed?.translations || (Array.isArray(parsed) ? parsed : []);

      for (const item of translationsList) {
        if (typeof item.index === "number" && item.index >= 0 && item.index < batchIndices.length) {
          const originalIdx = batchIndices[item.index]!;
          if (translatedElements[originalIdx] && item.translatedText) {
            translatedElements[originalIdx]!.content = item.translatedText;
          }
        }
      }
    } catch (err) {
      console.warn(`[bilingual_translation_batch_error] Batch ${b} fallback to original:`, err);
    }

    if (options.onProgress) {
      options.onProgress(Math.min(b + BATCH_SIZE, translatableIndices.length), translatableIndices.length);
    }
  }

  return translatedElements;
}
