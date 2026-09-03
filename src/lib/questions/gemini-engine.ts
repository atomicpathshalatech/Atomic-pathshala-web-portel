import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ExtractedQuestionData {
  statementEn: string;
  statementHi: string;
  optionsEn: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  optionsHi: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  correctAnswer: string[];
  solutionEn: string;
  solutionHi: string;
  hasFigure: boolean;
  figureCaption?: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Mathematics" | "Science";
  chapter: string;
  topic: string;
  subTopic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
  type: "SINGLE_CORRECT" | "MULTI_CORRECT" | "INTEGER" | "ASSERTION_REASON" | "MATCH_THE_COLUMN";
  category: string;
  pyqSource?: string;
  tags: string[];
  isBilingual: boolean;
  aiTranslatedHi?: boolean;
  aiTranslatedEn?: boolean;
  confidence: number;
}

// Model fallback list
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"] as const;
const KEY_COOLDOWN_MS = 60_000;
const keyCooldowns = new Map<string, number>();

/**
 * Parses and returns all configured Gemini API keys
 */
export function getGeminiApiKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS?.trim();
  const single = process.env.GEMINI_API_KEY?.trim();

  const keys: string[] = [];
  if (multi) {
    keys.push(...multi.split(",").map((k) => k.trim()).filter(Boolean));
  }
  if (single && !keys.includes(single)) {
    keys.push(single);
  }

  return keys.filter((k) => !k.includes("your_gemini_api_key") && k.length > 10);
}

/**
 * Executes a Gemini request with automatic multi-key failover and exponential retry
 */
export async function executeGeminiWithFailover<T>(
  task: (client: GoogleGenerativeAI, modelName: string) => Promise<T>
): Promise<T> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured in environment (GEMINI_API_KEYS / GEMINI_API_KEY).");
  }

  const now = Date.now();
  // Filter out keys that are currently cooling down, unless all are cooling down
  let availableKeys = keys.filter((k) => (keyCooldowns.get(k) || 0) < now);
  if (availableKeys.length === 0) {
    availableKeys = keys; // reset if all cooling down
  }

  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    for (const key of availableKeys) {
      try {
        const client = new GoogleGenerativeAI(key);
        return await task(client, modelName);
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isRateLimit = msg.includes("429") || msg.includes("quota") || msg.includes("ResourceExhausted");

        if (isRateLimit) {
          keyCooldowns.set(key, Date.now() + KEY_COOLDOWN_MS);
        }

        console.warn(`[Gemini Engine] Attempt failed with model ${modelName} on key ${key.slice(0, 6)}...: ${msg}`);
      }
    }
  }

  throw new Error(`Gemini AI service unavailable: ${lastError?.message || "All keys and fallback models failed"}`);
}

/**
 * Multimodal OCR: Extracts full structured bilingual question, options, math/LaTeX, and solution from image
 */
