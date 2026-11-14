/**
 * ATOMIC PATHSHALA — xAI GROK PROVIDER (Independent AI Review)
 * Connects to xAI Grok API (https://api.x.ai/v1) with configurable fallback to Groq reasoning engine.
 * Solves question from first principles, verifies answer, checks solution steps, detects ambiguity,
 * evaluates NCERT alignment, and generates field-level suggestions.
 */

import OpenAI from "openai";
import { parseAiJson } from "@/lib/ai/latex-json";
import { QuestionSnapshot, SingleModelReview } from "./types";

function cleanKey(raw?: string): string | null {
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

interface GrokClientInfo {
  client: OpenAI;
  model: string;
  provider: "grok" | "groq";
}

function getGrokClient(): GrokClientInfo | null {
  // 1. Check xAI Grok key
  const xaiKey = cleanKey(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
  if (xaiKey) {
    return {
      client: new OpenAI({
        apiKey: xaiKey,
        baseURL: process.env.XAI_BASE_URL || process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      }),
      model: process.env.XAI_MODEL || process.env.GROK_MODEL || "grok-2-latest",
      provider: "grok",
    };
  }

  // 2. Fallback to Groq if configured
  const groqKey = cleanKey(process.env.GROQ_API_KEY || process.env.GROQ_KEY);
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      provider: "groq",
    };
  }

  return null;
}

