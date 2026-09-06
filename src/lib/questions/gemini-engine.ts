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
  let availableKeys = keys.filter((k) => (keyCooldowns.get(k) || 0) < now);
  if (availableKeys.length === 0) {
    availableKeys = keys;
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
 * Multimodal OCR: Extracts full structured bilingual question, options, math/LaTeX, and diagrams from image
 */
export async function extractBilingualQuestionFromImage({
  imageBase64,
  mimeType = "image/png",
  solutionImageBase64,
  solutionMimeType = "image/png",
  subjectContext,
  chapterContext,
}: {
  imageBase64: string;
  mimeType?: string;
  solutionImageBase64?: string;
  solutionMimeType?: string;
  subjectContext?: string;
  chapterContext?: string;
}): Promise<ExtractedQuestionData> {
  const cleanQuestionBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const contextInstruction = subjectContext
      ? `Teacher has confirmed Subject: "${subjectContext}" and Chapter: "${chapterContext || ""}". Use this context.`
      : "";

    const systemPrompt = `You are the Master Question Extraction & Ingestion Engine for NEET, JEE Main, and NCERT Board exams (Atomic Pathshala).
${contextInstruction}

YOUR TASK:
Analyze the provided examination question image and extract text, mathematical formulas, chemical reactions, diagrams, and options with 100% precision into structured fields.

CRITICAL EXTRACTION RULES:
1. BILINGUAL RECOGNITION:
   - If the image contains BOTH English and Hindi versions:
     * Extract English statement into statementEn, and Hindi statement into statementHi.
     * Extract English options into optionsEn.A, B, C, D.
     * Extract Hindi options into optionsHi.A, B, C, D.
     * Ensure Hindi Option 1 maps to optionsHi.A, English Option 1 maps to optionsEn.A. Do NOT mix languages between fields.
   - If the image is ONLY English:
     * Extract English statement and options into statementEn and optionsEn.
     * Leave statementHi as "" and optionsHi.A/B/C/D as "". Do NOT invent or auto-translate during extraction.
   - If the image is ONLY Hindi:
     * Extract Hindi statement and options into statementHi and optionsHi.
     * Leave statementEn as "" and optionsEn.A/B/C/D as "". Do NOT invent or auto-translate during extraction.

2. MATHEMATICAL & SCIENTIFIC PRECISION:
   - Use standard LaTeX notation for equations: $...$ for inline math, $$...$$ for block formulas.
   - For chemical formulas, write formulas like $\\text{CaCO}_3$ or $\\text{H}_2\\text{SO}_4$.
   - Preserve units, powers, fractions, vectors, superscripts and subscripts.

3. OPTIONS SEPARATION:
   - Always separate question statement from options A, B, C, D. Never dump options into the statement field.
   - Detect option formats: (A)/(B)/(C)/(D), (1)/(2)/(3)/(4), 1./2./3./4. Map 1->A, 2->B, 3->C, 4->D.

4. DIAGRAM / FIGURE DETECTION:
   - If the question relies on a geometric diagram, electric circuit, graph, molecular structure, or organ diagram shown in the image, set "hasFigure": true and provide a descriptive "figureCaption".

5. CORRECT ANSWER:
   - If marked in the image (ticked, circled, or key visible), set "correctAnswer": ["A"|"B"|"C"|"D"].
   - If not visibly marked, solve the question and provide the scientifically verified correct answer.

RETURN STRICT JSON SCHEMA:
{
  "statementEn": "English question statement with LaTeX math (or empty string if Hindi only)",
  "statementHi": "Hindi question statement with Devanagari and LaTeX math (or empty string if English only)",
  "optionsEn": {
    "A": "Option A in English or empty",
    "B": "Option B in English or empty",
    "C": "Option C in English or empty",
    "D": "Option D in English or empty"
  },
  "optionsHi": {
    "A": "Option A in Hindi or empty",
    "B": "Option B in Hindi or empty",
    "C": "Option C in Hindi or empty",
    "D": "Option D in Hindi or empty"
  },
  "correctAnswer": ["A"],
  "solutionEn": "Step-by-step solution in English",
  "solutionHi": "Step-by-step solution in Hindi",
  "hasFigure": true,
  "figureCaption": "Description of the diagram",
  "subject": "Physics",
  "chapter": "Current Electricity",
  "topic": "Kirchhoff's Laws",
  "subTopic": "Loop Rule",
  "difficulty": "MEDIUM",
  "type": "SINGLE_CORRECT",
  "category": "NCERT Canonical",
  "pyqSource": "NEET 2023",
  "tags": ["NEET", "NCERT"],
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
      subject: parsed.subject || (subjectContext as any) || "Physics",
      chapter: parsed.chapter || chapterContext || "General",
      topic: parsed.topic || "Core Concept",
      subTopic: parsed.subTopic || undefined,
      difficulty: parsed.difficulty || "MEDIUM",
      type: parsed.type || "SINGLE_CORRECT",
      category: parsed.category || "NCERT Canonical",
      pyqSource: parsed.pyqSource || undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["NEET", "NCERT"],
      isBilingual: Boolean(parsed.statementEn && parsed.statementHi),
      aiTranslatedHi: false,
      aiTranslatedEn: false,
      confidence: Number(parsed.confidence) || 92,
    };
  });
}

/**
 * Text OCR/Parser: Extracts structured question when pasted as raw text
 */
export async function extractBilingualQuestionFromText({
  rawText,
  subjectContext,
  chapterContext,
}: {
  rawText: string;
  subjectContext?: string;
  chapterContext?: string;
}): Promise<ExtractedQuestionData> {
  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const contextInstruction = subjectContext
      ? `Teacher has confirmed Subject: "${subjectContext}" and Chapter: "${chapterContext || ""}". Use this context.`
      : "";

    const prompt = `You are the Master Question Extraction & Ingestion Engine for NEET, JEE Main, and NCERT Board exams (Atomic Pathshala).
${contextInstruction}

Analyze the following pasted examination question text and parse it into structured bilingual format.

RULES:
1. If text contains both Hindi and English, separate them into statementEn/optionsEn and statementHi/optionsHi.
2. If text is English only, populate English fields and leave Hindi fields as "".
3. If text is Hindi only, populate Hindi fields and leave English fields as "".
4. Separate question statement from Options A, B, C, D. Map (1)/(2)/(3)/(4) or (A)/(B)/(C)/(D) to keys A, B, C, D.
5. Deduce the correct answer option ("A"|"B"|"C"|"D").
6. Convert mathematical and chemical formulas into LaTeX $...$.

Raw text:
"""
${rawText}
"""

RETURN STRICT JSON SCHEMA:
{
  "statementEn": "English question statement or empty string",
  "statementHi": "Hindi question statement or empty string",
  "optionsEn": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "optionsHi": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": ["A"],
  "subject": "${subjectContext || "Biology"}",
  "chapter": "${chapterContext || ""}",
  "topic": "Topic name",
  "difficulty": "MEDIUM",
  "type": "SINGLE_CORRECT"
}`;

    const response = await model.generateContent(prompt);
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
      solutionEn: "",
      solutionHi: "",
      hasFigure: false,
      subject: parsed.subject || (subjectContext as any) || "Biology",
      chapter: parsed.chapter || chapterContext || "General",
      topic: parsed.topic || "Core Concept",
      difficulty: parsed.difficulty || "MEDIUM",
      type: parsed.type || "SINGLE_CORRECT",
      category: "NCERT Canonical",
      tags: ["NEET", "NCERT"],
      isBilingual: Boolean(parsed.statementEn && parsed.statementHi),
      confidence: 90,
    };
  });
}

/**
 * Subject-Aware Solution Generator conforming strictly to Physics, Chemistry, and Biology formats
 */
export async function generateSubjectAwareSolution({
  subject,
  statementEn,
  statementHi,
  optionsEn,
  optionsHi,
  correctAnswer,
  userSelectedAnswer,
  userProvidedSolution,
}: {
  subject: string;
  statementEn: string;
  statementHi?: string;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  correctAnswer?: string;
  userSelectedAnswer?: string;
  userProvidedSolution?: string;
}): Promise<{
  solutionEn: string;
  solutionHi: string;
  recommendedAnswer: string;
  answerMismatch: boolean;
  mismatchWarning?: string;
}> {
  const normSubject = (subject || "").toLowerCase();

  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    let formatInstructions = "";

    if (normSubject.includes("phys")) {
      formatInstructions = `
PHYSICS SOLUTION FORMAT REQUIREMENT:
Structure solutionEn exactly as:
EXPLAINING:
[Short explanation of what the question is asking and the underlying physical reasoning.]

CONCEPT:
[Relevant Physics concept/principle/law.]

Solution:
[Step-by-step derivation]
[Equations with LaTeX $...$]
[Substitution of numerical values]
[Calculation]

Final Answer: Option [X]

Do NOT turn numerical physics solution into paragraph-only text. Use equations and units.
Provide matching Hindi Devanagari version for solutionHi.`;
    } else if (normSubject.includes("chem")) {
      formatInstructions = `
CHEMISTRY SOLUTION FORMAT REQUIREMENT:
Structure solutionEn exactly as:
Explaining:
[What the question is asking.]

Concept:
[Relevant Chemistry concept/rule/periodic trend/reaction.]

Solution:
[Analyze the options/question]
[Relevant chemical rule/order/reaction equation/calculation]
[Correct reasoning for why correct option is right and others wrong]

Final Answer: Option [X]

Preserve chemical formulas (e.g. $\\text{H}_2\\text{SO}_4$, oxidation states, charges).
Provide matching Hindi Devanagari version for solutionHi.`;
    } else if (normSubject.includes("bio")) {
      formatInstructions = `
BIOLOGY SOLUTION FORMAT REQUIREMENT:
Structure solutionEn exactly as:
Explain Question:
[What the question is asking.]

Concept:
[Relevant NCERT Biology concept.]

Solution:
[Evaluate the statements/options.]
1. [Statement A] -> True/False + reason
2. [Statement B] -> True/False + reason
3. [Statement C] -> True/False + reason
4. [Statement D] -> True/False + reason

Final Answer: Option [X]

Use NCERT-aligned terminology.
Provide matching Hindi Devanagari version for solutionHi.`;
    } else {
      formatInstructions = `
MATHEMATICS / GENERAL SOLUTION FORMAT REQUIREMENT:
Structure solutionEn exactly as:
Explaining:
[Understanding what is required.]

Concept:
[Formula or theorem.]

Solution:
[Step-by-step mathematical derivation and calculations with LaTeX]

Final Answer: Option [X]

Provide matching Hindi Devanagari version for solutionHi.`;
    }

    const userReferencePrompt = userProvidedSolution?.trim()
      ? `Teacher has provided an initial solution: "${userProvidedSolution}". Respect teacher's intent, preserve key steps, and refine it into the required format.`
      : "";

    const userSelectedPrompt = userSelectedAnswer
      ? `Teacher has selected Option (${userSelectedAnswer}) as the intended answer.`
      : "";

    const prompt = `You are a Senior Academic Subject Expert for ${subject} at Atomic Pathshala.
Generate a comprehensive, subject-aware bilingual solution for the following question.

Question (English): "${statementEn}"
${statementHi ? `Question (Hindi): "${statementHi}"` : ""}
Options (English): ${JSON.stringify(optionsEn)}
${optionsHi ? `Options (Hindi): ${JSON.stringify(optionsHi)}` : ""}
${correctAnswer ? `Target Correct Option: Option (${correctAnswer})` : ""}
${userSelectedPrompt}
${userReferencePrompt}

${formatInstructions}

Deduce the scientifically verified correct option ("A", "B", "C", or "D").

RETURN STRICT JSON:
{
  "recommendedAnswer": "A",
  "solutionEn": "...",
  "solutionHi": "..."
}`;

    const response = await model.generateContent(prompt);
    const jsonStr = response.response.text().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    const recommended = (parsed.recommendedAnswer || correctAnswer || "A").toUpperCase();
    const userAns = (userSelectedAnswer || "").toUpperCase();
    const hasMismatch = Boolean(userAns && userAns !== recommended);

    return {
      solutionEn: parsed.solutionEn || "",
      solutionHi: parsed.solutionHi || "",
      recommendedAnswer: recommended,
      answerMismatch: hasMismatch,
      mismatchWarning: hasMismatch
        ? `⚠ Answer mismatch: AI recommends Option (${recommended}), but you selected Option (${userAns}) — please verify.`
        : undefined,
    };
  });
}