export async function extractBilingualQuestionFromImage({
  imageBase64,
  mimeType = "image/png",
  solutionImageBase64,
  solutionMimeType = "image/png",
}: {
  imageBase64: string;
  mimeType?: string;
  solutionImageBase64?: string;
  solutionMimeType?: string;
}): Promise<ExtractedQuestionData> {
  // Clean base64 header if present
  const cleanQuestionBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const systemPrompt = `You are the Master Question Extraction & Ingestion Engine for NEET, JEE Main, JEE Advanced and NCERT Board exams (Atomic Pathshala).

YOUR TASK:
Carefully analyze the provided examination question image and extract all text, mathematical formulas, chemical reactions, diagrams, and options with 100% precision.

EXTRACTION INSTRUCTIONS:
1. BILINGUAL RECOGNITION:
   - If the image contains both English and Hindi versions, extract English statement and options into statementEn/optionsEn, and Hindi statement and options into statementHi/optionsHi.
   - If the image is ONLY English, extract into statementEn/optionsEn and leave statementHi/optionsHi empty (or perform NCERT aligned translation into Hindi).
   - If the image is ONLY Hindi, extract into statementHi/optionsHi and leave statementEn/optionsEn empty (or perform translation into English).

2. MATHEMATICAL & SCIENTIFIC PRECISION:
   - Use standard LaTeX notation for equations: $...$ for inline math, $$...$$ for block formulas.
   - For chemical reactions, write formulas like $\\text{CaCO}_3 \\rightarrow \\text{CaO} + \\text{CO}_2$ or $\\text{H}_2\\text{SO}_4$.
   - Preserve units (e.g. $\\text{m/s}^2$, $\\text{J}\\cdot\\text{mol}^{-1}$, $\\mu\\text{F}$, $\\Omega$).
   - Never skip superscripts, subscripts, fractions, integrals, matrices, or radicals.

3. OPTIONS & ANSWER:
   - Extract options A, B, C, D cleanly into their respective fields.
   - If the correct option is marked (e.g. circled, ticked, or highlighted in the image or answer key), specify it in "correctAnswer" (e.g. ["A"]). If not clearly visible, deduce the correct answer.

4. DIAGRAM / FIGURE DETECTION:
   - If the question relies on a geometric diagram, electric circuit, graph, molecular structure, or organ diagram shown in the image, set "hasFigure": true and provide a descriptive "figureCaption".

5. CURRICULUM CLASSIFICATION:
   - Automatically identify Subject: "Physics" | "Chemistry" | "Biology" | "Mathematics" | "Science"
   - Identify Chapter name (e.g. "Electrostatics", "Chemical Kinetics", "Thermodynamics", "Cell: The Unit of Life", "Definite Integrals")
   - Identify Topic and Difficulty ("EASY", "MEDIUM", "HARD", "VERY_HARD")
   - Identify Question Type ("SINGLE_CORRECT", "MULTI_CORRECT", "INTEGER", "ASSERTION_REASON", "MATCH_THE_COLUMN")

6. SOLUTION & EXPLANATION:
   - If a solution is visible in the image (or in the attached solution image), extract it thoroughly with step-by-step reasoning into solutionEn and solutionHi.
   - If no solution is visible, construct an accurate NCERT standard step-by-step solution.

RETURN JSON SCHEMA:
{
  "statementEn": "English question statement with LaTeX math",
  "statementHi": "Hindi question statement with Devanagari text and LaTeX math",
  "optionsEn": {
    "A": "Option A in English",
    "B": "Option B in English",
    "C": "Option C in English",
    "D": "Option D in English"
  },
  "optionsHi": {
    "A": "Option A in Hindi",
    "B": "Option B in Hindi",
    "C": "Option C in Hindi",
    "D": "Option D in Hindi"
  },
  "correctAnswer": ["A"],
  "solutionEn": "Step-by-step solution in English with formulas and final answer",
  "solutionHi": "Step-by-step solution in Hindi with formulas and final answer",
  "hasFigure": true/false,
  "figureCaption": "Caption or null",
  "subject": "Physics",
  "chapter": "Current Electricity",
  "topic": "Kirchhoff's Laws",
  "subTopic": "Loop Rule",
  "difficulty": "MEDIUM",
  "type": "SINGLE_CORRECT",
  "category": "NCERT Canonical",
  "pyqSource": "NEET 2022",
  "tags": ["NEET", "NCERT", "Current Electricity"],
  "isBilingual": true,
  "confidence": 95
}`;

    const parts: any[] = [
      { text: systemPrompt },
      {
        inlineData: {
          data: cleanQuestionBase64,
          mimeType: mimeType || "image/png",
        },
      },
    ];

    if (solutionImageBase64) {
      const cleanSolutionBase64 = solutionImageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      parts.push({
        text: "Below is the attached SOLUTION REFERENCE image for this question:",
      });
      parts.push({
        inlineData: {
          data: cleanSolutionBase64,
          mimeType: solutionMimeType || "image/png",
        },
      });
    }

    const response = await model.generateContent(parts);
    const text = response.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      statementEn: parsed.statementEn || "",
      statementHi: parsed.statementHi || "",
      optionsEn: {
        A: parsed.optionsEn?.A || "",
        B: parsed.optionsEn?.B || "",
        C: parsed.optionsEn?.C || "",
        D: parsed.optionsEn?.D || "",
      },
      optionsHi: {
        A: parsed.optionsHi?.A || "",
        B: parsed.optionsHi?.B || "",
        C: parsed.optionsHi?.C || "",
        D: parsed.optionsHi?.D || "",
      },
      correctAnswer: Array.isArray(parsed.correctAnswer) ? parsed.correctAnswer : [parsed.correctAnswer || "A"],
      solutionEn: parsed.solutionEn || "",
      solutionHi: parsed.solutionHi || "",
      hasFigure: Boolean(parsed.hasFigure),
      figureCaption: parsed.figureCaption || undefined,
      subject: parsed.subject || "Physics",
      chapter: parsed.chapter || "General",
      topic: parsed.topic || "Core Concept",
      subTopic: parsed.subTopic || undefined,
      difficulty: parsed.difficulty || "MEDIUM",
      type: parsed.type || "SINGLE_CORRECT",
      category: parsed.category || "NCERT Canonical",
      pyqSource: parsed.pyqSource || undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["NEET", "NCERT"],
      isBilingual: Boolean(parsed.isBilingual || (parsed.statementEn && parsed.statementHi)),
      aiTranslatedHi: Boolean(parsed.aiTranslatedHi),
      aiTranslatedEn: Boolean(parsed.aiTranslatedEn),
      confidence: Number(parsed.confidence) || 90,
    };
  });
}

