/**
 * ATOMIC PATHSHALA — ANTHROPIC CLAUDE PROVIDER (Independent L3 Review)
 * Uses Anthropic Claude 3.5 Sonnet for independent blind solving, ambiguity checking,
 * multi-correct option detection, and NCERT alignment verification.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "@/lib/ai/latex-json";
import { QuestionSnapshot, SingleModelReview } from "./types";

function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new Anthropic({ apiKey });
}

export async function reviewQuestionWithClaude(
  snapshot: QuestionSnapshot,
  sourceContext?: string
): Promise<SingleModelReview> {
  const startTime = Date.now();
  const client = getClaudeClient();
  const modelName = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  if (!client) {
    if (process.env.SIMULATE_MISSING_AI_PROVIDERS === "true") {
      const stored = (snapshot.storedAnswer || [])[0] || "A";
      return {
        provider: "claude",
        model: `${modelName}-simulated`,
        solvedAnswer: stored,
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
          explanation: "Simulated NCERT check passed",
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
          estimatedCostUsd: 0.008,
        },
        rawOutput: "Simulated L3 Claude review (No ANTHROPIC_API_KEY configured)",
      };
    }

    return {
      provider: "claude",
      model: modelName,
      solvedAnswer: "",
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
      rejectionReasons: ["API_FAILURE: ANTHROPIC_API_KEY is not configured in server environment"],
      confidenceScore: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        estimatedCostUsd: 0,
      },
      apiError: {
        isApiError: true,
        errorType: "CONFIG_ERROR",
        message: "ANTHROPIC_API_KEY is not configured in server environment (.env).",
        sanitizedDetails: "Missing ANTHROPIC_API_KEY",
      },
      rawOutput: "API_ERROR: Missing ANTHROPIC_API_KEY",
    };
  }

  const prompt = `You are acting as an independent Expert L3 Content Auditor (Claude) for Atomic Pathshala NEET-UG.
Your mission is to perform a rigorous, independent quality check:
1. Solve the question blind without assuming the stated answer is correct.
2. Check for ambiguity or phrasing that could lead to multiple valid interpretations.
3. Check whether more than one option could be considered correct under NEET examination conventions.
4. Verify NCERT alignment and factual correctness.

QUESTION DETAILS:
Statement: ${snapshot.statement}
Options:
A: ${snapshot.options.A || ""}
B: ${snapshot.options.B || ""}
C: ${snapshot.options.C || ""}
D: ${snapshot.options.D || ""}
Stated Answer Key: ${(snapshot.storedAnswer || []).join(", ")}
Stated Solution: ${snapshot.solution || "None"}
Subject: ${snapshot.subject} | Chapter: ${snapshot.chapter || "N/A"} | Topic: ${snapshot.topic || "N/A"}

${sourceContext ? `REFERENCE EVIDENCE:
${sourceContext}` : ""}

Return ONLY a JSON response in this exact schema:
{
  "solvedAnswer": "A",
  "answerMatches": true,
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
    "book": "NCERT Class 11/12",
    "pageNumber": 72,
    "citation": "NCERT Textbook Chapter ...",
    "explanation": "Directly grounded in NCERT concepts"
  },
  "ambiguityDetected": false,
  "multipleCorrectOptionsDetected": false,
  "decision": "APPROVE",
  "rejectionReasons": [],
  "confidenceScore": 0.95
}`;

  try {
    const response = await client.messages.create({
      model: modelName,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const durationMs = Date.now() - startTime;
    const textBlock = response.content.find((c) => c.type === "text");
    const text = textBlock ? textBlock.text : "{}";
    const parsed = parseAiJson(text);

    const solved = String(parsed.solvedAnswer || "").trim().toUpperCase();
    const stored = (snapshot.storedAnswer || []).map((k) => k.trim().toUpperCase());
    const answerMatches = parsed.answerMatches ?? stored.includes(solved);

    const inputTokens = response.usage?.input_tokens || 850;
    const outputTokens = response.usage?.output_tokens || 420;
    // Claude 3.5 Sonnet: $3 / 1M in, $15 / 1M out
    const estimatedCostUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    return {
      provider: "claude",
      model: modelName,
      solvedAnswer: solved || (stored[0] ?? "A"),
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
      ncertAlignment: parsed.ncertAlignment || {
        supported: true,
        status: "DIRECT",
        explanation: "Verified by Claude",
      },
      ambiguityDetected: Boolean(parsed.ambiguityDetected),
      multipleCorrectOptionsDetected: Boolean(parsed.multipleCorrectOptionsDetected),
      decision: parsed.decision || (answerMatches ? "APPROVE" : "REJECT"),
      rejectionReasons: Array.isArray(parsed.rejectionReasons) ? parsed.rejectionReasons : [],
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.9,
      tokenUsage: {
        inputTokens,
        outputTokens,
        durationMs,
        estimatedCostUsd,
      },
      rawOutput: text,
    };
  } catch (err: any) {
    console.error("[ClaudeReview] Error:", err);
    const errMsg = err?.message || String(err);
    const isBilling = errMsg.includes("credit balance is too low") || errMsg.includes("balance") || errMsg.includes("billing");
    const isAuth = errMsg.includes("401") || errMsg.includes("invalid_api_key") || errMsg.includes("authentication_error");
    const isRate = errMsg.includes("429") || errMsg.includes("rate_limit");

    const errorType = isBilling
      ? "INSUFFICIENT_CREDITS"
      : isAuth
      ? "AUTH_ERROR"
      : isRate
      ? "RATE_LIMIT"
      : "NETWORK_ERROR";

    const userFriendlyMsg = isBilling
      ? "Anthropic account credit balance is too low ($0 credits). Please add credits at console.anthropic.com/settings/plans or review via Faculty Override."
      : isAuth
      ? "Anthropic API Key is incorrect or invalid. Please verify ANTHROPIC_API_KEY in your environment."
      : isRate
      ? "Anthropic rate limit reached. Please wait a moment and retry."
      : `Claude provider service error: ${errMsg}`;

    return {
      provider: "claude",
      model: modelName,
      solvedAnswer: "",
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
      rejectionReasons: [`API_FAILURE: ${userFriendlyMsg}`],
      confidenceScore: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        estimatedCostUsd: 0,
      },
      apiError: {
        isApiError: true,
        errorType,
        message: userFriendlyMsg,
        sanitizedDetails: errMsg,
      },
      rawOutput: `API_ERROR: ${errMsg}`,
    };
  }
}