/**
 * CHECK TRANSLATION Action
 * Translates missing language or validates bilingual parity for Question + Options + Solution
 */
export async function checkAndTranslateQuestion({
  subject,
  statementEn,
  statementHi,
  optionsEn,
  optionsHi,
  solutionEn,
  solutionHi,
}: {
  subject: string;
  statementEn: string;
  statementHi?: string;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  solutionEn?: string;
  solutionHi?: string;
}): Promise<{
  statementEn: string;
  statementHi: string;
  optionsEn: Record<string, string>;
  optionsHi: Record<string, string>;
  solutionEn: string;
  solutionHi: string;
  report: string;
}> {
  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `You are a Senior Bilingual Academic Translator for NCERT examinations (${subject || "Science"}).

Perform "CHECK TRANSLATION":
1. If English exists and Hindi is missing: Translate statementEn, optionsEn (A, B, C, D), and solutionEn into authentic NCERT Hindi (Devanagari script).
2. If Hindi exists and English is missing: Translate statementHi, optionsHi (A, B, C, D), and solutionHi into clear academic English.
3. If both exist: Check alignment. Correct any discrepancies so Hindi Option A matches English Option A, terminology matches, and LaTeX formulas ($...$) are preserved identically.
4. Never alter numerical values, constants, or option ordering.

Current Inputs:
Statement (En): "${statementEn || ""}"
Statement (Hi): "${statementHi || ""}"
Options (En): ${JSON.stringify(optionsEn || {})}
Options (Hi): ${JSON.stringify(optionsHi || {})}
Solution (En): "${solutionEn || ""}"
Solution (Hi): "${solutionHi || ""}"

RETURN STRICT JSON SCHEMA:
{
  "statementEn": "...",
  "statementHi": "...",
  "optionsEn": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "optionsHi": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "solutionEn": "...",
  "solutionHi": "...",
  "report": "Summary of translations generated or parity verified"
}`;

    const response = await model.generateContent(prompt);
    const jsonStr = response.response.text().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      statementEn: parsed.statementEn || statementEn || "",
      statementHi: parsed.statementHi || statementHi || "",
      optionsEn: {
        A: parsed.optionsEn?.A || optionsEn?.A || "",
        B: parsed.optionsEn?.B || optionsEn?.B || "",
        C: parsed.optionsEn?.C || optionsEn?.C || "",
        D: parsed.optionsEn?.D || optionsEn?.D || "",
      },
      optionsHi: {
        A: parsed.optionsHi?.A || optionsHi?.A || "",
        B: parsed.optionsHi?.B || optionsHi?.B || "",
        C: parsed.optionsHi?.C || optionsHi?.C || "",
        D: parsed.optionsHi?.D || optionsHi?.D || "",
      },
      solutionEn: parsed.solutionEn || solutionEn || "",
      solutionHi: parsed.solutionHi || solutionHi || "",
      report: parsed.report || "Translation checked and aligned successfully.",
    };
  });
}

/**
 * Legacy translation helper wrapper
 */
export async function translateQuestionContent({
  text,
  targetLang = "HINDI",
  subject = "Science",
}: {
  text: string;
  targetLang?: string;
  subject?: string;
}): Promise<string> {
  const isTargetHindi = targetLang.toUpperCase() === "HINDI";
  const res = await checkAndTranslateQuestion({
    subject: subject || "Science",
    statementEn: isTargetHindi ? text : "",
    statementHi: isTargetHindi ? "" : text,
    optionsEn: { A: "", B: "", C: "", D: "" },
    optionsHi: { A: "", B: "", C: "", D: "" },
  });
  return isTargetHindi ? res.statementHi : res.statementEn;
}

/**
 * Legacy expanded solution generator wrapper
 */
export async function generateExpandedSolution(payload: any): Promise<any> {
  return generateSubjectAwareSolution({
    subject: payload.subject || "Biology",
    statementEn: payload.statementEn || payload.statement || "",
    statementHi: payload.statementHi || "",
    optionsEn: payload.optionsEn || payload.options || {},
    optionsHi: payload.optionsHi || {},
    correctAnswer: payload.correctAnswer || "A",
  });
}
