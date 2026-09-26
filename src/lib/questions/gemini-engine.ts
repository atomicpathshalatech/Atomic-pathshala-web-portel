import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiKeyManager, CostEstimateResult } from "@/lib/ai/gemini-key-manager";

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
  costEstimate?: CostEstimateResult;
}

// Cost-effective and ultra-fast Gemini Flash model hierarchy
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
] as const;

/**
 * Executes a Gemini request with automatic Free-Tier priority rotation, 
 * cooldown on 429 errors, and fallback to Paid-Tier keys.
 */
export async function executeGeminiWithFailover<T>(
  task: (client: GoogleGenerativeAI, modelName: string, meta: { key: string; tier: "FREE" | "PAID"; index: number }) => Promise<T>
): Promise<T> {
  return geminiKeyManager.executeWithRotation(async (client, meta) => {
    let lastError: any = null;
    for (const modelName of GEMINI_MODELS) {
      try {
        return await task(client, modelName, meta);
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || String(err)).toLowerCase();
        // If it's a rate limit or auth error, throw out to allow key rotation
        if (msg.includes("429") || msg.includes("quota") || msg.includes("resourceexhausted") || msg.includes("401")) {
          throw err;
        }
        // If model not found or transient model error, try next model in hierarchy
        console.warn(`[Gemini Engine] Model ${modelName} failed, trying fallback: ${err?.message || err}`);
      }
    }
    throw lastError || new Error("All Gemini model fallbacks failed");
  });
}

