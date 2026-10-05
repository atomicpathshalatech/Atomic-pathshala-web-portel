import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";

export type AnalyzableElement =
  | "STATEMENT"
  | "OPTION_A"
  | "OPTION_B"
  | "OPTION_C"
  | "OPTION_D"
  | "CORRECT_ANSWER"
  | "SOLUTION"
  | "NCERT_REFERENCE"
  | "DIFFICULTY"
  | "NATURE"
  | "COGNITIVE_LEVEL"
  | "NEET_RELEVANCE";

export interface ElementAnalysisResult {
  element: AnalyzableElement;
  hasIssue: boolean;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  problem: string | null;
  reason: string;
  suggestedImprovement: string | null;
  confidence: number; // 0–100
  promptVersion: string;
}

/**
 * Analyzes a single isolated question component (statement, specific option, answer key, solution, NCERT)
 * providing actionable reviewer suggestions without modifying the content directly.
 */
export async function analyzeQuestionElement({
  element,
  elementContent,
  questionContext,
}: {
  element: AnalyzableElement;
  elementContent: string;
  questionContext: {
    statement: string;
    options?: Record<string, string>;
    correctAnswer?: string;
    solution?: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    ncertReference?: string;
  };
}): Promise<ElementAnalysisResult> {
  const promptVersion = "ELEMENT_ANALYZER_V1";

  const systemInstruction = `You are a Senior NEET/JEE Academic Content Specialist and Chief Quality Auditor at Atomic Pathshala.
Analyze ONLY the targeted question element within the given question context.
Be rigorous on scientific correctness, mathematical accuracy, ambiguity, NCERT alignment, and plausible distractors.
Respond strictly in JSON format matching the schema.`;

  const userPrompt = `
TARGET ELEMENT TO ANALYZE: ${element}
TARGET CONTENT:
"${elementContent}"

FULL QUESTION CONTEXT:
Subject: ${questionContext.subject || "General"}
Chapter: ${questionContext.chapter || "N/A"}
Topic: ${questionContext.topic || "N/A"}
Statement: "${questionContext.statement}"
Options: ${JSON.stringify(questionContext.options || {})}
Marked Correct Answer: "${questionContext.correctAnswer || "N/A"}"
Solution: "${questionContext.solution || "N/A"}"
NCERT Reference: "${questionContext.ncertReference || "N/A"}"

TASK:
1. Determine if there is any problem (scientific error, ambiguity, wrong option, contradictory solution, incorrect calculation, false NCERT claim, poor wording).
2. Assess severity: "CRITICAL" (wrong answer, scientific flaw), "HIGH" (ambiguity, major grammar/distractor issue), "MEDIUM" (minor phrasing, style), "LOW" (slight suggestion), "NONE" (perfect).
3. Provide a clear reason and a concrete suggested improvement if needed.

JSON Output Schema:
{
  "hasIssue": boolean,
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "problem": string | null,
  "reason": string,
  "suggestedImprovement": string | null,
  "confidence": number
}
`;

  try {
    const rawResponse = await executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(userPrompt);
      return result.response.text();
    });

    const parsed = JSON.parse(rawResponse);
    return {
      element,
      hasIssue: Boolean(parsed.hasIssue),
      severity: parsed.severity || (parsed.hasIssue ? "MEDIUM" : "NONE"),
      problem: parsed.problem || null,
      reason: parsed.reason || "Element verified.",
      suggestedImprovement: parsed.suggestedImprovement || null,
      confidence: typeof parsed.confidence === "number" ? Math.round(parsed.confidence) : 90,
      promptVersion,
    };
  } catch (err) {
    console.error(`[analyzeQuestionElement] Failed for ${element}:`, err);
    return {
      element,
      hasIssue: false,
      severity: "NONE",
      problem: null,
      reason: "Automated analysis unavailable. Please review manually.",
      suggestedImprovement: null,
      confidence: 50,
      promptVersion,
    };
  }
}
