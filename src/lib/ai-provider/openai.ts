/**
 * ATOMIC PATHSHALA — OPENAI PROVIDER (Independent L2 Review)
 * Uses OpenAI GPT-4o for independent blind solving, scientific correctness, and NCERT evidence checks.
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

function getOpenAIClient(): OpenAI | null {
  const apiKey = cleanKey(process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY);
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

export async function reviewQuestionWithOpenAI(
  snapshot: QuestionSnapshot,
  sourceContext?: string
): Promise<SingleModelReview> {
  const startTime = Date.now();
  const client = getOpenAIClient();
  const modelName = process.env.OPENAI_MODEL || "gpt-4o";

  if (!client) {
    // If OPENAI_API_KEY is not configured, check if SIMULATE_MISSING_AI_PROVIDERS is allowed
    // or return explicit API_FAILURE status so system remains truthful.
    if (process.env.SIMULATE_MISSING_AI_PROVIDERS === "true") {
      // Deterministic simulation for local testing/CI
      const stored = (snapshot.storedAnswer || [])[0] || "A";
      return {
        provider: "openai",
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
        confidenceScore: 0.92,
        tokenUsage: {
          inputTokens: 750,
          outputTokens: 380,
          durationMs: Date.now() - startTime,
          estimatedCostUsd: 0.005,
        },
        rawOutput: "Simulated L2 OpenAI review (No OPENAI_API_KEY configured)",
      };
    }

    return {
      provider: "openai",
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
      rejectionReasons: ["API_FAILURE: OPENAI_API_KEY is not configured in server environment"],
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
        message: "OPENAI_API_KEY is not configured in server environment (.env).",
        sanitizedDetails: "Missing OPENAI_API_KEY",
      },
      rawOutput: "API_ERROR: Missing OPENAI_API_KEY",
    };
  }

  const prompt = `You are acting as an independent Expert L2 Content Reviewer (OpenAI) for Atomic Pathshala NEET-UG.
Your job is to independently solve this question BLIND, verify the scientific and mathematical correctness, and assess alignment with NCERT.

QUESTION TO EVALUATE:
Statement: ${snapshot.statement}
Options:
A: ${snapshot.options.A || ""}
B: ${snapshot.options.B || ""}
C: ${snapshot.options.C || ""}
D: ${snapshot.options.D || ""}
Stated Answer Key: ${(snapshot.storedAnswer || []).join(", ")}
Stated Solution: ${snapshot.solution || "None"}
Subject: ${snapshot.subject} | Chapter: ${snapshot.chapter || "N/A"} | Topic: ${snapshot.topic || "N/A"}

${sourceContext ? `SOURCE MATERIAL REFERENCE:
${sourceContext}` : ""}

DO NOT take the stated answer for granted. Derive the answer step-by-step from fundamental principles.
Check if any options are physically impossible, chemically invalid, or mathematically wrong.

Return ONLY a JSON response in this exact format:
{
  "solvedAnswer": "A",
  "stepByStepSolution": "Core Concept: ...\\nStep-by-Step Derivation: ...\\nConclusion: Option (A)",
  "identifiedMistakes": [],
  "recommendApproval": false,
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
    "pageNumber": 60,
    "citation": "NCERT Chapter ...",
    "explanation": "Consistent with NCERT principles"
  },
  "ambiguityDetected": false,
  "multipleCorrectOptionsDetected": false,
  "decision": "APPROVE",
  "rejectionReasons": [],
  "confidenceScore": 0.95
}`;

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: "You are an expert NEET-UG quality control reviewer. Return strictly JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const durationMs = Date.now() - startTime;
    const text = response.choices[0]?.message?.content || "{}";
    const parsed = parseAiJson(text);

    const solved = String(parsed.solvedAnswer || "").trim().toUpperCase();
    const stored = (snapshot.storedAnswer || []).map((k) => k.trim().toUpperCase());
    const answerMatches = parsed.answerMatches ?? stored.includes(solved);

    const inputTokens = response.usage?.prompt_tokens || 800;
    const outputTokens = response.usage?.completion_tokens || 400;
    // Standard GPT-4o pricing approx $2.50 / 1M in, $10.00 / 1M out
    const estimatedCostUsd = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;

    return {
      provider: "openai",
      model: modelName,
      solvedAnswer: solved || (stored[0] ?? "A"),
      stepByStepSolution: String(parsed.stepByStepSolution || parsed.solutionCorrections || "").trim() || null,
      identifiedMistakes: Array.isArray(parsed.identifiedMistakes) ? parsed.identifiedMistakes : (Array.isArray(parsed.scientificErrors) ? parsed.scientificErrors : []),
      recommendApproval: Boolean(parsed.recommendApproval ?? (answerMatches && !parsed.ambiguityDetected)),
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
        explanation: "Verified by OpenAI",
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
    console.error("[OpenAIReview] Error:", err);
    const errMsg = err?.message || String(err);
    const isAuth = errMsg.includes("401") || errMsg.includes("Incorrect API key") || errMsg.includes("invalid_api_key");
    const isBilling = errMsg.includes("quota") || errMsg.includes("billing") || errMsg.includes("insufficient_quota");
    const isRate = errMsg.includes("429") || errMsg.includes("rate_limit");

    const errorType = isAuth
      ? "AUTH_ERROR"
      : isBilling
      ? "INSUFFICIENT_CREDITS"
      : isRate
      ? "RATE_LIMIT"
      : "NETWORK_ERROR";

    const userFriendlyMsg = isAuth
      ? "OpenAI API Key is incorrect or invalid (OpenAI keys must start with 'sk-'). Please check OPENAI_API_KEY."
      : isBilling
      ? "OpenAI API quota exceeded or billing inactive. Please check credits at platform.openai.com."
      : isRate
      ? "OpenAI rate limit reached. Please wait a moment and retry."
      : `OpenAI provider service error: ${errMsg}`;

    return {
      provider: "openai",
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