/**
 * ALL-IN-ONE Multimodal Ingestion Engine:
 * In a SINGLE API CALL, extracts image content, performs NCERT Hindi/English translation,
 * deduces correct answer, generates 4-step bilingual solution, and classifies curriculum taxonomy.
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

  return executeGeminiWithFailover(async (client, modelName, meta) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const contextInstruction = subjectContext
      ? `Curriculum context: Subject: "${subjectContext}", Chapter: "${chapterContext || ""}", Topic: "${topicContext || ""}"${difficultyContext ? `, Difficulty: "${difficultyContext}"` : ""}.`
      : "";

    const systemPrompt = `You are the Master Question Ingestion Engine for NEET, JEE Main, and NCERT examinations (Atomic Pathshala).
${contextInstruction}

YOUR TASK (ALL-IN-ONE INGESTION IN A SINGLE RESPONSE):
1. EXTRACT QUESTION & OPTIONS:
   - Extract English question into "statementEn" and options into "optionsEn" { A, B, C, D }.
   - Extract Hindi question into "statementHi" and options into "optionsHi" { A, B, C, D }.
   - ALL-IN-ONE TRANSLATION REQUIREMENT:
     * If the image is English-only: Extract English AND generate authentic NCERT Hindi translation (Devanagari script) for "statementHi" and "optionsHi" { A, B, C, D }.
     * If the image is Hindi-only: Extract Hindi AND generate authentic NCERT English translation for "statementEn" and "optionsEn" { A, B, C, D }.
     * If the image contains both: Extract both versions with 1:1 option alignment (Option 1 ↔ A, Option 2 ↔ B, etc.).
   - Standard LaTeX notation $...$ for all inline math, equations, symbols, fractions, powers, and chemical formulas (e.g. $\\text{H}_2\\text{SO}_4$, $\\text{Ca}^{2+}$).
   - CRITICAL: CHEMICAL STRUCTURES & BRANCHING FIDELITY (ORGANIC CHEMISTRY / IUPAC):
     * When extracting branched chemical structures (e.g. IUPAC naming questions), trace EVERY carbon atom in the chain and determine EXACTLY which carbon atom has vertical/diagonal branches attached.
     * NEVER misalign substituents or attach them to adjacent carbons! (For example, in $\\text{NC}-\\text{C}(\\text{CH}_3)(\\text{CHO})-\\text{CH}_2-\\text{CH}_2-\\text{COOH}$, the $\\text{CH}_3$ on top and $\\text{CHO}$ on bottom are bonded directly to the carbon atom $\\text{C}$, NOT to $\\text{CH}_2$!).
     * Format branched chemical structures using LaTeX KaTeX:
       $$\\text{NC}-\\underset{\\text{CHO}}{\\overset{\\text{CH}_3}{\\text{C}}}-\\text{CH}_2-\\text{CH}_2-\\text{COOH}$$
       or condensed structural formula $\\text{NC}-\\text{C}(\\text{CH}_3)(\\text{CHO})-\\text{CH}_2-\\text{CH}_2-\\text{COOH}$
       or perfectly column-aligned monospace lines.

2. SCIENTIFICALLY VERIFIED CORRECT ANSWER:
   - Identify visibly marked answer or deduce the 100% scientifically correct option ("A", "B", "C", or "D"). Put in "correctAnswer": ["A"].

3. CONCISE & TO-THE-POINT BILINGUAL SOLUTION (Max 3-5 lines, STRICTLY NO markdown stars '**' or '*'):
   - Keep solution SHORT, CRISP, direct, and to the point. No bloated introductory filler.
   - "solutionEn":
     Concept : [1-line core formula or scientific rule]
     Solution : [Concise 1-3 line derivation or direct option verification]
     Final Answer : Option (X)

   - "solutionHi":
     सिद्धांत : [1-पंक्ति का मुख्य सूत्र या नियम]
     हल : [संक्षिप्त 1-3 पंक्ति का चरणबद्ध हल]
     अंतिम उत्तर : विकल्प (X)

   - CRITICAL: DO NOT use markdown bold asterisks (NO ** or *). Use clean plain text with LaTeX $...$ for equations and symbols only.

4. CURRICULUM TAXONOMY & QUESTION TYPE:
   - "subject": "Physics" | "Chemistry" | "Biology" | "Mathematics"
   - "chapter": Exact official NCERT chapter title
   - "topic": Core topic name
   - "subTopic": Specific subtopic
   - "difficulty": "EASY" | "MEDIUM" | "HARD"
   - "type": "SINGLE_CORRECT" | "MULTI_CORRECT" | "INTEGER" | "ASSERTION_REASON" | "MATCH_THE_COLUMN"
   - "hasFigure": true/false (if question relies on a diagram/graph/circuit) and "figureCaption".

RETURN STRICT JSON SCHEMA:
{
  "statementEn": "English question statement with LaTeX math",
  "statementHi": "Hindi question statement with Devanagari and LaTeX math",
  "optionsEn": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "optionsHi": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": ["A"],
  "solutionEn": "Concept : ...\\nSolution : ...\\nFinal Answer : Option (A)",
  "solutionHi": "सिद्धांत : ...\\nहल : ...\\nअंतिम उत्तर : विकल्प (A)",
  "hasFigure": false,
  "figureCaption": "",
  "subject": "Physics",
  "chapter": "Current Electricity",
  "topic": "Kirchhoff's Rules",
  "subTopic": "Loop Law",
  "difficulty": "MEDIUM",
  "type": "SINGLE_CORRECT",
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
      parts.push({ text: "Below is the attached SOLUTION REFERENCE image for this question:" });
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

    // Calculate token usage & cost in Paise
    const usageMetadata = response.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || Math.ceil(systemPrompt.length / 4) + 256;
    const outputTokens = usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);
    const costEstimate = geminiKeyManager.calculateCost(inputTokens, outputTokens, meta.tier, meta.key);

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
      solutionEn: formatSolutionSpacing(parsed.solutionEn || ""),
      solutionHi: formatSolutionSpacing(parsed.solutionHi || ""),
      hasFigure: Boolean(parsed.hasFigure),
      figureCaption: parsed.figureCaption || undefined,
      subject: parsed.subject || (subjectContext as any) || "Physics",
      chapter: parsed.chapter || chapterContext || "General",
      topic: parsed.topic || topicContext || "Core Concept",
      subTopic: parsed.subTopic || undefined,
      difficulty: parsed.difficulty || (difficultyContext as any) || "MEDIUM",
      type: parsed.type || "SINGLE_CORRECT",
      category: "NCERT Canonical",
      tags: ["NEET", "NCERT"],
      isBilingual: Boolean(parsed.statementEn && parsed.statementHi),
      confidence: Number(parsed.confidence) || 95,
      costEstimate,
    };
  });
}

/**
 * ALL-IN-ONE Text Ingestion Engine:
 * In a SINGLE API CALL, parses raw question text, generates missing NCERT translation,
 * provides correct answer, 4-step bilingual solution, and full taxonomy classification.
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
  return executeGeminiWithFailover(async (client, modelName, meta) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const contextInstruction = subjectContext
      ? `Curriculum context: Subject: "${subjectContext}", Chapter: "${chapterContext || ""}", Topic: "${topicContext || ""}"${difficultyContext ? `, Difficulty: "${difficultyContext}"` : ""}.`
      : "";

    const prompt = `You are the Master Question Ingestion Engine for NEET, JEE Main, and NCERT examinations (Atomic Pathshala).
${contextInstruction}

YOUR TASK (ALL-IN-ONE INGESTION IN A SINGLE RESPONSE):
1. PARSE QUESTION & TRANSLATE:
   - Extract English statement into "statementEn" and options into "optionsEn" { A, B, C, D }.
   - Extract Hindi statement into "statementHi" and options into "optionsHi" { A, B, C, D }.
   - If English only: Extract English AND generate authentic NCERT Hindi translation (Devanagari) for statementHi and optionsHi.
   - If Hindi only: Extract Hindi AND generate authentic NCERT English translation for statementEn and optionsEn.
   - If bilingual: Extract both with 1:1 option alignment.
   - Convert math and equations to standard LaTeX ($...$).
   - CHEMICAL STRUCTURES & BRANCHING: Preserve exact carbon chain connectivity and branch attachment points. Use KaTeX $\text{NC}-\underset{\text{CHO}}{\overset{\text{CH}_3}{\text{C}}}-\text{CH}_2-\text{CH}_2-\text{COOH}$ or clean monospace alignment.

2. DEDUCE CORRECT ANSWER:
   - Identify or deduce the 100% scientifically correct option in "correctAnswer": ["A"].

3. CONCISE & TO-THE-POINT BILINGUAL SOLUTION (Max 3-5 lines, STRICTLY NO markdown stars '**' or '*'):
   - Keep solution SHORT, CRISP, and direct. No bloated filler.
   - "solutionEn": Concept : [1-line rule/formula], Solution : [1-3 line derivation or reason], Final Answer : Option (X)
   - "solutionHi": सिद्धांत : [1-पंक्ति का सूत्र/नियम], हल : [संक्षिप्त 1-3 पंक्ति का हल], अंतिम उत्तर : विकल्प (X)
   - CRITICAL: NO markdown asterisks (NO ** or *).

4. CURRICULUM TAXONOMY:
   - "subject", "chapter", "topic", "subTopic", "difficulty", "type".

Raw Text:
"""
${rawText}
"""

RETURN STRICT JSON SCHEMA:
{
  "statementEn": "...",
  "statementHi": "...",
  "optionsEn": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "optionsHi": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": ["A"],
  "solutionEn": "Concept : ...\\nSolution : ...\\nFinal Answer : Option (A)",
  "solutionHi": "सिद्धांत : ...\\nहल : ...\\nअंतिम उत्तर : विकल्प (A)",
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

    const usageMetadata = response.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
    const outputTokens = usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);
    const costEstimate = geminiKeyManager.calculateCost(inputTokens, outputTokens, meta.tier, meta.key);

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
      solutionEn: formatSolutionSpacing(parsed.solutionEn || ""),
      solutionHi: formatSolutionSpacing(parsed.solutionHi || ""),
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
      confidence: 92,
      costEstimate,
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
  customInstruction,
}: {
  subject: string;
  statementEn: string;
  statementHi?: string;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  correctAnswer?: string;
  userSelectedAnswer?: string;
  userProvidedSolution?: string;
  customInstruction?: string;
}): Promise<{
  solutionEn: string;
  solutionHi: string;
  recommendedAnswer: string;
  answerMismatch: boolean;
  mismatchWarning?: string;
  costEstimate?: CostEstimateResult;
}> {
  return executeGeminiWithFailover(async (client, modelName, meta) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const userSelectedPrompt = userSelectedAnswer ? `User Currently Selected Option: Option (${userSelectedAnswer})` : "";
    const userReferencePrompt = userProvidedSolution ? `User Provided Draft Solution: "${userProvidedSolution}"` : "";
    const userInstructionPrompt = customInstruction ? `TEACHER SPECIAL REFINEMENT REQUEST: "${customInstruction}".` : "";

    const prompt = `You are a Senior Academic Subject Expert for ${subject} at Atomic Pathshala (NEET & JEE Main Exam Board).
Generate an authoritative, 100% accurate step-by-step bilingual solution.

QUESTION DETAILS:
Question (English): "${statementEn}"
${statementHi ? `Question (Hindi): "${statementHi}"` : ""}
Options (English): ${JSON.stringify(optionsEn)}
${optionsHi ? `Options (Hindi): ${JSON.stringify(optionsHi)}` : ""}
${correctAnswer ? `Target Reference Option: Option (${correctAnswer})` : ""}
${userSelectedPrompt}
${userReferencePrompt}
${userInstructionPrompt}

MANDATORY SOLUTION STRUCTURE (SMALL, CRISP, AND STRICTLY TO THE POINT):
- Maximum 3-5 lines total. DO NOT write long explanations or bloated introductory paragraphs.
- STRICTLY NO markdown bold asterisks (NO ** or *). Use clean plain text. LaTeX $...$ only for math/formulas.

"solutionEn":
Concept : [1-line core rule/formula/theorem]

Solution :
[Concise 1-3 line step-by-step calculation or direct option evaluation]

Final Answer : Option (X)

"solutionHi":
सिद्धांत : [1-पंक्ति का मुख्य सूत्र या नियम]

हल :
[संक्षिप्त 1-3 पंक्ति का चरणबद्ध हल]

अंतिम उत्तर : विकल्प (X)

RETURN STRICT JSON SCHEMA:
{
  "recommendedAnswer": "A",
  "solutionEn": "Concept : ...\\n\\nSolution :\\n...\\n\\nFinal Answer : Option (A)",
  "solutionHi": "सिद्धांत : ...\\n\\nहल :\\n...\\n\\nअंतिम उत्तर : विकल्प (A)"
}`;

    const response = await model.generateContent(prompt);
    const jsonStr = response.response.text().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    const recommended = (parsed.recommendedAnswer || correctAnswer || "A").toUpperCase();
    const userAns = (userSelectedAnswer || "").toUpperCase();
    const hasMismatch = Boolean(userAns && userAns !== recommended);

    const usageMetadata = response.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
    const outputTokens = usageMetadata?.candidatesTokenCount || Math.ceil(jsonStr.length / 4);
    const costEstimate = geminiKeyManager.calculateCost(inputTokens, outputTokens, meta.tier, meta.key);

    return {
      solutionEn: formatSolutionSpacing(parsed.solutionEn || ""),
      solutionHi: formatSolutionSpacing(parsed.solutionHi || ""),
      recommendedAnswer: recommended,
      answerMismatch: hasMismatch,
      mismatchWarning: hasMismatch
        ? `⚠ Answer mismatch: AI recommends Option (${recommended}), but you selected Option (${userAns}) — please verify.`
        : undefined,
      costEstimate,
    };
  });
}

/**
 * Normalizes vertical spacing and sanitizes solutions ensuring clean double-newlines between sections
 * and stripping unnecessary markdown asterisks (**, *), headings, or clutter.
 */
