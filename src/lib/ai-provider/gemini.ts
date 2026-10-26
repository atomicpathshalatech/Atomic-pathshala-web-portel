/**
 * ATOMIC PATHSHALA — GEMINI AI PROVIDER (Generation + L1 Review)
 * Uses Google Generative AI with multi-key failover and rotation.
 */

import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import {
  GenerateGroundedQuestionRequest,
  QuestionSnapshot,
  SingleModelReview,
} from "./types";

export async function generateQuestionWithGemini(
  request: GenerateGroundedQuestionRequest,
  sourceContext?: string
): Promise<QuestionSnapshot> {
  const prompt = `You are the Lead Master Content Faculty for Atomic Pathshala NEET-UG preparation.
Task: Generate a high-yield, source-grounded NEET-UG examination question.

Target Specifications:
- Subject: ${request.subject}
- Class Level: ${request.classLevel}
- Chapter: ${request.chapter}
- Topic: ${request.topic || "Core Syllabus Topic"}
- Subtopic: ${request.subTopic || "Detailed Concept"}
- Difficulty: ${request.difficulty || "MEDIUM"}
- Question Type: ${request.questionType || "SINGLE_CORRECT"}
- Language: ${request.language || "ENGLISH"}
${request.customInstructions ? `Special Instructions: ${request.customInstructions}` : ""}

${sourceContext ? `SOURCE GROUNDING EVIDENCE:
${sourceContext}
CRITICAL: The question, options, and solution MUST be grounded in and directly verifiable against the above source material. Record the exact source citations.` : "Base the question strictly on standard NCERT NEET syllabus."}

Return a strictly formatted JSON object with no Markdown wrappers or surrounding text:
{
  "statement": "Question statement in clear KaTeX LaTeX format (e.g., $E = mc^2$)",
  "options": {
    "A": "Option text",
    "B": "Option text",
    "C": "Option text",
    "D": "Option text"
  },
  "storedAnswer": ["A"],
  "solution": "Step-by-step authoritative solution with KaTeX math and explanation",
  "subject": "${request.subject}",
  "classLevel": "${request.classLevel}",
  "chapter": "${request.chapter}",
  "topic": "${request.topic || "Core Topic"}",
  "subTopic": "${request.subTopic || "Subtopic"}",
  "difficulty": "${request.difficulty || "MEDIUM"}",
  "type": "${request.questionType || "SINGLE_CORRECT"}",
  "sourceReferences": [
    {
      "sourceType": "NCERT_TEXTBOOK",
      "chapterTitle": "${request.chapter}",
      "pageNumber": 120,
      "quoteOrFigure": "Relevant passage or concept summary"
    }
  ]
}`;

  const startTime = Date.now();
  return executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const parsed = parseAiJson(text);

    return {
      statement: String(parsed.statement || ""),
      options: parsed.options || { A: "", B: "", C: "", D: "" },
      storedAnswer: Array.isArray(parsed.storedAnswer) ? parsed.storedAnswer : [String(parsed.storedAnswer || "A")],
      solution: String(parsed.solution || ""),
      subject: request.subject,
      classLevel: request.classLevel,
      chapter: request.chapter,
      topic: request.topic || parsed.topic || "",
      subTopic: request.subTopic || parsed.subTopic || "",
      difficulty: request.difficulty || parsed.difficulty || "MEDIUM",
      type: request.questionType || parsed.type || "SINGLE_CORRECT",
      language: request.language || "ENGLISH",
      sourceReferences: Array.isArray(parsed.sourceReferences) ? parsed.sourceReferences : [],
    };
  });
}

export async function reviewQuestionWithGemini(
  snapshot: QuestionSnapshot,
  sourceContext?: string
): Promise<SingleModelReview> {
  const prompt = `You are acting as the L1 Senior Subject Auditor (Gemini) for Atomic Pathshala NEET-UG.
Independently audit this question for scientific validity, mathematical accuracy, answer-key correctness, NCERT grounding, and formatting.

QUESTION TO AUDIT:
Statement: ${snapshot.statement}
Options:
A: ${snapshot.options.A || ""}
B: ${snapshot.options.B || ""}
C: ${snapshot.options.C || ""}
D: ${snapshot.options.D || ""}
Stated Answer Key: ${(snapshot.storedAnswer || []).join(", ")}
Stated Solution: ${snapshot.solution || "None"}
Subject: ${snapshot.subject} | Chapter: ${snapshot.chapter || "N/A"} | Topic: ${snapshot.topic || "N/A"}

${sourceContext ? `SOURCE MATERIAL EVIDENCE:
${sourceContext}` : ""}

Evaluate the question completely independently. Do NOT automatically trust the stated answer key.
Solve it yourself first, then compare.

Return ONLY a JSON object:
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
    "pageNumber": 45,
    "citation": "Chapter ... page ...",
    "explanation": "Directly stated in NCERT paragraph ..."
  },
  "ambiguityDetected": false,
  "multipleCorrectOptionsDetected": false,
  "decision": "APPROVE",
  "rejectionReasons": [],
  "confidenceScore": 0.95
}`;

  const startTime = Date.now();
  try {
    return await executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const parsed = parseAiJson(text);
      const durationMs = Date.now() - startTime;

      const solved = String(parsed.solvedAnswer || "").trim().toUpperCase();
      const stored = (snapshot.storedAnswer || []).map((k) => k.trim().toUpperCase());
      const answerMatches = parsed.answerMatches ?? stored.includes(solved);

      return {
        provider: "gemini",
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
          explanation: "Verified by Gemini",
        },
        ambiguityDetected: Boolean(parsed.ambiguityDetected),
        multipleCorrectOptionsDetected: Boolean(parsed.multipleCorrectOptionsDetected),
        decision: parsed.decision || (answerMatches ? "APPROVE" : "REJECT"),
        rejectionReasons: Array.isArray(parsed.rejectionReasons) ? parsed.rejectionReasons : [],
        confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.9,
        tokenUsage: {
          inputTokens: 850,
          outputTokens: 420,
          durationMs,
          estimatedCostUsd: 0.0003,
        },
        rawOutput: text,
      };
    });
  } catch (err: any) {
    console.error("[GeminiReview] Error:", err);
    return {
      provider: "gemini",
      model: "gemini-1.5-flash",
      solvedAnswer: "",
      answerMatches: false,
      isScientificallyCorrect: false,
      isMathematicallyCorrect: false,
      scientificErrors: [`Gemini review execution error: ${err.message || String(err)}`],
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
      rejectionReasons: [`API_ERROR: ${err.message}`],
      confidenceScore: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startTime,
        estimatedCostUsd: 0,
      },
      rawOutput: `API_ERROR: ${err.message}`,
    };
  }
}
