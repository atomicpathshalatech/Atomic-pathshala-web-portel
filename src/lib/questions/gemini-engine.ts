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

// Model fallback list with modern supported Gemini models
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
] as const;
const KEY_COOLDOWN_MS = 60_000;
const keyCooldowns = new Map<string, number>();

/**
 * Parses and returns all configured Gemini API keys
 */
export function getGeminiApiKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS?.trim();
  const single = process.env.GEMINI_API_KEY?.trim();

  const rawKeys: string[] = [];
  if (multi) {
    rawKeys.push(
      ...multi
        .split(",")
        .map((k) => k.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    );
  }
  if (single) {
    rawKeys.push(single.trim().replace(/^["']|["']$/g, ""));
  }

  // Filter out placeholders and long OAuth tokens (> 120 chars) that are incompatible with GoogleGenerativeAI
  const validKeys = rawKeys.filter(
    (k) => !k.includes("your_gemini_api_key") && k.length > 10 && k.length <= 120
  );

  return Array.from(new Set(validKeys));
}

/**
 * Executes a Gemini request with automatic multi-key failover and exponential retry
 */
export async function executeGeminiWithFailover<T>(
  task: (client: GoogleGenerativeAI, modelName: string) => Promise<T>
): Promise<T> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("No valid Gemini API keys configured in environment (GEMINI_API_KEYS / GEMINI_API_KEY).");
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
        const isAuthError =
          msg.includes("401") ||
          msg.includes("UNAUTHENTICATED") ||
          msg.includes("invalid authentication credentials");
        const isRateLimit =
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("ResourceExhausted") ||
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("overloaded");

        if (isAuthError) {
          // Permanently disable invalid key for current process lifecycle
          keyCooldowns.set(key, Date.now() + 24 * 60 * 60 * 1000);
        } else if (isRateLimit) {
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
  topicContext,
  difficultyContext,
}: {
  imageBase64: string;
  mimeType?: string;
  solutionImageBase64?: string;
  solutionMimeType?: string;
  subjectContext?: string;
  chapterContext?: string;
  topicContext?: string;
  difficultyContext?: string;
}): Promise<ExtractedQuestionData> {
  const cleanQuestionBase64 = imageBase64.includes(";base64,")
    ? (imageBase64.split(";base64,")[1] ?? "").trim()
    : imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();

  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const contextInstruction = subjectContext
      ? `Teacher has confirmed Subject: "${subjectContext}", Chapter: "${chapterContext || ""}", Topic: "${topicContext || ""}"${difficultyContext ? `, Difficulty: "${difficultyContext}"` : ""}. Use this curriculum context.`
      : "";

    const systemPrompt = `You are the Master Question Extraction & Ingestion Engine for NEET, JEE Main, and NCERT Board exams (Atomic Pathshala).
${contextInstruction}

YOUR TASK:
Analyze the provided examination question image and extract text, mathematical formulas, chemical reactions, diagrams, and options with 100% precision into structured fields.

CRITICAL EXTRACTION RULES:
1. BILINGUAL RECOGNITION & STRICT LANGUAGE ISOLATION:
   - If the image contains BOTH English and Hindi versions:
     * Extract English statement into statementEn, and Hindi statement into statementHi.
     * Extract English options into optionsEn.A, B, C, D.
     * Extract Hindi options into optionsHi.A, B, C, D.
     * Maintain option mapping: Hindi Option 1 ↔ English Option 1, Hindi Option 2 ↔ English Option 2, Hindi Option 3 ↔ English Option 3, Hindi Option 4 ↔ English Option 4.
     * Use language detection and structural matching. Do NOT rely only on line order.
   - SINGLE-LANGUAGE RULE:
     * If the image is ONLY English: Extract statementEn and optionsEn.A/B/C/D. Leave statementHi as "" and optionsHi.A/B/C/D as "". Do NOT invent or auto-translate during extraction.
     * If the image is ONLY Hindi: Extract statementHi and optionsHi.A/B/C/D. Leave statementEn as "" and optionsEn.A/B/C/D as "". Do NOT invent or auto-translate during extraction.

2. MATHEMATICAL & SCIENTIFIC PRECISION:
   - Use standard LaTeX notation for equations: $...$ for inline math, $$...$$ for block formulas.
   - For chemical formulas, preserve subscripts and charges (e.g. $\\text{CaCO}_3$, $\\text{H}_2\\text{SO}_4$, $\\text{Fe}^{3+}$).
   - Preserve units, powers, fractions, vectors, superscripts and subscripts.

3. OPTIONS SEPARATION:
   - Always separate question statement from options A, B, C, D. Never dump options into the statement field.
   - Detect option formats: (A)/(B)/(C)/(D), (1)/(2)/(3)/(4), 1./2./3./4. Map 1->A, 2->B, 3->C, 4->D.

4. DIAGRAM / FIGURE DETECTION:
   - If the question relies on a geometric diagram, electric circuit, graph, molecular structure, or organ diagram shown in the image, set "hasFigure": true and provide a descriptive "figureCaption".

5. CORRECT ANSWER:
   - If marked in the image (ticked, circled, or key visible), set "correctAnswer": ["A"|"B"|"C"|"D"].
   - If not visibly marked, solve the question and provide the scientifically verified correct answer.

6. SOLUTION FORMAT SPECIFICATION (CRITICAL):
   Structure "solutionEn" EXACTLY in these 4 labeled sections:
   Explaining : [1-2 sentences stating given parameters and what we need to calculate/find]
   Concept : This question is based on [Specific scientific law, theorem, formula, or concept name]
   Solution :
   [If calculation: Line-by-line derivation with LaTeX formulas $...$, values substitution, intermediate steps, and final value with units]
   [If conceptual/statements: Point-by-point breakdown evaluating each option or statement with authentic NCERT reason]
   Final Answer : Option (X)

   Structure "solutionHi" with matching Devanagari translation:
   कथन (Explaining) : [...]
   सिद्धांत (Concept) : यह प्रश्न [...] पर आधारित है।
   हल (Solution) : [...]
   अंतिम उत्तर (Final Answer) : विकल्प (X)

7. CURRICULUM METADATA INFERENCE:
   Accurately infer:
   - "subject": "Physics" | "Chemistry" | "Biology" | "Mathematics"
   - "chapter": Exact official NCERT chapter title (e.g. "Solutions", "Cell: The Unit of Life", "Current Electricity", "Ray Optics and Optical Instruments")
   - "topic": Exact core topic
   - "subTopic": Specific subtopic
   - "difficulty": "EASY" | "MEDIUM" | "HARD"
   - "type": "SINGLE_CORRECT" | "MULTIPLE_CORRECT" | "NUMERICAL" | "ASSERTION_REASON" | "MATCH_THE_COLUMN"

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
  "solutionEn": "Explaining : ...\\nConcept : ...\\nSolution : ...\\nFinal Answer : Option (A)",
  "solutionHi": "कथन (Explaining) : ...\\nसिद्धांत (Concept) : ...\\nहल (Solution) : ...\\nअंतिम उत्तर (Final Answer) : विकल्प (A)",
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
      const cleanSolutionBase64 = solutionImageBase64.includes(";base64,")
        ? (solutionImageBase64.split(";base64,")[1] ?? "").trim()
        : solutionImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
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
  topicContext,
  difficultyContext,
}: {
  rawText: string;
  subjectContext?: string;
  chapterContext?: string;
  topicContext?: string;
  difficultyContext?: string;
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
      ? `Teacher has confirmed Subject: "${subjectContext}", Chapter: "${chapterContext || ""}", Topic: "${topicContext || ""}"${difficultyContext ? `, Difficulty: "${difficultyContext}"` : ""}. Use this curriculum context.`
      : "";

    const prompt = `You are the Master Question Extraction & Ingestion Engine for NEET, JEE Main, and NCERT Board exams (Atomic Pathshala).
${contextInstruction}

Analyze the following pasted examination question text and parse it into structured bilingual format.

CRITICAL EXTRACTION RULES:
1. BILINGUAL RECOGNITION & STRICT LANGUAGE ISOLATION:
   - If text contains BOTH English and Hindi versions:
     * Extract English statement into statementEn, and Hindi statement into statementHi.
     * Extract English options into optionsEn.A, B, C, D.
     * Extract Hindi options into optionsHi.A, B, C, D.
     * Maintain option mapping: Hindi Option 1 ↔ English Option 1, Hindi Option 2 ↔ English Option 2, Hindi Option 3 ↔ English Option 3, Hindi Option 4 ↔ English Option 4.
     * Use language detection and semantic matching. Do NOT rely only on physical line order.
   - SINGLE-LANGUAGE RULE:
     * If text is ONLY English: Extract statementEn and optionsEn.A/B/C/D. Leave statementHi as "" and optionsHi.A/B/C/D as "". Do NOT invent or auto-translate during extraction.
     * If text is ONLY Hindi: Extract statementHi and optionsHi.A/B/C/D. Leave statementEn as "" and optionsEn.A/B/C/D as "". Do NOT invent or auto-translate during extraction.

2. MATHEMATICAL & SCIENTIFIC PRECISION:
   - Convert mathematical equations, symbols, fractions, and powers to standard LaTeX notation: $...$ for inline math, $$...$$ for block math.
   - Preserve chemical equations and formulas verbatim (e.g. $\\text{H}_2\\text{SO}_4$).

3. OPTION NUMBERING CONVERSION:
   - Map (1)/(2)/(3)/(4) or (A)/(B)/(C)/(D) or (a)/(b)/(c)/(d) consistently to keys "A", "B", "C", "D".

4. CORRECT ANSWER DEDUCTION:
   - Deduce the scientifically correct option ("A", "B", "C", or "D") and place inside correctAnswer array.

5. SOLUTION FORMAT SPECIFICATION (CRITICAL):
   Structure "solutionEn" EXACTLY in these 4 labeled sections:
   Explaining : [1-2 sentences stating given parameters and what we need to calculate/find]
   Concept : This question is based on [Specific scientific law, theorem, formula, or concept name]
   Solution :
   [If calculation: Line-by-line derivation with LaTeX formulas $...$, values substitution, intermediate steps, and final value with units]
   [If conceptual/statements: Point-by-point breakdown evaluating each option or statement with authentic NCERT reason]
   Final Answer : Option (X)

   Structure "solutionHi" with matching Devanagari translation:
   कथन (Explaining) : [...]
   सिद्धांत (Concept) : यह प्रश्न [...] पर आधारित है।
   हल (Solution) : [...]
   अंतिम उत्तर (Final Answer) : विकल्प (X)

6. CURRICULUM METADATA INFERENCE:
   Accurately infer:
   - "subject": "${subjectContext || ""}" (or infer: "Physics" | "Chemistry" | "Biology" | "Mathematics")
   - "chapter": "${chapterContext || ""}" (or infer exact official NCERT chapter title)
   - "topic": "${topicContext || ""}" (or infer exact core topic)
   - "subTopic": Specific subtopic
   - "difficulty": "EASY" | "MEDIUM" | "HARD"
   - "type": "SINGLE_CORRECT" | "MULTIPLE_CORRECT" | "NUMERICAL" | "ASSERTION_REASON" | "MATCH_THE_COLUMN"

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
  "solutionEn": "Explaining : ...\\nConcept : ...\\nSolution : ...\\nFinal Answer : Option (A)",
  "solutionHi": "कथन (Explaining) : ...\\nसिद्धांत (Concept) : ...\\nहल (Solution) : ...\\nअंतिम उत्तर (Final Answer) : विकल्प (A)",
  "subject": "${subjectContext || "Biology"}",
  "chapter": "${chapterContext || "General"}",
  "topic": "${topicContext || "Core Concept"}",
  "subTopic": "Specific subtopic",
  "difficulty": "${difficultyContext || "MEDIUM"}",
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
      solutionEn: parsed.solutionEn || "",
      solutionHi: parsed.solutionHi || "",
      hasFigure: false,
      subject: parsed.subject || (subjectContext as any) || "Biology",
      chapter: parsed.chapter || chapterContext || "General",
      topic: parsed.topic || topicContext || "Core Concept",
      subTopic: parsed.subTopic || undefined,
      difficulty: parsed.difficulty || (difficultyContext as any) || "MEDIUM",
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

    const userSelectedPrompt = userSelectedAnswer ? `User Currently Selected Option: Option (${userSelectedAnswer})` : "";
    const userReferencePrompt = userProvidedSolution ? `User Provided Draft Solution (for reference/polishing): "${userProvidedSolution}"` : "";

    const prompt = `You are a Senior Academic Subject Expert for ${subject} at Atomic Pathshala (NEET & JEE Main Exam Board).
Generate an authoritative, 100% accurate, high-precision step-by-step bilingual solution for this question.

QUESTION DETAILS:
Question (English): "${statementEn}"
${statementHi ? `Question (Hindi): "${statementHi}"` : ""}
Options (English): ${JSON.stringify(optionsEn)}
${optionsHi ? `Options (Hindi): ${JSON.stringify(optionsHi)}` : ""}
${correctAnswer ? `Target Reference Option: Option (${correctAnswer})` : ""}
${userSelectedPrompt}
${userReferencePrompt}

CRITICAL ACCURACY & CALCULATION RULES:
1. First solve the problem step-by-step with 100% arithmetic and algebraic rigor.
2. Verify all numbers, units, exponents, signs, and constants (e.g. R, g, h, c, Avogadro's number).
3. If it is a Biology question, adhere strictly to authentic NCERT Class 11 & 12 facts and terminology.
4. The calculated or reasoned answer MUST match the deduced "recommendedAnswer" option ("A"|"B"|"C"|"D").

MANDATORY SOLUTION STRUCTURE (EXACT FORMAT AS REQUIRED BY ATOMIC PATHSHALA):
Structure "solutionEn" EXACTLY in these 4 labeled sections:

Explaining : [1-2 sentences stating given parameters and what we need to calculate/find. e.g. "The mass of solute 'A' (mol mass = 40 g mol^-1) that should be added to 180 g of pure water in order to lower its vapour pressure to 4/5th of its original value :-"]

Concept : This question is based on [Specific scientific law, theorem, formula, or concept name, e.g. "This question is based on RLVP", "This Question is based on phases of the Cell Cycle"]

Solution :
[If numerical / calculation (Physics / Chemistry / Mathematics):
Provide step-by-step derivation with clean LaTeX formulas on separate lines:
1. State the formula clearly: $\\frac{P_B^0 - P_B}{P_B^0} = \\frac{n_A}{n_A + n_B}$
2. Substitute the values: $\\frac{P_B^0 - \\frac{4}{5}P_B^0}{P_B^0} = \\frac{n_A}{n_A + 10}$
3. Simplify algebraically step-by-step:
   $\\frac{1}{5} = \\frac{n_A}{n_A + 10}$
   $n_A + 10 = 5n_A$
   $4n_A = 10$
   $n_A = \\frac{10}{4} = 2.5$
4. Final calculation of mass or required physical quantity with units:
   $\\frac{w_A}{40} = 2.5 \\implies w_A = 40 \\times 2.5 = 100\\text{ g}$.
]
[If biological / conceptual / sequence / matching / statements:
Provide option-by-option or statement-by-statement breakdown with exact NCERT facts:
e.g.
Maximum Growth (A): Occurs during the G1 phase, where the cell grows in size and synthesizes proteins necessary for DNA replication.
DNA Replication (B): Takes place during the S phase, where the cell duplicates its DNA to ensure each daughter cell receives an identical set.
Tubulin Synthesis (C): Occurs during the G2 phase, where the cell synthesizes tubulin proteins required for forming the mitotic spindle during mitosis.
]

Final Answer : Option (X)

Structure "solutionHi" with the matching Devanagari translation:
कथन (Explaining) : [संक्षिप्त विवरण कि प्रश्न में क्या दिया गया है और क्या ज्ञात करना है]
सिद्धांत (Concept) : यह प्रश्न [सिद्धांत/नियम का नाम] पर आधारित है।
हल (Solution) : [चरण-दर-चरण गणितीय हल या प्रत्येक विकल्प का वैज्ञानिक विश्लेषण]
अंतिम उत्तर (Final Answer) : विकल्प (X)

RETURN STRICT JSON SCHEMA:
{
  "recommendedAnswer": "A",
  "solutionEn": "Explaining : ...\\nConcept : ...\\nSolution : ...\\nFinal Answer : Option (A)",
  "solutionHi": "कथन (Explaining) : ...\\nसिद्धांत (Concept) : ...\\nहल (Solution) : ...\\nअंतिम उत्तर (Final Answer) : विकल्प (A)"
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