export function formatSolutionSpacing(sol: string): string {
  if (!sol) return "";
  let formatted = sol.trim();

  // 1. Remove markdown bold/italic asterisks & underscores (e.g. **Electron:** -> Electron:)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "$1");
  formatted = formatted.replace(/\*(.*?)\*/g, "$1");
  formatted = formatted.replace(/__(.*?)__/g, "$1");
  formatted = formatted.replace(/\*/g, "");

  // 2. Remove markdown heading hashes (### Concept -> Concept)
  formatted = formatted.replace(/^#{1,6}\s+/gm, "");

  // 3. Clean and normalize section linebreaks
  formatted = formatted.replace(/([^\n])\s*\n\s*(Concept\s*:|सिद्धांत(\s*\(Concept\))?\s*:)/gi, "$1\n\n$2");
  formatted = formatted.replace(/([^\n])\s*\n\s*(Solution\s*:|हल(\s*\(Solution\))?\s*:)/gi, "$1\n\n$2");
  formatted = formatted.replace(/([^\n])\s*\n\s*(Final Answer\s*:|अंतिम उत्तर(\s*\(Final Answer\))?\s*:)/gi, "$1\n\n$2");

  // 4. Collapse excessive multiple blank lines into standard double newlines
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
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
  costEstimate?: CostEstimateResult;
}> {
  return executeGeminiWithFailover(async (client, modelName, meta) => {
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

    const usageMetadata = response.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
    const outputTokens = usageMetadata?.candidatesTokenCount || Math.ceil(jsonStr.length / 4);
    const costEstimate = geminiKeyManager.calculateCost(inputTokens, outputTokens, meta.tier, meta.key);

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
      costEstimate,
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