/**
 * NCERT Educational Translation for Scientific / Examination content
 */
export async function translateQuestionContent({
  text,
  targetLang,
  subject,
}: {
  text: string;
  targetLang: "ENGLISH" | "HINDI";
  subject?: string;
}): Promise<string> {
  if (!text?.trim()) return "";

  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({ model: modelName });
    const targetDesc = targetLang === "HINDI" ? "Hindi (Devanagari script with NCERT terminology)" : "English (NCERT / CBSE standard)";

    const prompt = `You are a Senior Academic Subject Expert in ${subject || "Science/Mathematics"}.
Translate the following examination question content to ${targetDesc}.

CRITICAL RULES:
1. Preserve all mathematical equations and LaTeX symbols ($...$, $$...$$, \\frac, \\sqrt, \\vec, etc.) EXACTLY as they are.
2. Use authentic NCERT standard terminology for Hindi (e.g., 'अभिक्रिया की दर' for rate of reaction, 'विभवांतर' for potential difference, 'कोशिका विभाजन' for cell division).
3. Do NOT invent new facts or alter any numbers, coefficients, or physical constants.
4. Output ONLY the translated text without introductory remarks or markdown quotes.

Content to translate:
${text}`;

    const response = await model.generateContent(prompt);
    return response.response.text().trim();
  });
}

/**
 * Generates an expanded step-by-step solution preserving original answer & facts
 */
export async function generateExpandedSolution({
  statement,
  options,
  correctAnswer,
  subject,
}: {
  statement: string;
  options?: Record<string, string>;
  correctAnswer: string[];
  subject?: string;
}): Promise<{ solutionEn: string; solutionHi: string; stepByStep: string[] }> {
  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `You are a Senior Faculty at Atomic Pathshala for ${subject || "NEET & JEE"}.
Provide a crystal-clear, step-by-step examination solution for the following question.

Question: "${statement}"
Options: ${JSON.stringify(options || {})}
Correct Answer: Option (${correctAnswer.join(", ")})

RULES:
1. Explain the fundamental concept / formula first.
2. Give step-by-step calculation / derivation.
3. State why the correct option is right.
4. Provide the solution in BOTH English and Hindi (Devanagari).

Return JSON schema:
{
  "solutionEn": "Comprehensive English solution with formulas and steps",
  "solutionHi": "Comprehensive Hindi solution with formulas and steps",
  "stepByStep": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
}`;

    const response = await model.generateContent(prompt);
    const jsonStr = response.response.text().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      solutionEn: parsed.solutionEn || "",
      solutionHi: parsed.solutionHi || "",
      stepByStep: Array.isArray(parsed.stepByStep) ? parsed.stepByStep : [],
    };
  });
}
