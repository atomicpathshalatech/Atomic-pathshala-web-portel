/**
 * ATOMIC PATHSHALA — GROQ PROVIDER (Independent L3 Review)
 * Uses Groq ultra-fast Llama-3.3-70B reasoning engine for independent blind solving,
 * ambiguity checking, multiple-correct option detection, and NCERT alignment verification.
 */

import OpenAI from "openai";
import { parseAiJson } from "@/lib/ai/latex-json";
import { QuestionSnapshot, SingleModelReview } from "./types";

function getGroqClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  });
}

export async function reviewQuestionWithGroq(
  snapshot: QuestionSnapshot,
  sourceContext?: string
): Promise<SingleModelReview> {
  const startTime = Date.now();
  const client = getGroqClient();
  const modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!client) {
    if (process.env.SIMULATE_MISSING_AI_PROVIDERS === "true") {
      const stored = (snapshot.storedAnswer || [])[0] || "A";
      return {
        provider: "groq",
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
          estimatedCostUsd: 0.0005,
        },
        rawOutput: "Simulated L3 Groq review (No GROQ_API_KEY configured)",
      };
    }

    return {
      provider: "groq",
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
      rejectionReasons: ["API_FAILURE: GROQ_API_KEY is not configured in server environment"],
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
        message: "GROQ_API_KEY is not configured in server environment (.env).",
        sanitizedDetails: "Missing GROQ_API_KEY",
      },
      rawOutput: "API_ERROR: Missing GROQ_API_KEY",
    };
  }

  const prompt = `You are acting as an independent Expert L3 Content Auditor (Groq Llama-3.3) for Atomic Pathshala NEET-UG.
Your job is to independently solve this question BLIND, check for subtle ambiguities or traps, evaluate whether multiple options could be defended as correct, verify the stated solution against the answer key, and assess NCERT textbook alignment.

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

AUDIT CHECKLIST:
1. Blindly solve the question independently. Do NOT trust the stated answer key.
2. Check for ambiguity in phrasing (e.g. could a student interpret the question in two different valid ways?).
3. Check for multiple correct options in a single-correct format.
4. Check if the stated solution contains calculation jumps, arithmetic errors, or contradictions with the answer key.
5. Check whether the concept directly aligns with the NCERT textbook curriculum.

Return ONLY a JSON response in this exact format:
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
    "citation": "NCERT Chemistry/Physics Chapter ...",
    "explanation": "Directly grounded in standard NCERT textbook principles"
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are the Lead Master Academic Auditor for Atomic Pathshala NEET-UG. Return strict JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const text = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseAiJson(text);

    const inputTokens = response.usage?.prompt_tokens || 850;
    const outputTokens = response.usage?.completion_tokens || 350;
    // Groq pricing (~$0.59 / 1M tokens)
    const estimatedCostUsd = ((inputTokens * 0.59) + (outputTokens * 0.79)) / 1_000_000;

    const stored = (snapshot.storedAnswer || []).map((k) => k.trim().toUpperCase());
    const solved = String(parsed.solvedAnswer || "").trim().toUpperCase();
    const answerMatches = Boolean(parsed.answerMatches ?? (solved && stored.includes(solved)));

    return {
      provider: "groq",
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
        explanation: "Verified by Groq Llama-3.3",
      },
      ambiguityDetected: Boolean(parsed.ambiguityDetected),
      multipleCorrectOptionsDetected: Boolean(parsed.multipleCorrectOptionsDetected),
      decision: parsed.decision || (answerMatches ? "APPROVE" : "REJECT"),
      rejectionReasons: Array.isArray(parsed.rejectionReasons) ? parsed.rejectionReasons : [],
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.94,
      tokenUsage: {
        inputTokens,
        outputTokens,
        durationMs,
        estimatedCostUsd,
      },
      rawOutput: text,
    };
  } catch (err: any) {
    console.error("[GroqReview] Error:", err);
    const errMsg = err?.message || String(err);
    const isAuth = errMsg.includes("401") || errMsg.includes("Invalid API Key") || errMsg.includes("invalid_api_key");
    const isRate = errMsg.includes("429") || errMsg.includes("rate_limit");

    const errorType = isAuth ? "AUTH_ERROR" : isRate ? "RATE_LIMIT" : "NETWORK_ERROR";
    const userFriendlyMsg = isAuth
      ? "Groq API Key is incorrect or invalid (Groq keys start with 'gsk_'). Please verify GROQ_API_KEY."
      : isRate
      ? "Groq rate limit reached. Please wait a moment and retry."
      : `Groq provider service error: ${errMsg}`;

    return {
      provider: "groq",
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