export async function reviewQuestionWithGrok(
  snapshot: QuestionSnapshot,
  sourceContext?: string
): Promise<SingleModelReview> {
  const startTime = Date.now();
  const clientInfo = getGrokClient();

  if (!clientInfo) {
    const isSimulated = process.env.SIMULATE_MISSING_AI_PROVIDERS === "true";
    if (isSimulated) {
      const stored = (snapshot.storedAnswer || [])[0] || "A";
      return {
        provider: "grok",
        model: "grok-2-simulated",
        solvedAnswer: stored,
        stepByStepSolution: snapshot.solution,
        identifiedMistakes: [],
        recommendApproval: true,
        answerMatches: true,
        isScientificallyCorrect: true,
        isMathematicallyCorrect: true,
        scientificErrors: [],
        mathematicalErrors: [],
        solutionCorrections: null,
        suggestedQuestion: null,
        suggestedOptions: null,
        suggestedAnswer: null,
        topicCorrections: null,
        ncertAlignment: {
          supported: true,
          status: "DIRECT",
          explanation: "Simulated Grok NCERT check passed",
        },
        ambiguityDetected: false,
        multipleCorrectOptionsDetected: false,
        decision: "APPROVE",
        rejectionReasons: [],
        confidenceScore: 0.94,
        tokenUsage: {
          inputTokens: 800,
          outputTokens: 400,
          durationMs: Date.now() - startTime,
          estimatedCostUsd: 0.004,
        },
        rawOutput: "Simulated Grok review (XAI_API_KEY not configured)",
      };
    }

    return {
      provider: "grok",
      model: "grok-2",
      solvedAnswer: "",
      stepByStepSolution: null,
      identifiedMistakes: [],
      recommendApproval: false,
      answerMatches: false,
      isScientificallyCorrect: true,
      isMathematicallyCorrect: true,
      scientificErrors: [],
      mathematicalErrors: [],
      solutionCorrections: null,
      suggestedQuestion: null,
      suggestedOptions: null,
      suggestedAnswer: null,
      topicCorrections: null,
      ncertAlignment: { supported: false, status: "UNVERIFIED" },
      ambiguityDetected: false,
      multipleCorrectOptionsDetected: false,
      decision: "REJECT",
      rejectionReasons: ["XAI_API_KEY or GROK_API_KEY is not configured on server."],
      confidenceScore: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        estimatedCostUsd: 0,
      },
      apiError: {
        isApiError: true,
        errorType: "AUTH_ERROR",
        message: "XAI_API_KEY or GROK_API_KEY is not configured on server.",
      },
      rawOutput: "XAI_API_KEY is not configured.",
    };
  }

  const { client, model, provider } = clientInfo;

  const prompt = `You are a Senior Academic Auditor and AI Solver for NEET UG questions at Atomic Pathshala.
Evaluate the following question from first principles:

Question ID: ${snapshot.id || "N/A"}
Subject: ${snapshot.subject}
Chapter: ${snapshot.chapter || "N/A"}
Topic: ${snapshot.topic || "N/A"}
Subtopic: ${snapshot.subTopic || "N/A"}
Difficulty: ${snapshot.difficulty || "MEDIUM"}
Type: ${snapshot.type || "SINGLE_CORRECT"}

STATEMENT:
${snapshot.statement}

OPTIONS:
${JSON.stringify(snapshot.options, null, 2)}

CLAIMED ANSWER KEY:
${JSON.stringify(snapshot.storedAnswer)}

CLAIMED SOLUTION:
${snapshot.solution || "None"}

${sourceContext ? `SOURCE NCERT REFERENCE:\n${sourceContext}\n` : ""}

TASKS:
1. Solve independently. Which option letter is definitively correct?
2. Write a clear, step-by-step KaTeX solution justifying that answer.
3. Compare against the claimed answer key. Does it match?
4. Identify any scientific, calculation, or ambiguity mistakes in the question or solution.
5. If the claimed answer is correct and the question is scientifically sound, set recommendApproval to true.
6. If any field needs correction (statement, solution, options, correctAnswer, topic, difficulty), provide explicit field suggestions.

Return ONLY a valid JSON object matching this schema:
{
  "solvedAnswer": "A",
  "stepByStepSolution": "Step 1: ... Step 2: ... Therefore, option (A) is correct.",
  "identifiedMistakes": ["List of mistakes if any"],
  "recommendApproval": true,
  "isScientificallyCorrect": true,
  "isMathematicallyCorrect": true,
  "scientificErrors": [],
  "mathematicalErrors": [],
  "solutionCorrections": null,
  "suggestedQuestion": null,
  "suggestedOptions": null,
  "suggestedAnswer": null,
  "topicCorrections": null,
  "ncertAlignment": {
    "supported": true,
    "status": "DIRECT",
    "explanation": "Supported by NCERT standard principles"
  },
  "ambiguityDetected": false,
  "multipleCorrectOptionsDetected": false,
  "decision": "APPROVE",
  "rejectionReasons": [],
  "confidenceScore": 0.95,
  "fieldSuggestions": [
    {
      "field": "solution",
      "language": "ENGLISH",
      "currentValue": "",
      "suggestedValue": "",
      "reason": "",
      "severity": "MEDIUM"
    }
  ]
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const durationMs = Date.now() - startTime;
    const rawContent = response.choices[0]?.message?.content || "";
    const parsed = parseAiJson(rawContent);

    const storedAnswer = (snapshot.storedAnswer || []).map((a) => a.trim().toUpperCase());
    const solvedAnswer = (parsed.solvedAnswer || "").trim().toUpperCase();
    const answerMatches = storedAnswer.includes(solvedAnswer);

    const inputTokens = response.usage?.prompt_tokens || 800;
    const outputTokens = response.usage?.completion_tokens || 400;
    const estimatedCostUsd = (inputTokens / 1_000_000) * 2.0 + (outputTokens / 1_000_000) * 10.0;

    return {
      provider,
      model,
      solvedAnswer,
      stepByStepSolution: parsed.stepByStepSolution || null,
      identifiedMistakes: Array.isArray(parsed.identifiedMistakes) ? parsed.identifiedMistakes : [],
      recommendApproval: Boolean(parsed.recommendApproval ?? answerMatches),
      answerMatches,
      isScientificallyCorrect: Boolean(parsed.isScientificallyCorrect ?? true),
      isMathematicallyCorrect: Boolean(parsed.isMathematicallyCorrect ?? true),
      scientificErrors: Array.isArray(parsed.scientificErrors) ? parsed.scientificErrors : [],
      mathematicalErrors: Array.isArray(parsed.mathematicalErrors) ? parsed.mathematicalErrors : [],
      solutionCorrections: parsed.solutionCorrections || null,
      suggestedQuestion: parsed.suggestedQuestion || null,
      suggestedOptions: parsed.suggestedOptions || null,
      suggestedAnswer: Array.isArray(parsed.suggestedAnswer) ? parsed.suggestedAnswer : null,
      topicCorrections: parsed.topicCorrections || null,
      ncertAlignment: parsed.ncertAlignment || { supported: true, status: "DIRECT" },
      ambiguityDetected: Boolean(parsed.ambiguityDetected),
      multipleCorrectOptionsDetected: Boolean(parsed.multipleCorrectOptionsDetected),
      decision: answerMatches && (parsed.isScientificallyCorrect !== false) ? "APPROVE" : "REJECT",
      rejectionReasons: Array.isArray(parsed.rejectionReasons) ? parsed.rejectionReasons : (!answerMatches ? ["ANSWER_KEY_MISMATCH"] : []),
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.9,
      fieldSuggestions: Array.isArray(parsed.fieldSuggestions) ? parsed.fieldSuggestions : [],
      tokenUsage: {
        inputTokens,
        outputTokens,
        durationMs,
        estimatedCostUsd,
      },
      rawOutput: rawContent,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = msg.includes("401") || msg.includes("API key") || msg.includes("auth");

    return {
      provider,
      model,
      solvedAnswer: "",
      stepByStepSolution: null,
      identifiedMistakes: [`Execution failed: ${msg}`],
      recommendApproval: false,
      answerMatches: false,
      isScientificallyCorrect: false,
      isMathematicallyCorrect: false,
      scientificErrors: [`Provider execution error: ${msg}`],
      mathematicalErrors: [],
      solutionCorrections: null,
      suggestedQuestion: null,
      suggestedOptions: null,
      suggestedAnswer: null,
      topicCorrections: null,
      ncertAlignment: { supported: false, status: "UNVERIFIED" },
      ambiguityDetected: false,
      multipleCorrectOptionsDetected: false,
      decision: "REJECT",
      rejectionReasons: [isAuth ? "AUTH_ERROR" : "API_ERROR"],
      confidenceScore: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        estimatedCostUsd: 0,
      },
      apiError: {
        isApiError: true,
        errorType: isAuth ? "AUTH_ERROR" : "NETWORK_ERROR",
        message: msg,
      },
      rawOutput: `API_ERROR: ${msg}`,
    };
  }
}

export const reviewQuestionWithGroq = reviewQuestionWithGrok;
